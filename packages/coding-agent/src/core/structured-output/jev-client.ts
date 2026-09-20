import {
	APIConnectionError,
	APIError,
	APITimeoutError,
	AuthenticationError,
	BadRequestError,
	InternalServerError,
	NotFoundError,
	PermissionDeniedError,
	RateLimitError,
	TypeSafeClient,
	UnprocessableEntityError,
} from "@typesafe-ai/sdk";

/** Safe diagnostics only. Never retain SDK errors, headers, bodies, or causes. */
export class JevRequestError extends Error {
	usage?: { inputTokens: number; outputTokens: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeError(error: APIError, authGuidance: string): JevRequestError {
	const classes = [
		[BadRequestError, "BadRequestError"],
		[AuthenticationError, "AuthenticationError"],
		[PermissionDeniedError, "PermissionDeniedError"],
		[NotFoundError, "NotFoundError"],
		[UnprocessableEntityError, "UnprocessableEntityError"],
		[RateLimitError, "RateLimitError"],
		[InternalServerError, "InternalServerError"],
	] as const;
	const kind = classes.find(([type]) => error instanceof type)?.[1] ?? "APIError";
	// Only known machine codes are printable. Arbitrary provider text can echo input.
	const contextLimit =
		isRecord(error.body) && isRecord(error.body.detail) && error.body.detail.error_type === "max_tokens_exceeded";
	const requestId = error.requestId && /^req_[a-f0-9]{16,64}$/.test(error.requestId) ? error.requestId : undefined;
	const guidance = contextLimit
		? "max_tokens_exceeded: request exceeds the provider context limit. Use less context or a chat model."
		: error instanceof AuthenticationError
			? authGuidance
			: error instanceof BadRequestError || error instanceof UnprocessableEntityError
				? "Check the state and Choice question contract."
				: error instanceof PermissionDeniedError
					? "Check provider access permissions."
					: error instanceof NotFoundError
						? "Check the provider endpoint and model."
						: error instanceof RateLimitError || error.status === 529
							? "Wait before retrying explicitly."
							: "Check provider availability.";
	return new JevRequestError(
		`Jev HTTP ${error.status} (${kind}). ${guidance}${requestId ? ` Request ID: ${requestId}.` : ""} No automatic retry was made.`,
	);
}

const MAX_RESPONSE_BYTES = 1024 * 1024;
class JevResponseLimitError extends Error {}

/** Bound both successful and error bodies before the SDK buffers them. */
async function boundedResponse(response: Response, signal: AbortSignal): Promise<Response> {
	const reader = response.body?.getReader();
	if (!reader) return response;
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	const cancel = () => {
		void reader.cancel().catch(() => {});
	};
	signal.addEventListener("abort", cancel, { once: true });
	try {
		while (true) {
			signal.throwIfAborted();
			const part = await reader.read();
			if (part.done) break;
			bytes += part.value.byteLength;
			if (bytes > MAX_RESPONSE_BYTES) {
				cancel();
				throw new JevResponseLimitError("Jev response exceeded the 1 MiB structured decision limit.");
			}
			chunks.push(part.value);
		}
		signal.throwIfAborted();
		const body = new Uint8Array(bytes);
		let offset = 0;
		for (const chunk of chunks) {
			body.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} finally {
		if (signal.aborted) cancel();
		signal.removeEventListener("abort", cancel);
		reader.releaseLock();
	}
}

export function createJevClient(options: {
	apiKey: string;
	endpoint: string;
	model: string;
	signal: AbortSignal;
	timeoutMs: number;
	authGuidance: string;
}) {
	const client = new TypeSafeClient({
		apiKey: options.apiKey,
		baseURL: new URL(options.endpoint).origin,
		defaultModel: options.model,
		retry: { maxRetries: 0 },
		timeout: options.timeoutMs,
		// SDK debug logging includes bodies. Never inherit TYPESAFE_LOG_LEVEL.
		logLevel: "off",
		fetch: async (_url, init) => {
			// OpenRouter exposes the same contract at /api/alpha/decisions.
			// Only this fixed, resolved provider endpoint may receive credentials.
			const response = await fetch(options.endpoint, { ...init, redirect: "error" });
			return boundedResponse(response, init?.signal ?? options.signal);
		},
	});
	return {
		client,
		failure(error: unknown): Error {
			options.signal.throwIfAborted();
			if (error instanceof APIError) return describeError(error, options.authGuidance);
			if (error instanceof APITimeoutError)
				return new Error("Jev request timed out (APITimeoutError); no decision was accepted.");
			if (error instanceof APIConnectionError && error.cause instanceof JevResponseLimitError) return error.cause;
			if (error instanceof APIConnectionError)
				return new JevRequestError(
					"Jev request failed (APIConnectionError). Check connectivity and retry explicitly; no automatic retry was made.",
				);
			return new Error("Jev SDK request failed; no decision was accepted.");
		},
	};
}
