import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { inspect } from "node:util";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { type JSONRPCMessage, McpError } from "@modelcontextprotocol/sdk/types.js";
import { test } from "vitest";
import { protectRemoteTransport, sanitizeRemoteError } from "../../packages/mcp/remote-diagnostics.js";
import { McpServerManager } from "../../packages/mcp/server-manager.js";

// Regression for #3088: JSON-RPC errors resolve transport.send but reject SDK requests via onmessage.
test("MCP Node discovery and tool RPC diagnostics redact secrets in messages and nested data", async () => {
	let endpoint = "";
	let failDiscovery = true;
	const paths: string[] = [];
	const server = createServer(async (request, response) => {
		paths.push(request.url ?? "");
		let raw = "";
		for await (const chunk of request) raw += chunk;
		const message = raw ? JSON.parse(raw) : {};
		response.setHeader("Content-Type", "application/json");
		if (!("id" in message)) {
			response.writeHead(202).end();
			return;
		}
		if ((message.method === "tools/list" && failDiscovery) || message.method === "tools/call") {
			response.end(
				JSON.stringify({
					jsonrpc: "2.0",
					id: message.id,
					error: {
						code: -32603,
						message: `Unable to process ${message.method} at ${endpoint}`,
						data: {
							retryAfter: 0,
							retryable: false,
							context: null,
							detail: "upstream unavailable",
							docs: "https://docs.example/errors",
							_meta: { attempts: [endpoint, { token: "RPC_SECRET" }] },
						},
					},
				}),
			);
			return;
		}
		const result =
			message.method === "initialize"
				? { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "rpc", version: "1" } }
				: { tools: [{ name: "fail", inputSchema: { type: "object" } }] };
		response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	endpoint = `http://127.0.0.1:${address.port}/mcp?token=RPC_SECRET`;
	const manager = new McpServerManager();
	const checkError = (error: unknown) => {
		assert.ok(error instanceof McpError);
		assert.equal(error.code, -32603);
		assert.match(error.message, /Unable to process tools\/(list|call)/);
		assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /RPC_SECRET/);
		assert.deepEqual(error.data, {
			retryAfter: 0,
			retryable: false,
			context: null,
			detail: "upstream unavailable",
			docs: "https://docs.example/errors",
			_meta: { attempts: ["[redacted URL]", { token: "[redacted]" }] },
		});
		return true;
	};
	try {
		await assert.rejects(manager.connect("discovery", { url: endpoint, auth: false }), checkError);
		assert.equal(manager.getConnection("discovery"), undefined);
		failDiscovery = false;
		const connection = await manager.connect("call", { url: endpoint, auth: false });
		await assert.rejects(connection.client.callTool({ name: "fail" }), checkError);
		assert.ok(paths.length > 0);
		assert.ok(paths.every((path) => path === "/mcp?token=RPC_SECRET"));
	} finally {
		await manager.closeAll();
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

// Regression for #3088: filter diagnostic errors only, never successful content or routing identifiers.
test("MCP diagnostic boundary preserves success identity and optional or zero error fields", async () => {
	const endpoint = "https://example.com/mcp?token=RPC_SECRET";
	const sent: JSONRPCMessage[] = [];
	const transport: Transport = {
		start: async () => {},
		send: async (message) => {
			sent.push(message);
		},
		close: async () => {},
	};
	assert.equal(protectRemoteTransport(transport, endpoint), transport);
	const received: JSONRPCMessage[] = [];
	transport.onmessage = (message) => {
		received.push(message);
	};
	const success: JSONRPCMessage = {
		jsonrpc: "2.0",
		id: "RPC_SECRET",
		result: { content: [{ type: "text", text: endpoint }], _meta: { token: "RPC_SECRET" } },
	};
	const notification: JSONRPCMessage = { jsonrpc: "2.0", method: "notifications/message", params: { text: endpoint } };
	for (const message of [success, notification]) {
		transport.onmessage(message);
		assert.equal(received.at(-1), message);
		await transport.send(message);
		assert.equal(sent.at(-1), message);
	}
	for (const data of [undefined, null, 0, false, ""]) {
		const message: JSONRPCMessage = {
			jsonrpc: "2.0",
			id: 0,
			error: { code: 0, message: "", ...(data === undefined ? {} : { data }) },
		};
		transport.onmessage(message);
		assert.deepEqual(received.at(-1), message);
	}
	const error = {
		jsonrpc: "2.0" as const,
		id: "RPC_SECRET",
		error: { code: 401, message: "denied", data: { _meta: { RPC_SECRET: [endpoint] } } },
	};
	const original = structuredClone(error);
	transport.onmessage(error);
	assert.deepEqual(received.at(-1), {
		jsonrpc: "2.0",
		id: "RPC_SECRET",
		error: { code: 401, message: "denied", data: { _meta: { "[redacted]": ["[redacted URL]"] } } },
	});
	assert.deepEqual(error, original);
	const withoutId: JSONRPCMessage = { jsonrpc: "2.0", error: { code: 0, message: "" } };
	transport.onmessage(withoutId);
	assert.deepEqual(received.at(-1), withoutId);
	const unauthorized = sanitizeRemoteError(Object.assign(new UnauthorizedError(endpoint), { code: 0 }), endpoint);
	assert.ok(unauthorized instanceof UnauthorizedError);
	assert.equal((unauthorized as Error & { code: number }).code, 0);
	assert.doesNotMatch(inspect(unauthorized, { showHidden: true }), /RPC_SECRET/);
	transport.onmessage = undefined;
	assert.equal(transport.onmessage, undefined);
});

// Regression for #3088: permitted tokens must not rename JSON-RPC protocol fields.
test.each(
	["code", "message", "data"].flatMap((token) => [
		{ token, target: `/mcp?token=${token}` },
		{ token, target: `/${token}` },
	]),
)("MCP error envelope survives a $target token collision", ({ token, target }) => {
	const transport = protectRemoteTransport<Transport>(
		{ start: async () => {}, send: async () => {}, close: async () => {} },
		`https://example.com${target}`,
	);
	let received: JSONRPCMessage | undefined;
	transport.onmessage = (message) => {
		received = message;
	};
	transport.onmessage({
		jsonrpc: "2.0",
		id: token,
		error: { code: -32603, message: `Unavailable: ${token}`, data: { [token]: [token], retryable: false } },
	});
	assert.deepEqual(received, {
		jsonrpc: "2.0",
		id: token,
		error: {
			code: -32603,
			message: "Unavailable: [redacted]",
			data: { "[redacted]": ["[redacted]"], retryable: false },
		},
	});
});

test.each(["code", "message", "data"])(
	"MCP HTTP discovery preserves errors with a %s token collision",
	async (token) => {
		const paths: string[] = [];
		const server = createServer(async (request, response) => {
			paths.push(request.url ?? "");
			let raw = "";
			for await (const chunk of request) raw += chunk;
			const message = raw ? JSON.parse(raw) : {};
			response.setHeader("Content-Type", "application/json");
			if (!("id" in message)) {
				response.writeHead(202).end();
				return;
			}
			response.end(
				JSON.stringify({
					jsonrpc: "2.0",
					id: message.id,
					...(message.method === "initialize"
						? {
								result: {
									protocolVersion: "2025-03-26",
									capabilities: { tools: {} },
									serverInfo: { name: "rpc", version: "1" },
								},
							}
						: { error: { code: -32603, message: `Unavailable: ${token}`, data: { [token]: token } } }),
				}),
			);
		});
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address !== "string");
		const endpoint = `http://127.0.0.1:${address.port}/mcp?token=${token}`;
		const client = new Client({ name: "collision", version: "1" });
		try {
			await client.connect(protectRemoteTransport(new StreamableHTTPClientTransport(new URL(endpoint)), endpoint));
			// Bound malformed-envelope failures rather than waiting for the SDK's 60-second default.
			await assert.rejects(client.listTools({}, { timeout: 500 }), (error: unknown) => {
				assert.ok(error instanceof McpError);
				assert.equal(error.code, -32603);
				assert.match(error.message, /Unavailable: \[redacted\]/);
				assert.deepEqual(error.data, { "[redacted]": "[redacted]" });
				return true;
			});
			assert.ok(paths.every((path) => path === `/mcp?token=${token}`));
		} finally {
			await client.close();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
);

// Regression for #3088: relative request targets retain encoded tokens, unlike searchParams.values().
test.each(["RISK%2FSECRET%2BKEY", "%52ISK%2fSECRET%2bKEY", "RISK+SECRET%2BKEY", "RISK%20SECRET%25KEY", "RISK%SECRET"])(
	"MCP Node RPC errors redact raw and decoded query representations of %s",
	async (token) => {
		const paths: string[] = [];
		const decoded = new URLSearchParams(`token=${token}`).get("token")!;
		const forms = [
			...new Set([
				token,
				decoded,
				encodeURIComponent(decoded),
				new URLSearchParams({ token: decoded }).toString().slice(6),
				encodeURIComponent(decoded).replace(/%[\da-f]{2}/gi, (encodedByte) => encodedByte.toLowerCase()),
			]),
		];
		let fail = false;
		const server = createServer(async (request, response) => {
			paths.push(request.url ?? "");
			let raw = "";
			for await (const chunk of request) raw += chunk;
			const message = raw ? JSON.parse(raw) : {};
			response.setHeader("Content-Type", "application/json");
			if (!("id" in message)) {
				response.writeHead(202).end();
				return;
			}
			response.end(
				JSON.stringify({
					jsonrpc: "2.0",
					id: message.id,
					...(fail
						? {
								error: {
									code: -32603,
									message: `Rejected request ${request.url}; ${forms.join("; ")}`,
									data: {
										requestTarget: request.url,
										nested: forms.map((form) => ({ [form]: form })),
										retryable: false,
									},
								},
							}
						: {
								result:
									message.method === "initialize"
										? {
												protocolVersion: "2025-03-26",
												capabilities: { tools: {} },
												serverInfo: { name: "encoded", version: "1" },
											}
										: { content: [{ type: "text", text: request.url }] },
							}),
				}),
			);
		});
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address !== "string");
		const target = `/mcp?token=${token}&flag=0&flag=`;
		const endpoint = `http://127.0.0.1:${address.port}${target}`;
		const client = new Client({ name: "encoded", version: "1" });
		try {
			await client.connect(protectRemoteTransport(new StreamableHTTPClientTransport(new URL(endpoint)), endpoint));
			assert.deepEqual(await client.callTool({ name: "echo" }), { content: [{ type: "text", text: target }] });
			fail = true;
			await assert.rejects(client.callTool({ name: "echo" }, undefined, { timeout: 500 }), (error: unknown) => {
				assert.ok(error instanceof McpError);
				assert.equal(error.code, -32603);
				for (const form of forms)
					assert.ok(!inspect(error, { depth: null, showHidden: true }).includes(form), form);
				assert.deepEqual(error.data, {
					requestTarget: "/[redacted]?token=[redacted]&flag=[redacted]&flag=",
					nested: forms.map(() => ({ "[redacted]": "[redacted]" })),
					retryable: false,
				});
				return true;
			});
			assert.ok(paths.length > 0);
			assert.ok(paths.every((path) => path === target));
		} finally {
			await client.close();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
);

// Regression for #3088: every path component may be a credential, including common words.
test.each(["PATH_SECRET", "%50ATH%2fSECRET%2bKEY", "mcp", "s", "code", "message", "data"])(
	"MCP Node path diagnostics redact %s without changing requests or successful content",
	async (token) => {
		const paths: string[] = [];
		const decoded = decodeURIComponent(token);
		const forms = [...new Set([token, decoded, encodeURIComponent(decoded)])];
		let fail = false;
		let endpoint = "";
		const server = createServer(async (request, response) => {
			paths.push(request.url ?? "");
			let raw = "";
			for await (const chunk of request) raw += chunk;
			const message = raw ? JSON.parse(raw) : {};
			response.setHeader("Content-Type", "application/json");
			if (!("id" in message)) {
				response.writeHead(202).end();
				return;
			}
			response.end(
				JSON.stringify({
					jsonrpc: "2.0",
					id: message.id,
					...(fail
						? {
								error: {
									code: -32603,
									message: `Unable to process tools; ${endpoint}; ${request.url}; ${forms.join("; ")}`,
									data: {
										requestTarget: request.url,
										nested: forms.map((form) => ({ [form]: form })),
										detail: "messages decoded successfully",
									},
								},
							}
						: {
								result:
									message.method === "initialize"
										? {
												protocolVersion: "2025-03-26",
												capabilities: { tools: {} },
												serverInfo: { name: "path", version: "1" },
											}
										: { content: [{ type: "text", text: endpoint }] },
							}),
				}),
			);
		});
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address !== "string");
		const target = token === "PATH_SECRET" ? `/mcp/s/${token}/mcp` : `/${token}`;
		const safeTarget = target
			.split("/")
			.map((component) => (component ? "[redacted]" : ""))
			.join("/");
		endpoint = `http://127.0.0.1:${address.port}${target}`;
		const client = new Client({ name: "path", version: "1" });
		try {
			await client.connect(protectRemoteTransport(new StreamableHTTPClientTransport(new URL(endpoint)), endpoint));
			assert.deepEqual(await client.callTool({ name: "echo" }), { content: [{ type: "text", text: endpoint }] });
			fail = true;
			const checkError = (error: unknown) => {
				assert.ok(error instanceof McpError);
				assert.equal(error.code, -32603);
				assert.equal(
					error.message,
					`MCP error -32603: Unable to process tools; http://127.0.0.1:${address.port}${safeTarget}; ${safeTarget}; ${forms.map(() => "[redacted]").join("; ")}`,
				);
				assert.deepEqual(error.data, {
					requestTarget: safeTarget,
					nested: forms.map(() => ({ "[redacted]": "[redacted]" })),
					detail: "messages decoded successfully",
				});
				return true;
			};
			await assert.rejects(client.listTools({}, { timeout: 500 }), checkError);
			await assert.rejects(client.callTool({ name: "echo" }, undefined, { timeout: 500 }), checkError);
			assert.ok(paths.every((path) => path === target));
		} finally {
			await client.close();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
);
