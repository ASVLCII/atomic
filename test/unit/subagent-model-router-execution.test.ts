// #3090: public single/parallel execution door, mock inference and child runtime only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@bastani/atomic";
import { createAssistantMessageEventStream } from "@bastani/pi-ai";
import { afterEach, beforeEach, test, vi } from "vitest";
import { AgentTaskHost } from "../../packages/coding-agent/src/core/tasks/agent-adapter.js";
import type { AgentConfig } from "../../packages/subagents/src/agents/agents.js";
import { createSubagentExecutor } from "../../packages/subagents/src/runs/foreground/subagent-executor.js";
import type {
	ExecutorDeps,
	SubagentParamsLike,
} from "../../packages/subagents/src/runs/foreground/subagent-executor-types.js";
import type { RunSyncOptions, SingleResult } from "../../packages/subagents/src/shared/types.js";
import {
	decisionMessage,
	decisionModel,
	messageStream,
	registeredDecisionRuntime,
} from "../helpers/structured-output.js";

const dirs: string[] = [];
beforeEach(() => vi.stubEnv("TYPESAFE_AI_API_KEY", ""));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
async function fixture(model?: string) {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-auto-router-"));
	dirs.push(cwd);
	const agent: AgentConfig = {
		name: "worker",
		description: "Implement approved changes",
		model,
		systemPrompt: "Self-contained task: review only",
		systemPromptMode: "replace",
		inheritProjectContext: false,
		inheritSkills: false,
		source: "project",
		filePath: join(cwd, "worker.md"),
	};
	const infer = vi.fn<Parameters<typeof registeredDecisionRuntime>[0]>(() =>
		messageStream(decisionMessage({ model: "decision-test/chat", effort: null })),
	);
	const { registry } = await registeredDecisionRuntime(infer);
	const runSync = vi.fn(
		async (
			_cwd: string,
			_agents: AgentConfig[],
			_name: string,
			task: string,
			_options: RunSyncOptions,
		): Promise<SingleResult> => ({
			agent: "worker",
			task,
			status: "ok",
			messages: [],
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
			finalOutput: "done",
		}),
	);
	const ctx = {
		cwd,
		model: decisionModel,
		thinkingLevel: "low",
		modelRegistry: registry,
		getRouterModel: () => "decision-test/chat",
		sessionManager: {
			getSessionFile: () => join(cwd, "session.jsonl"),
			getSessionId: () => "parent",
			getLeafId: () => null,
		},
		isProjectTrusted: () => true,
		hasUI: false,
	} as unknown as ExtensionContext;
	const executor = createSubagentExecutor({
		pi: {
			events: { on: () => () => {}, emit: () => {} },
			getSessionName: () => "parent",
		} as unknown as ExecutorDeps["pi"],
		state: {
			baseCwd: "",
			currentSessionId: null,
			subagentInProgress: false,
			foregroundControls: new Map(),
			lastForegroundControlId: null,
			pendingForegroundControlNotices: new Map(),
			lastUiContext: null,
		},
		config: { intercomBridge: { mode: "off" }, parallel: { concurrency: 4, maxTasks: 50 } },
		tempArtifactsDir: join(cwd, "artifacts"),
		getSubagentSessionRoot: () => join(cwd, "sessions"),
		expandTilde: (value) => value,
		discoverAgents: () => ({ agents: [agent] }),
		runtime: { runSync },
	});
	return {
		agent,
		ctx,
		infer,
		runSync,
		call: (params: SubagentParamsLike, signal = new AbortController().signal) =>
			executor.execute("auto-test", params, signal, undefined, ctx),
	};
}
for (const mode of ["single-explicit", "single-default", "parallel-explicit", "parallel-default"] as const) {
	test(`${mode} routes effective auto before child admission`, async () => {
		const f = await fixture(mode.endsWith("default") ? "auto" : undefined);
		const explicit = mode.endsWith("explicit") ? { model: "auto" } : {};
		const params = mode.startsWith("single")
			? { agent: "worker", task: "Inspect this patch", ...explicit }
			: { tasks: [{ agent: "worker", task: "Inspect this patch", ...explicit }] };
		const entered = Promise.withResolvers<void>();
		const stream = createAssistantMessageEventStream();
		f.infer.mockImplementation(() => {
			entered.resolve();
			return stream;
		});
		const pending = f.call(params);
		await entered.promise;
		assert.equal(f.runSync.mock.calls.length, 0);
		stream.push({
			type: "done",
			reason: "toolUse",
			message: decisionMessage({ model: "decision-test/chat", effort: null }),
		});
		const result = await pending;
		assert.notEqual(result.isError, true);
		assert.equal(f.runSync.mock.calls.length, 1);
		const options = f.runSync.mock.calls[0]![4];
		assert.equal(options.modelOverride, "decision-test/chat");
		assert.deepEqual(options.modelRoute?.routerSelection, { model: "decision-test/chat", effort: null });
	});
}
test("concrete overrides and ordinary omission bypass inference with existing effort intact", async () => {
	const f = await fixture("auto");
	await f.call({ agent: "worker", task: "Inspect", model: "decision-test/chat:off" });
	assert.equal(f.infer.mock.calls.length, 0);
	assert.equal(f.runSync.mock.calls[0]![4].modelOverride, "decision-test/chat:off");
	f.agent.model = undefined;
	await f.call({ agent: "worker", task: "Inspect" });
	assert.equal(f.infer.mock.calls.length, 0);
	assert.equal(f.runSync.mock.calls[1]![4].modelOverride, undefined);
});
test("parallel tasks do not share the first decision", async () => {
	const f = await fixture("auto");
	const second = { ...decisionModel, id: "other" };
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([decisionModel, second]);
	f.infer.mockImplementation((_model, context) =>
		messageStream(
			decisionMessage({
				model: JSON.parse(context.messages[0]!.content as string).state.task.includes("second")
					? "decision-test/other"
					: "decision-test/chat",
				effort: null,
			}),
		),
	);
	await f.call({
		tasks: [
			{ agent: "worker", task: "first task" },
			{ agent: "worker", task: "second task" },
		],
	});
	assert.deepEqual(
		f.runSync.mock.calls.map((call) => call[4].modelOverride),
		["decision-test/chat", "decision-test/other"],
	);
	assert.equal(f.infer.mock.calls.length, 2);
});
test("invalid routing and conflicting constraints produce no child runs", async () => {
	const f = await fixture("auto");
	f.infer.mockImplementation(() => messageStream(decisionMessage({ model: "auto", effort: null })));
	const invalid = await f.call({ agent: "worker", task: "Inspect" });
	assert.equal(invalid.isError, true);
	assert.equal(f.runSync.mock.calls.length, 0);
	f.agent.modelConstraints = { allowedModels: ["private/model"] };
	const denied = await f.call({
		agent: "worker",
		task: "Inspect",
		modelConstraints: { allowedModels: ["decision-test/chat"] },
	});
	assert.equal(denied.isError, true);
	assert.equal(f.runSync.mock.calls.length, 0);
});
test("router cancellation cannot admit a child through a late result", async () => {
	const f = await fixture("auto");
	const controller = new AbortController();
	const entered = Promise.withResolvers<void>();
	const stream = createAssistantMessageEventStream();
	f.infer.mockImplementation(() => {
		entered.resolve();
		return stream;
	});
	const pending = f.call({ agent: "worker", task: "Inspect" }, controller.signal);
	await entered.promise;
	controller.abort();
	stream.push({
		type: "done",
		reason: "toolUse",
		message: decisionMessage({ model: "decision-test/chat", effort: null }),
	});
	await pending;
	assert.equal(f.runSync.mock.calls.length, 0);
});

test("host status retains immutable original selection separately from actual fallback model and effort", async () => {
	const f = await fixture("auto");
	const host = new AgentTaskHost({ scope: { kind: "session", sessionId: randomUUID() }, authorizeLaunch() {} });
	f.ctx.getAgentTaskHost = () => host;
	f.runSync.mockImplementation(async (_cwd, _agents, _name, task) => ({
		agent: "worker",
		task,
		status: "ok",
		model: "fallback/model",
		thinking: "low",
		messages: [],
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
		finalOutput: "done",
	}));
	try {
		const result = await f.call({ agent: "worker", task: "Inspect", wait: { kind: "foreground" } });
		assert.notEqual(result.isError, true);
		const watched = host.watchOwnerTasks();
		assert.ok(watched.ok);
		const record = watched.value.snapshot.tasks[0]!;
		assert.deepEqual(record.routerSelection, { model: "decision-test/chat", effort: null });
		assert.equal(Object.isFrozen(record.routerSelection), true);
		assert.equal(record.model, "fallback/model");
		assert.equal(record.thinking, "low");
		watched.value.dispose();
	} finally {
		await host.close("session-close");
	}
});
