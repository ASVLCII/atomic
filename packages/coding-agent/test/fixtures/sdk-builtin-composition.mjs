import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #3105: built-package Node smoke, without a CLI, TTY, inference, or forced exit.
const cwd = await mkdtemp(join(tmpdir(), "atomic-sdk-composition-"));
process.env.ATOMIC_CODING_AGENT_DIR = join(cwd, "agent");
const { AgentSession, createAgentSession, SessionManager } = await import("../../dist/index.js");
try {
	const { session, extensionsResult } = await createAgentSession({
		cwd,
		agentDir: join(cwd, "agent"),
		sessionManager: SessionManager.inMemory(cwd),
	});
	try {
		assert.ok(session instanceof AgentSession);
		assert.equal(extensionsResult.errors.length, 0);
		for (const name of ["read", "ask_user_question", "todo", "workflow", "subagent", "mcp", "intercom", "web_search"]) {
			assert.ok(session.getActiveToolNames().includes(name), name);
		}
		assert.ok(session.resourceLoader.getSkills().skills.length > 0);
		await session.bindExtensions({});
		console.log("SDK builtin composition: PASS");
	} finally {
		// The full awaited dispose contract is a later slice. Use today's host cleanup.
		await session.closeSessionTasks();
		await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		session.dispose();
	}
	const { session: suppressed } = await createAgentSession({
		cwd,
		agentDir: join(cwd, "agent"),
		sessionManager: SessionManager.inMemory(cwd),
		builtins: { intercom: false, "web-access": false },
		tools: ["read", "intercom"],
		noTools: "all",
	});
	try {
		for (let generation = 0; generation < 2; generation++) {
			assert.deepEqual(suppressed.getActiveToolNames(), []);
			assert.deepEqual(suppressed.getAllTools(), []);
			assert.equal(suppressed.resourceLoader.getExtensions().extensions.length, 3);
			assert.ok(suppressed.resourceLoader.getSkills().skills.length > 0);
			if (generation === 0) await suppressed.reload();
		}
		console.log("SDK builtin suppression: PASS");
	} finally {
		await suppressed.closeSessionTasks();
		await suppressed.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		suppressed.dispose();
	}
} finally {
	await rm(cwd, { recursive: true, force: true });
}
