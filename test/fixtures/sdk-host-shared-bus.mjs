import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createAgentSession, createEventBus, DefaultResourceLoader, SessionManager, SettingsManager } from "@bastani/atomic";

// #3105: actual built workflows must retain independent ownership on a borrowed bus.
assert.equal(process.versions.bun, undefined);
assert.ok(import.meta.resolve("@bastani/atomic").endsWith("/dist/index.js"));
const root = mkdtempSync(join(tmpdir(), "atomic-shared-bus-"));
process.env.ATOMIC_FAULT_TEST_HOME = root;
const eventBus = createEventBus();
const scopes = [];
const shared = process.argv[2] === "loader";
const settingsManager = SettingsManager.inMemory();
let borrowedLoader;
async function create(name) {
	const cwd = join(root, shared ? "shared" : name);
	mkdirSync(join(cwd, ".atomic", "workflows"), { recursive: true });
	writeFileSync(join(cwd, ".atomic", "workflows", "sdk-host-durable.ts"), readFileSync(new URL("./sdk-host-durable-workflow.ts", import.meta.url)));
	const resourceLoader = borrowedLoader ?? new DefaultResourceLoader({
		cwd, agentDir: join(cwd, "agent"), settingsManager, eventBus, noExtensions: true, noContextFiles: true,
		extensionFactories: [(pi) => { pi.on("session_start", () => { scopes.push(pi.lifecycleScope); }); }],
	});
	if (!borrowedLoader) await resourceLoader.reload();
	if (shared) borrowedLoader = resourceLoader;
	return (await createAgentSession({
		cwd, agentDir: join(cwd, "agent"), settingsManager, resourceLoader, sessionManager: SessionManager.inMemory(cwd),
		builtins: { subagents: false, mcp: false, intercom: false, "web-access": false },
	})).session;
}
const a = await create("a");
let b;
try {
	b = await create("b");
	assert.notEqual(scopes[0], scopes[1]);
	await a.prompt("/workflow sdk-host-durable --no-picker");
	let tool = a.agent.state.tools.find((entry) => entry.name === "workflow");
	assert.ok(tool);
	const status = async () => (await tool.execute("status", { action: "status" }, new AbortController().signal)).details;
	const deadline = Date.now() + 10_000;
	let before;
	do {
		before = await status();
		if (before.runs[0]?.awaitingInputCount === 1) break;
		await sleep(20);
	} while (Date.now() < deadline);
	assert.equal(before.runs[0]?.awaitingInputCount, 1, JSON.stringify(before));
	await b.reload();
	assert.equal(scopes[2], scopes[1]);
	await b.dispose();
	const after = await status();
	assert.equal(after.runs[0]?.status, "running", JSON.stringify(after));
	assert.equal(after.runs[0]?.awaitingInputCount, 1);
	await a.reload();
	tool = a.agent.state.tools.find((entry) => entry.name === "workflow");
	assert.ok(tool);
	assert.equal(scopes[3], scopes[0]);
	assert.equal((await status()).runs[0]?.status, "running");
	console.log(JSON.stringify({ distinctOwners: true, siblingReloadedAndClosed: true, retained: "running" }));
} finally {
	await a.dispose();
	await b?.dispose();
	rmSync(root, { recursive: true, force: true });
}
