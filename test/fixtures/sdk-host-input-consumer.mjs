// #3105 slice C: built-package, non-TTY Node execution. Packed installation is slice H.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@bastani/pi-ai/compat";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from "../../packages/coding-agent/dist/index.js";

assert.equal(process.stdin.isTTY, undefined);
const cwd = await mkdtemp(join(tmpdir(), "atomic-node-host-input-"));
const settingsManager = SettingsManager.inMemory();
let context;
let identity;
let approve;
const host = {
	confirm: async (_title, _message, options) => { identity = options; return new Promise((resolve) => { approve = resolve; }); },
	select: async (_title, choices) => choices[0],
	input: async () => "  raw text\n",
	editor: async () => "",
	questionnaire: async (params, options) => {
		assert.equal(options.sessionId, session.sessionId);
		return { cancelled: false, answers: [{ questionIndex: 0, question: params.questions[0].question, kind: "custom", answer: "  raw text\n" }] };
	},
};
const loader = new DefaultResourceLoader({ cwd, agentDir: join(cwd, "agent"), settingsManager, noExtensions: true, noContextFiles: true,
	extensionFactories: [(pi) => { pi.on("session_start", (_event, ctx) => { context = ctx; }); }],
});
let session;
try {
	await loader.reload();
	({ session } = await createAgentSession({ cwd, agentDir: join(cwd, "agent"), settingsManager, resourceLoader: loader,
		model: getModel("anthropic", "claude-sonnet-4-5"), sessionManager: SessionManager.inMemory(cwd),
		builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false }, extensionBindings: { humanInput: host },
	}));
	assert.equal(context.hasUI, false);
	assert.equal(context.hasHumanInput, true);
	const tool = session.agent.state.tools.find((entry) => entry.name === "ask_user_question");
	const params = { questions: [{ question: "Choose?", header: "Choice", options: [{ label: "A", description: "" }, { label: "B", description: "" }] }] };
	const result = await tool.execute("node-question", params, new AbortController().signal);
	assert.equal(result.details.answers[0].answer, "  raw text\n");
	const pending = context.ui.confirm("Approve?", "Effect");
	const refused = assert.rejects(pending, { code: "HumanInputCancelled" });
	await session.abort();
	await refused;
	assert.equal(identity.signal.aborted, true);
	approve(true);
	await session.bindExtensions({ humanInput: null });
	assert.deepEqual((await tool.execute("unavailable", params, new AbortController().signal)).details, { answers: [], cancelled: true, error: "no_ui" });
} finally {
	session?.dispose();
	await rm(cwd, { recursive: true, force: true });
}
