import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #3105: shared borrowed discovery, real HTTP extraction, non-TTY Node, natural exit.
const root = mkdtempSync(join(tmpdir(), "sdk-web-owners-"));
process.env.ATOMIC_CODING_AGENT_DIR = join(root, "agent");
const sessions = [];
let heldResponse;
let entered;
const suspended = new Promise(resolve => { entered = resolve; });
const text = "Owner-local web content. ".repeat(100);
const server = createServer((request, response) => {
	if (request.url === "/held") { heldResponse = response; entered(); return; }
	response.writeHead(200, { "Content-Type": "text/plain" }).end(text);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
	const { createAgentSession, DefaultResourceLoader, getBuiltinPackagePaths, ModelRuntime, SessionManager, SettingsManager } = await import("@bastani/atomic");
	const builtins = { workflows: false, subagents: false, mcp: false, intercom: false };
	const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth"), modelsPath: null, allowModelNetwork: false });
	const resourceLoader = new DefaultResourceLoader({ cwd: root, agentDir: join(root, "agent"), settingsManager: SettingsManager.inMemory(), builtinPackagePaths: getBuiltinPackagePaths(builtins) });
	await resourceLoader.reload();
	for (let index = 0; index < 2; index++) {
		const cwd = join(root, String(index));
		mkdirSync(cwd);
		const { session } = await createAgentSession({ cwd, agentDir: join(root, "agent"), resourceLoader, modelRuntime, builtins,
			settingsManager: SettingsManager.inMemory({ sessionSummary: { enabled: false } }), sessionManager: SessionManager.inMemory(cwd) });
		sessions.push(session);
	}
	const address = server.address();
	const url = `http://127.0.0.1:${address.port}`;
	const tool = (session, name) => session.agent.state.tools.find(entry => entry.name === name);
	const read = (session, responseId) => tool(session, "get_search_content").execute("read", { responseId, urlIndex: 0 }, new AbortController().signal);
	const fetched = await tool(sessions[0], "fetch_content").execute("fetch", { urls: [`${url}/content`] }, new AbortController().signal);
	assert.equal(fetched.details.successful, 1, JSON.stringify(fetched));
	const firstId = fetched.details.responseId;
	assert.match(JSON.stringify(fetched.content), /Owner-local web content/);
	const invisible = await read(sessions[1], firstId);
	assert.match(JSON.stringify(invisible.content), /No stored results/);
	assert.match(JSON.stringify((await read(sessions[0], firstId)).content), /Owner-local web content/);
	const pending = tool(sessions[0], "fetch_content").execute("held", { urls: [`${url}/held`] }, new AbortController().signal);
	await suspended;
	await sessions[1].reload();
	await Promise.all([sessions[1].dispose(), sessions[1].dispose()]);
	heldResponse.writeHead(200, { "Content-Type": "text/plain" }).end(text);
	const completed = await pending;
	assert.equal(completed.details.successful, 1, JSON.stringify(completed));
	assert.match(JSON.stringify((await read(sessions[0], firstId)).content), /Owner-local web content/);
	assert.match(JSON.stringify((await read(sessions[0], completed.details.responseId)).content), /Owner-local web content/);
	await sessions[0].dispose();
	console.log(JSON.stringify({ verified: true }));
} finally {
	heldResponse?.end();
	await Promise.all(sessions.map(session => session.dispose()));
	await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	rmSync(root, { recursive: true, force: true });
}
