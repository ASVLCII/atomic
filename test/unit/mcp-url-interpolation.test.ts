import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { join } from "node:path";
import { inspect } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { afterEach, test, vi } from "vitest";
import { loadMcpConfig } from "../../packages/mcp/config.js";
import { getAuthForUrl, saveAuthEntry } from "../../packages/mcp/mcp-auth.js";
import { completeAuth, getValidToken, shutdownOAuth, startAuth } from "../../packages/mcp/mcp-auth-flow.js";
import { computeServerHash, isServerCacheValid } from "../../packages/mcp/metadata-cache.js";
import { McpServerManager } from "../../packages/mcp/server-manager.js";
import { resolveServerUrl } from "../../packages/mcp/utils.js";
import { makeTempDirectory, removeTempDirectory, writeFileEnsuringDir } from "../helpers/runtime.js";

afterEach(() => vi.unstubAllEnvs());

// Regression for #3088: cache identity follows the same resolved endpoint as transport.
test("MCP URL cache identity resolves both syntaxes, suffixes and missing variables", () => {
	vi.stubEnv("MCP_3088_ORIGIN", "https://one.example");
	vi.stubEnv("MCP_3088_MISSING", undefined);
	for (const url of [`\${MCP_3088_ORIGIN}/mcp`, "$env:MCP_3088_ORIGIN/mcp"]) {
		const definition = { url };
		const hash = computeServerHash(definition);
		assert.equal(hash, computeServerHash({ url: "https://one.example/mcp" }));
		const entry = { configHash: hash, tools: [], resources: [], cachedAt: Date.now() };
		assert.equal(isServerCacheValid(entry, definition), true);
		vi.stubEnv("MCP_3088_ORIGIN", "https://two.example");
		assert.equal(isServerCacheValid(entry, definition), false);
		vi.stubEnv("MCP_3088_ORIGIN", "https://one.example");
		assert.equal(definition.url, url);
	}
	assert.equal(
		computeServerHash({ url: `https://one.example/\${MCP_3088_MISSING}mcp` }),
		computeServerHash({ url: "https://one.example/mcp" }),
	);
});

// Regression for #3088: exercise the SDK probe and real connection, not just interpolation.
test("MCP HTTP transport uses resolved URLs and preserves literal endpoints", async () => {
	const dir = makeTempDirectory("mcp-url-config-");
	vi.stubEnv("ATOMIC_CODING_AGENT_DIR", join(dir, "agent"));
	vi.stubEnv("MCP_OAUTH_DIR", join(dir, "auth"));
	vi.stubEnv("MY_SERVICE_TOKEN", "fixture-token");
	await writeFileEnsuringDir(
		join(dir, "project", ".mcp.json"),
		JSON.stringify({
			mcpServers: { project: { url: `\${MY_SERVICE_URL}/mcp`, auth: "bearer", bearerTokenEnv: "MY_SERVICE_TOKEN" } },
		}),
	);
	await writeFileEnsuringDir(
		join(dir, "agent", "mcp.json"),
		JSON.stringify({ mcpServers: { global: { url: "$env:MY_SERVICE_URL/mcp", auth: "oauth" } } }),
	);
	const config = loadMcpConfig(undefined, join(dir, "project"));
	assert.equal(config.mcpServers.project.url, `\${MY_SERVICE_URL}/mcp`);
	assert.equal(config.mcpServers.global.url, "$env:MY_SERVICE_URL/mcp");
	const requests: string[] = [];
	const servers: McpServer[] = [];
	const authorization: (string | undefined)[] = [];
	const server = createServer(async (request, response) => {
		requests.push(request.url ?? "");
		authorization.push(request.headers.authorization);
		const mcp = new McpServer({ name: "url-fixture", version: "1" });
		servers.push(mcp);
		mcp.registerTool("hello", {}, async () => ({ content: [{ type: "text", text: "resolved endpoint" }] }));
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		await mcp.connect(transport);
		await transport.handleRequest(request, response);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const origin = `http://127.0.0.1:${address.port}`;
	vi.stubEnv("MCP_3088_ORIGIN", origin);
	vi.stubEnv("MY_SERVICE_URL", origin);
	saveAuthEntry(
		"remote",
		{ tokens: { accessToken: "fixture-token", expiresAt: Date.now() + 60_000 } },
		`${origin}/mcp`,
	);
	vi.stubEnv("MCP_3088_MISSING", undefined);
	const manager = new McpServerManager();
	try {
		await assert.rejects(manager.connect("remote", { url: `\${MCP_3088_MISSING}` }), /Invalid MCP server url/);
		for (const definition of [
			config.mcpServers.project,
			config.mcpServers.global,
			...[
				`\${MCP_3088_ORIGIN}/mcp`,
				"$env:MCP_3088_ORIGIN/mcp",
				`${origin}/mcp`,
				`${origin}/\${MCP_3088_MISSING}mcp`,
				`${origin}/mcp$env:MCP_3088_MISSING`,
			].map((url) => ({ url, auth: false as const })),
		]) {
			const before = authorization.length;
			const connection = await manager.connect("remote", definition);
			assert.equal(connection.status, "connected");
			assert.equal(connection.tools[0]?.name, "hello");
			assert.deepEqual((await connection.client.callTool({ name: "hello" })).content, [
				{ type: "text", text: "resolved endpoint" },
			]);
			assert.equal(connection.definition, definition);
			if (definition.auth) assert.ok(authorization.slice(before).every((value) => value === "Bearer fixture-token"));
			await manager.close("remote");
		}
		assert.ok(requests.length >= 8);
		assert.ok(requests.every((path) => path === "/mcp"));
	} finally {
		await manager.closeAll();
		await Promise.all(servers.map((mcp) => mcp.close()));
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		removeTempDirectory(dir);
	}
});

// Regression for #3088: invalid resolved endpoints never reach either transport or leak input.
test("MCP rejects empty, malformed and unsupported resolved URLs before network access", async () => {
	vi.stubEnv("MCP_3088_MISSING", undefined);
	vi.stubEnv("MCP_3088_INVALID", "https://user:secret@[bad/?token=secret");
	const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected network"));
	const manager = new McpServerManager();
	try {
		for (const url of [
			"",
			`\${MCP_3088_MISSING}`,
			"$env:MCP_3088_MISSING/mcp",
			"https://",
			"https://user:secret@[bad/?token=secret",
			`\${MCP_3088_INVALID}`,
			"$env:MCP_3088_INVALID",
			"file:///secret",
			"ftp://user:secret@example.com",
			"ws://example.com",
		]) {
			await assert.rejects(manager.connect("invalid", { url }), (error: Error) => {
				assert.equal(
					error.message,
					"Invalid MCP server url: expected a non-empty HTTP(S) URL after environment variable interpolation.",
				);
				assert.doesNotMatch(String(error.stack), /secret/);
				assert.equal("input" in error, false);
				assert.equal("cause" in error, false);
				return true;
			});
			assert.equal(manager.getConnection("invalid"), undefined);
		}
		assert.equal(fetchSpy.mock.calls.length, 0);
	} finally {
		fetchSpy.mockRestore();
		await manager.closeAll();
	}
});

// Regression for #3088: OAuth discovery/storage must use the transport's resolved identity.
test("MCP OAuth resolves endpoints before discovery and stored-token lookup", async () => {
	const dir = makeTempDirectory("mcp-url-auth-");
	vi.stubEnv("MCP_OAUTH_DIR", dir);
	const paths: string[] = [];
	let origin = "";
	const server = createServer((request, response) => {
		paths.push(request.url ?? "");
		response.setHeader("Content-Type", "application/json");
		if (request.url?.includes("oauth-protected-resource")) {
			response.end(JSON.stringify({ resource: `${origin}/mcp`, authorization_servers: [origin] }));
		} else if (request.url?.includes("oauth-authorization-server")) {
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
			response.end(JSON.stringify({ access_token: "fixture-token", token_type: "Bearer", expires_in: 3600 }));
		} else {
			response.writeHead(404).end("{}");
		}
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	origin = `http://127.0.0.1:${address.port}`;
	vi.stubEnv("MCP_3088_ORIGIN", origin);
	try {
		await startAuth("oauth", `\${MCP_3088_ORIGIN}/mcp`, {
			auth: "oauth",
			oauth: { grantType: "client_credentials", clientId: "fixture", clientSecret: "fixture-secret" },
		});
		assert.ok(paths.includes("/token"));
		assert.equal(getAuthForUrl("oauth", `${origin}/mcp`)?.tokens?.accessToken, "fixture-token");
		assert.equal((await getValidToken("oauth", "$env:MCP_3088_ORIGIN/mcp"))?.accessToken, "fixture-token");
		const before = paths.length;
		await assert.rejects(startAuth("bad", "ftp://user:secret@example.com"), /Invalid MCP server url/);
		assert.equal(paths.length, before);
		vi.stubEnv("MCP_3088_ORIGIN", "https://changed.example");
		assert.equal(await getValidToken("oauth", `\${MCP_3088_ORIGIN}/mcp`), null);
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		removeTempDirectory(dir);
	}
});

// Regression for #3088: the legacy fallback must use the same interpolated endpoint.
test("MCP SSE fallback connects to the resolved URL", async () => {
	const paths: string[] = [];
	const mcp = new McpServer({ name: "sse-fixture", version: "1" });
	mcp.registerTool("legacy", {}, async () => ({ content: [{ type: "text", text: "SSE works" }] }));
	let transport: SSEServerTransport | undefined;
	const server = createServer(async (request, response) => {
		paths.push(`${request.method} ${request.url}`);
		if (request.method === "GET" && request.url === "/sse") {
			transport = new SSEServerTransport("/messages", response);
			await mcp.connect(transport);
		} else if (request.url?.startsWith("/messages") && transport) {
			await transport.handlePostMessage(request, response);
		} else response.writeHead(405).end();
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	vi.stubEnv("MCP_3088_ORIGIN", `http://127.0.0.1:${address.port}`);
	const manager = new McpServerManager();
	try {
		const connection = await manager.connect("legacy", { url: "$env:MCP_3088_ORIGIN/sse", auth: false });
		assert.equal(connection.tools[0]?.name, "legacy");
		assert.deepEqual((await connection.client.callTool({ name: "legacy" })).content, [
			{ type: "text", text: "SSE works" },
		]);
		assert.equal(paths[0], "POST /sse");
		assert.ok(paths.includes("GET /sse"));
	} finally {
		await manager.closeAll();
		await mcp.close();
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

// Regression for #3088: command precedence and stdio are not subject to URL validation.
test("MCP stdio still connects when an unused URL is invalid", async () => {
	const manager = new McpServerManager();
	try {
		const connection = await manager.connect("stdio", {
			command: process.execPath,
			args: [
				"--input-type=module",
				"-e",
				`
				import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
				import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
				const server = new McpServer({name: 'stdio-fixture', version: '1'});
				server.registerTool('stdio', {}, async () => ({content: []}));
				await server.connect(new StdioServerTransport());
			`,
			],
			url: "not a URL",
		});
		assert.equal(connection.status, "connected");
		assert.equal(connection.tools[0]?.name, "stdio");
	} finally {
		await manager.closeAll();
	}
});

// Regression for #3088: validation must not normalize otherwise valid configured text.
test("MCP URL resolution preserves valid HTTP(S) text and existing sequential substitution", () => {
	for (const url of [
		"https://EXAMPLE.com:443/a%2Fb?token=secret#part",
		"http://example.com",
		"https://user:secret@example.com/mcp",
	]) {
		assert.equal(resolveServerUrl(url), url);
	}
	vi.stubEnv("MCP_3088_ORIGIN", "https://example.com/$env:MCP_3088_SUFFIX");
	vi.stubEnv("MCP_3088_SUFFIX", "mcp");
	assert.equal(resolveServerUrl(`\${MCP_3088_ORIGIN}`), "https://example.com/mcp");
});

// Regression for #3088: Node's real fetch/EventSource SDK errors retain URL credentials.
test("MCP Node SDK connection errors do not expose resolved endpoint secrets", async () => {
	const endpoint = "http://user:SDK_PASSWORD@127.0.0.1:1/mcp?token=SDK_QUERY";
	vi.stubEnv("MCP_3088_SECRET", endpoint);
	const manager = new McpServerManager();
	try {
		for (const url of [`\${MCP_3088_SECRET}`, "$env:MCP_3088_SECRET", endpoint]) {
			assert.equal(resolveServerUrl(url), endpoint);
			await assert.rejects(manager.connect("secret", { url, auth: false }), (error: Error) => {
				assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /SDK_PASSWORD|SDK_QUERY/);
				assert.equal("cause" in error, false);
				assert.equal("event" in error, false);
				assert.match(error.message, /SSE error/);
				return true;
			});
			assert.equal(manager.getConnection("secret"), undefined);
		}
	} finally {
		await manager.closeAll();
	}
});

// Regression for #3088: real SDK OAuth errors can echo endpoints in response descriptions.
test("MCP OAuth start, completion and refresh diagnostics hide endpoint secrets", async () => {
	const dir = makeTempDirectory("mcp-url-auth-errors-");
	vi.stubEnv("MCP_OAUTH_DIR", dir);
	let origin = "";
	const server = createServer((request, response) => {
		response.setHeader("Content-Type", "application/json");
		if (request.url?.includes("oauth-protected-resource")) {
			response.end(JSON.stringify({ resource: `${origin}/mcp`, authorization_servers: [origin] }));
		} else if (request.url?.includes("oauth-authorization-server")) {
			response.end(
				JSON.stringify({
					issuer: origin,
					authorization_endpoint: `${origin}/authorize`,
					token_endpoint: `${origin}/token`,
					response_types_supported: ["code"],
					code_challenge_methods_supported: ["S256"],
					grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
				}),
			);
		} else if (request.url === "/token") {
			response
				.writeHead(400)
				.end(JSON.stringify({ error: "invalid_request", error_description: `${origin}/mcp?token=OAUTH_QUERY` }));
		} else response.writeHead(404).end("{}");
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	origin = `http://127.0.0.1:${address.port}`;
	const endpoint = `${origin}/mcp?token=OAUTH_QUERY`;
	vi.stubEnv("MCP_3088_SECRET", endpoint);
	const safeError = (error: Error) => {
		assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /OAUTH_QUERY/);
		assert.equal("cause" in error, false);
		return true;
	};
	try {
		await assert.rejects(
			startAuth("start", `\${MCP_3088_SECRET}`, {
				oauth: { grantType: "client_credentials", clientId: "fixture", clientSecret: "fixture" },
			}),
			safeError,
		);
		await startAuth("complete", endpoint, { oauth: { clientId: "fixture" } });
		await assert.rejects(completeAuth("complete", "code"), safeError);
		saveAuthEntry(
			"refresh",
			{
				clientInfo: { clientId: "fixture" },
				tokens: { accessToken: "expired", refreshToken: "refresh", expiresAt: 1 },
			},
			endpoint,
		);
		const logs = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			assert.equal(await getValidToken("refresh", endpoint), null);
			assert.ok(logs.mock.calls.length > 0);
			assert.doesNotMatch(inspect(logs.mock.calls, { depth: null, showHidden: true }), /OAUTH_QUERY/);
		} finally {
			logs.mockRestore();
		}
	} finally {
		await shutdownOAuth();
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		removeTempDirectory(dir);
	}
});

// Regression for #3088: protect post-connect HTTP rejections AND client.onerror events.
test("MCP HTTP request errors redact endpoint tokens without losing status codes", async () => {
	const servers: McpServer[] = [];
	let fail = false;
	let endpoint = "";
	const server = createServer(async (request, response) => {
		if (fail) {
			response.writeHead(500).end(`Request failed at ${endpoint}`);
			return;
		}
		const mcp = new McpServer({ name: "diagnostics", version: "1" });
		servers.push(mcp);
		mcp.registerTool("hello", {}, async () => ({ content: [] }));
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
		await mcp.connect(transport);
		await transport.handleRequest(request, response);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	endpoint = `http://127.0.0.1:${address.port}/mcp?token=HTTP_SECRET&token=SECOND_SECRET`;
	const manager = new McpServerManager();
	try {
		const connection = await manager.connect("http-error", { url: endpoint, auth: false });
		const events: Error[] = [];
		connection.client.onerror = (error) => events.push(error);
		fail = true;
		await assert.rejects(connection.client.callTool({ name: "hello" }), (error: Error) => {
			assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /HTTP_SECRET|SECOND_SECRET/);
			assert.ok("code" in error && error.code === 500);
			assert.equal("cause" in error, false);
			return true;
		});
		assert.ok(events.length > 0);
		assert.doesNotMatch(inspect(events, { depth: null, showHidden: true }), /HTTP_SECRET|SECOND_SECRET/);
		assert.ok(events.some((error) => "code" in error && error.code === 500));
	} finally {
		await manager.closeAll();
		await Promise.all(servers.map((mcp) => mcp.close()));
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
