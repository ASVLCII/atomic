import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isJSONRPCErrorResponse, type JSONRPCErrorResponse } from "@modelcontextprotocol/sdk/types.js";

function redactDiagnosticText(message: string, endpoint: string, preserveSafeUrls = false): string {
	const url = new URL(endpoint);
	const secrets = [url.username, url.password, ...url.searchParams.values(), url.hash.slice(1)];
	// Also hide discovered OAuth/SSE URLs, which need not equal the configured endpoint.
	message = message.replace(/https?:\/\/[^\s<>"']+/gi, (match) => {
		if (preserveSafeUrls) {
			try {
				const candidate = new URL(match);
				if (!candidate.username && !candidate.password && !candidate.search && !candidate.hash) return match;
			} catch {
				// Malformed diagnostic URLs may still contain credentials.
			}
		}
		return "[redacted URL]";
	});
	for (const secret of secrets) {
		if (!secret) continue;
		message = message.replaceAll(secret, "[redacted]");
		try {
			message = message.replaceAll(decodeURIComponent(secret), "[redacted]");
		} catch {
			// A URL may legally contain a literal percent sign.
		}
	}
	return message;
}

/** SDK errors may retain request URLs in messages, causes and EventSource events. */
export function sanitizeRemoteError(error: unknown, endpoint: string): Error {
	const message = redactDiagnosticText(error instanceof Error ? error.message : String(error), endpoint);
	// Never attach the original error: stack, cause, event and arbitrary SDK fields
	// can all contain secrets. Preserve the auth discriminator and numeric status.
	const safe = error instanceof UnauthorizedError ? new UnauthorizedError(message) : new Error(message);
	if (error instanceof Error && "code" in error && typeof error.code === "number") {
		Object.assign(safe, { code: error.code });
	}
	return safe;
}

/** Only error diagnostics are traversed; successful protocol payloads stay untouched. */
function sanitizeRpcDiagnostic<T>(value: T, endpoint: string): T {
	if (typeof value === "string") return redactDiagnosticText(value, endpoint, true) as T;
	if (Array.isArray(value)) return value.map((item) => sanitizeRpcDiagnostic(item, endpoint)) as T;
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				redactDiagnosticText(key, endpoint, true),
				sanitizeRpcDiagnostic(item, endpoint),
			]),
		) as T;
	}
	return value;
}

function sanitizeRpcError(error: JSONRPCErrorResponse["error"], endpoint: string): JSONRPCErrorResponse["error"] {
	const { code, message, data, ...diagnostics } = error;
	// Protocol field names are not diagnostics, even when a token equals one of them.
	return {
		...sanitizeRpcDiagnostic(diagnostics, endpoint),
		code,
		message: redactDiagnosticText(message, endpoint, true),
		...("data" in error ? { data: sanitizeRpcDiagnostic(data, endpoint) } : {}),
	};
}

/** Protect both rejected operations and asynchronous SDK diagnostics, not stdio. */
export function protectRemoteTransport<T extends Transport>(transport: T, endpoint: string): T {
	let onmessage: Transport["onmessage"];
	Object.defineProperty(transport, "onmessage", {
		configurable: true,
		get: () => onmessage,
		set: (handler: Transport["onmessage"]) => {
			onmessage = handler
				? (message, extra) =>
						handler(
							isJSONRPCErrorResponse(message)
								? { ...message, error: sanitizeRpcError(message.error, endpoint) }
								: message,
							extra,
						)
				: undefined;
		},
	});
	let onerror: Transport["onerror"];
	Object.defineProperty(transport, "onerror", {
		configurable: true,
		get: () => onerror,
		set: (handler: Transport["onerror"]) => {
			onerror = handler ? (error) => handler(sanitizeRemoteError(error, endpoint)) : undefined;
		},
	});
	const start = transport.start.bind(transport);
	const send = transport.send.bind(transport);
	const close = transport.close.bind(transport);
	transport.start = async () => {
		try {
			await start();
		} catch (error) {
			throw sanitizeRemoteError(error, endpoint);
		}
	};
	transport.send = async (message, options) => {
		try {
			await send(message, options);
		} catch (error) {
			throw sanitizeRemoteError(error, endpoint);
		}
	};
	transport.close = async () => {
		try {
			await close();
		} catch (error) {
			throw sanitizeRemoteError(error, endpoint);
		}
	};
	return transport;
}
