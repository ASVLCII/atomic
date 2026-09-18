import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createAgentSession, createAgentSessionRuntime, SessionManager, SettingsManager } from "@bastani/atomic";

// #3105: actual package export and built builtin assets under non-TTY Node.
assert.equal(process.versions.bun, undefined);
assert.ok(import.meta.resolve("@bastani/atomic").endsWith("/dist/index.js"));
assert.ok(!process.stdin.isTTY && !process.stdout.isTTY);
const cwd = mkdtempSync(join(tmpdir(), "atomic-built-host-"));
const source = readFileSync(new URL("./sdk-host-durable-workflow.ts", import.meta.url));
const hash = createHash("sha256").update(source).digest("hex");
const directory = join(cwd, ".atomic", "workflows");
mkdirSync(directory, { recursive: true });
const definition = join(directory, "sdk-host-durable.ts");
writeFileSync(definition, source);
process.env.ATOMIC_FAULT_TEST_HOME = cwd;
const identities = [];
const text = "  durable text  ";
const options = {
	cwd,
	agentDir: join(cwd, "agent"),
	sessionManager: SessionManager.inMemory(cwd),
	settingsManager: SettingsManager.inMemory(),
	builtins: { subagents: false, mcp: false, intercom: false, "web-access": false },
};
const bindings = {
	humanInput: {
		input: async (_title, _placeholder, options) => { identities.push(options); return text; },
		confirm: async (_title, _message, options) => { identities.push(options); return true; },
		select: async () => undefined,
		editor: async () => undefined,
		questionnaire: async () => ({ answers: [], cancelled: true }),
	},
};
// D isolates host routing. Existing runtime shutdown emits session_shutdown;
// session.dispose alone does not yet release DBOS (tracked for F/H).
const runtime = await createAgentSessionRuntime(async (target) => {
	const result = await createAgentSession({ ...options, ...target });
	return { ...result, diagnostics: [], services: {
		cwd: target.cwd, agentDir: target.agentDir,
		modelRuntime: result.session.modelRuntime,
		settingsManager: options.settingsManager,
		resourceLoader: result.session.resourceLoader,
		diagnostics: [],
	} };
}, options);
const { session } = runtime;
try {
	await session.prompt("/workflow sdk-host-durable --no-picker");
	const tool = session.agent.state.tools.find((entry) => entry.name === "workflow");
	assert.ok(tool);
	const pendingDeadline = Date.now() + 10_000;
	let pending;
	do {
		pending = (await tool.execute("pending", { action: "status" }, new AbortController().signal)).details;
		if (pending.runs[0]?.awaitingInputCount === 1) break;
		await sleep(20);
	} while (Date.now() < pendingDeadline);
	assert.equal(pending.runs[0]?.awaitingInputCount, 1, JSON.stringify(pending));
	assert.equal(pending.runs[0]?.status, "running");
	assert.match(JSON.stringify(pending), /"promptKind":"input"/);
	assert.equal(existsSync(join(cwd, "effects.jsonl")), false);
	await session.bindExtensions(bindings);
	const deadline = Date.now() + 10_000;
	let details;
	do {
		details = (await tool.execute("status", { action: "status" }, new AbortController().signal)).details;
		if (details.runs[0]?.status === "completed") break;
		await sleep(20);
	} while (Date.now() < deadline);
	assert.equal(details.runs[0]?.status, "completed", JSON.stringify(details));
	assert.deepEqual(details.snapshots[0].result, { text, approved: true });
	assert.equal(identities.length, 2);
	assert.notEqual(identities[0].requestId, identities[1].requestId);
	for (const identity of identities) {
		assert.ok(identity.sessionId && identity.workflowRunId && identity.workflowStageId);
	}
	assert.equal(readFileSync(join(cwd, "receipts.jsonl"), "utf8"), `${JSON.stringify({ text })}\n`);
	assert.equal(readFileSync(join(cwd, "effects.jsonl"), "utf8"), `${JSON.stringify({ text })}\n`);
	assert.equal(createHash("sha256").update(readFileSync(definition)).digest("hex"), hash);
	console.log(JSON.stringify({ host: "built-node", initiallyPending: true, hash, result: details.snapshots[0].result, effects: 1 }));
} finally {
	await runtime.dispose();
	rmSync(cwd, { recursive: true, force: true });
}
