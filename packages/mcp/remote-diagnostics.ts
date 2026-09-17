import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/** SDK errors may retain request URLs in messages, causes and EventSource events. */
export function sanitizeRemoteError(error: unknown, endpoint: string): Error {
	const url = new URL(endpoint);
	const secrets = [url.username, url.password, ...url.searchParams.values(), url.hash.slice(1)];
	let message = error instanceof Error ? error.message : String(error);
	// Also hide discovered OAuth/SSE URLs, which need not equal the configured endpoint.
	message = message.replace(/https?:\/\/[^\s<>"']+/gi, "[redacted URL]");
	for (const secret of secrets) {
		if (!secret) continue;
		message = message.replaceAll(secret, "[redacted]");
		try {
			message = message.replaceAll(decodeURIComponent(secret), "[redacted]");
		} catch {
			// A URL may legally contain a literal percent sign.
		}
	}
	// Never attach the original error: stack, cause, event and arbitrary SDK fields
	// can all contain secrets. Preserve the auth discriminator and numeric status.
	const safe = error instanceof UnauthorizedError ? new UnauthorizedError(message) : new Error(message);
	if (error instanceof Error && "code" in error && typeof error.code === "number") {
		Object.assign(safe, { code: error.code });
	}
	return safe;
}

/** Protect both rejected operations and asynchronous SDK diagnostics, not stdio. */
export function protectRemoteTransport<T extends Transport>(transport: T, endpoint: string): T {
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
