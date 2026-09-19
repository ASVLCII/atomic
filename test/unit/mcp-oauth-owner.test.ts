import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { getOAuthState, updateOAuthState } from "../../packages/mcp/mcp-auth.js";
import { authenticate, shutdownOAuth } from "../../packages/mcp/mcp-auth-flow.js";
import {
	ensureCallbackServer,
	getPendingAuthCount,
	isCallbackServerRunning,
	stopCallbackServer,
	waitForCallback,
} from "../../packages/mcp/mcp-callback-server.js";
import { getOAuthCallbackPort, McpOAuthProvider } from "../../packages/mcp/mcp-oauth-provider.js";

function reporter(scope: object = {}) {
	return Object.assign(() => {}, { [Symbol.for("atomic.builtin-owner.v1")]: scope });
}

// #3105: SDK auth transients must not share the durable server-name credential slot.
test("same-name OAuth owners retain private state and PKCE despite sibling and standalone writes", async () => {
	const key = Symbol.for("atomic.builtin-diagnostic-context.v1");
	const host = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<object> };
	const previous = host[key];
	const context = new AsyncLocalStorage<object>();
	host[key] = context;
	const directory = mkdtempSync(join(tmpdir(), "mcp-oauth-owner-"));
	const oldDirectory = process.env.MCP_OAUTH_DIR;
	process.env.MCP_OAUTH_DIR = directory;
	const firstScope = {};
	const first = reporter(firstScope);
	const second = reporter();
	const url = "https://oauth.example/mcp";
	const provider = () => new McpOAuthProvider("same", url, {}, { onRedirect: () => {} });
	try {
		const a = context.run(first, provider);
		const b = context.run(second, provider);
		await context.run(first, async () => {
			updateOAuthState("same", "first-state", url);
			await a.saveCodeVerifier("first-verifier");
			await a.saveTokens({ access_token: "shared-token", token_type: "Bearer" });
		});
		await context.run(second, async () => {
			updateOAuthState("same", "second-state", url);
			await b.saveCodeVerifier("second-verifier");
			assert.equal((await b.tokens())?.access_token, "shared-token");
		});
		const disk = JSON.parse(readFileSync(join(directory, "same", "tokens.json"), "utf8"));
		assert.equal(disk.oauthState, undefined);
		assert.equal(disk.codeVerifier, undefined);
		const standalone = provider();
		await standalone.saveState("standalone-state");
		await standalone.saveCodeVerifier("standalone-verifier");
		await context.run(reporter(firstScope), async () => {
			assert.equal(getOAuthState("same"), "first-state");
			assert.equal(await a.state(), "first-state");
			assert.equal(await a.codeVerifier(), "first-verifier");
			await a.redirectToAuthorization(new URL("https://oauth.example/authorize"));
		});
		assert.equal(await b.state(), "second-state");
		assert.equal(await b.codeVerifier(), "second-verifier");
		assert.equal(await standalone.state(), "standalone-state");
		assert.equal(await standalone.codeVerifier(), "standalone-verifier");
	} finally {
		host[key] = previous;
		if (oldDirectory === undefined) delete process.env.MCP_OAUTH_DIR;
		else process.env.MCP_OAUTH_DIR = oldDirectory;
		rmSync(directory, { recursive: true, force: true });
	}
});

// #3105: closing one OAuth owner must not reject or close its sibling's callback.
test("callback server retains sibling waiters across overlapping owner release", async () => {
	const key = Symbol.for("atomic.builtin-diagnostic-context.v1");
	const host = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<object> };
	const previous = host[key];
	const context = new AsyncLocalStorage<object>();
	host[key] = context;
	const first = reporter();
	const second = reporter();
	try {
		await context.run(first, () => ensureCallbackServer());
		await context.run(second, () => ensureCallbackServer());
		const a = context.run(first, () => waitForCallback("first"));
		const b = context.run(second, () => waitForCallback("second"));
		const rejected = assert.rejects(a, /stopped/);
		await context.run(first, () => Promise.all([stopCallbackServer(), stopCallbackServer()]));
		await rejected;
		assert.equal(isCallbackServerRunning(), true);
		assert.equal(getPendingAuthCount(), 1);
		const response = await fetch(`http://localhost:${getOAuthCallbackPort()}/callback?state=second&code=accepted`);
		assert.equal(response.status, 200);
		await response.text();
		assert.equal(await b, "accepted");
		await context.run(second, () => stopCallbackServer());
		assert.equal(isCallbackServerRunning(), false);
	} finally {
		await context.run(first, () => stopCallbackServer());
		await context.run(second, () => stopCallbackServer());
		host[key] = previous;
	}
});

// #3105: same-name authentication is single-flight only within its SDK owner.
test("same-name authentication producers belong to separate owners", async () => {
	const key = Symbol.for("atomic.builtin-diagnostic-context.v1");
	const host = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<object> };
	const previous = host[key];
	const context = new AsyncLocalStorage<object>();
	host[key] = context;
	const first = reporter();
	const second = reporter();
	const directory = mkdtempSync(join(tmpdir(), "mcp-oauth-producers-"));
	const oldDirectory = process.env.MCP_OAUTH_DIR;
	process.env.MCP_OAUTH_DIR = directory;
	let origin = "";
	let requests = 0;
	const server = createServer((request, response) => {
		response.setHeader("content-type", "application/json");
		if (request.url?.includes(".well-known")) {
			response.end(
				JSON.stringify({
					issuer: origin,
					authorization_endpoint: `${origin}/authorize`,
					token_endpoint: `${origin}/token`,
					response_types_supported: ["code"],
					grant_types_supported: ["client_credentials"],
					token_endpoint_auth_methods_supported: ["client_secret_post"],
				}),
			);
		} else if (request.url === "/token") {
			requests++;
			response.end(JSON.stringify({ access_token: "shared", token_type: "Bearer" }));
		} else {
			response.writeHead(404).end();
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	origin = `http://127.0.0.1:${address.port}`;
	const definition = {
		url: origin,
		oauth: { grantType: "client_credentials" as const, clientId: "client", clientSecret: "secret" },
	};
	try {
		const a = context.run(first, () => authenticate("same", origin, definition));
		const joined = context.run(first, () => authenticate("same", origin, definition));
		const b = context.run(second, () => authenticate("same", origin, definition));
		const completed = Promise.allSettled([a, b]);
		assert.equal(a, joined);
		assert.notEqual(a, b);
		assert.deepEqual(await completed, [
			{ status: "fulfilled", value: "authenticated" },
			{ status: "fulfilled", value: "authenticated" },
		]);
		assert.equal(requests, 2);
	} finally {
		await context.run(first, () => shutdownOAuth());
		await context.run(second, () => shutdownOAuth());
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		host[key] = previous;
		if (oldDirectory === undefined) delete process.env.MCP_OAUTH_DIR;
		else process.env.MCP_OAUTH_DIR = oldDirectory;
		rmSync(directory, { recursive: true, force: true });
	}
});
