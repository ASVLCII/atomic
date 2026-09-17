// #3089: exercise the registered model-tool door, real dispatcher/admission, and mocked inference.
import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@bastani/pi-ai";
import { Type } from "typebox";
import { afterEach, beforeEach, test, vi } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { InMemoryDurableBackend } from "../../packages/workflows/src/durable/backend.js";
import * as durableFactory from "../../packages/workflows/src/durable/factory.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { run } from "../../packages/workflows/src/engine/run.js";
import { withWorkflowDefaults } from "../../packages/workflows/src/extension/config-loader.js";
import type { WorkflowToolArgs } from "../../packages/workflows/src/extension/public-types.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import { registerWorkflowSlashCommand } from "../../packages/workflows/src/extension/workflow-command-registration.js";
import type { WorkflowCommandHandler } from "../../packages/workflows/src/extension/workflow-command-utils.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import { registerWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool-registration.js";
import { createJobTracker } from "../../packages/workflows/src/runs/background/job-tracker.js";
import { resolve_budget } from "../../packages/workflows/src/shared/budget.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import type { WorkflowBudget } from "../../packages/workflows/src/shared/types.js";
import { createRegistry } from "../../packages/workflows/src/workflows/registry.js";
import { decisionMessage, decisionModel, messageStream } from "../helpers/structured-output.js";
import { workflowRouterContext, workflowRouterState } from "../helpers/workflow-router.js";

beforeEach(() => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
});
afterEach(() => {
	setDurableBackend(undefined);
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function fixture(budget?: WorkflowBudget) {
	const backend = new InMemoryDurableBackend();
	setDurableBackend(backend);
	const admissions = vi.spyOn(backend, "registerWorkflow");
	const store = createStore();
	const jobs = createJobTracker();
	const body = vi.fn(async () => ({}));
	const definition = workflow({
		name: "approved-change",
		description: "Implement approved changes with validation",
		inputs: { task: Type.String() },
		outputs: {},
		budget: { maxTokens: 500, maxDurationMs: 100000 },
		run: async (ctx) => ctx.tool("apply", {}, body),
	});
	const other = workflow({
		name: "review-only",
		description: "Independent review without changes",
		inputs: { patch: Type.String() },
		outputs: {},
		run: async (ctx) => ctx.tool("review", {}, body),
	});
	let registry = createRegistry().register(definition).register(other);
	let runtime = createExtensionRuntime({
		registry,
		store,
		jobs,
		config: withWorkflowDefaults({ budget: { maxCost: 1.25 } }),
	});
	const execute = makeExecuteWorkflowTool(
		() => runtime,
		() => undefined,
	);
	const tool = registerWorkflowTool({ registerTool: () => {} }, execute, async (_policy, run) => run())!;
	const ctx = workflowRouterContext(definition.normalizedName, budget);
	const infer = vi.spyOn(ctx.modelRegistry!, "streamSimple");
	const args: WorkflowToolArgs = {
		action: "run",
		workflow: definition.name,
		inputs: { task: "Approved work" },
		state: workflowRouterState(budget),
		...(budget === undefined ? {} : { budget }),
	};
	return {
		backend,
		admissions,
		store,
		jobs,
		body,
		definition,
		other,
		ctx,
		infer,
		args,
		execute,
		get runtime() {
			return runtime;
		},
		call: (input = args, signal?: AbortSignal) => tool.execute("route", input, signal, undefined, ctx),
		replace: (next = registry.register({ ...definition, description: "Changed contract" })) => {
			registry = next;
			runtime = createExtensionRuntime({
				registry,
				store,
				jobs,
				config: withWorkflowDefaults({ budget: { maxCost: 1.25 } }),
			});
		},
		noLaunch: () => {
			assert.equal(admissions.mock.calls.length, 0);
			assert.equal(body.mock.calls.length, 0);
			assert.equal(store.runs().length, 0);
			assert.equal(jobs.runIds().length, 0);
		},
	};
}

for (const action of ["run", undefined] as const) {
	test(`valid none returns structured inline guidance and zero launches (${action ?? "default"})`, async () => {
		const f = fixture();
		f.infer.mockImplementation(() => messageStream(decisionMessage({ workflowType: "none", maxBudget: {} })));
		const result = await f.call({ ...f.args, action });
		assert.equal(result.details.action, "run");
		assert.ok("routerDecision" in result.details);
		assert.deepEqual(result.details.routerDecision, { workflowType: "none", maxBudget: {} });
		assert.equal(result.details.runId, "");
		assert.equal(result.details.status, "not_launched");
		assert.match(
			result.content[0]!.type === "text" ? result.content[0].text : "",
			/Continue the requested task inline/,
		);
		assert.deepEqual(JSON.parse(result.content[0]!.text as string).routerDecision, result.details.routerDecision);
		f.noLaunch();
		assert.equal(f.infer.mock.calls.length, 1);
	});
}

test("matching selection waits for approval, preserves launch metadata and receives complete state", async () => {
	const f = fixture();
	const stream = createAssistantMessageEventStream();
	const entered = Promise.withResolvers<void>();
	f.infer.mockImplementation((_model, context, options) => {
		assert.equal(options?.maxRetries, 0);
		const state = JSON.parse(context.messages[0]!.content as string).state;
		assert.deepEqual(state.task, f.args.state);
		assert.deepEqual(state.proposed, { workflow: f.definition.normalizedName, inputs: f.args.inputs });
		assert.deepEqual(
			state.workflows.map((d: { name: string }) => d.name),
			["approved-change", "review-only"],
		);
		assert.equal(state.workflows[0].inputs.task.type, "string");
		assert.equal(state.budgets.configuration.maxCost, 1.25);
		assert.equal(state.workflows[0].budget.maxDurationMs, 100000);
		assert.match(context.systemPrompt ?? "", /intentional inline route/);
		entered.resolve();
		return stream;
	});
	const pending = f.call();
	await entered.promise;
	f.noLaunch();
	const message = decisionMessage({ workflowType: "approved-change", maxBudget: {} });
	stream.push({ type: "done", reason: "toolUse", message });
	const result = await pending;
	assert.ok("routerDecision" in result.details);
	assert.deepEqual(result.details.routerDecision, { workflowType: "approved-change", maxBudget: {} });
	assert.ok(result.details.runId);
	await f.jobs.get(result.details.runId)!.promise;
	assert.equal(f.body.mock.calls.length, 1);
	assert.ok(f.admissions.mock.calls.length > 0);
	assert.equal(f.infer.mock.calls.length, 1);
	assert.equal(f.ctx.model, decisionModel);
});

test("different selection returns its decision without stale-input execution", async () => {
	const f = fixture();
	f.infer.mockImplementation(() => messageStream(decisionMessage({ workflowType: "review-only", maxBudget: {} })));
	const result = await f.call();
	assert.ok("routerDecision" in result.details);
	assert.equal(result.details.routerDecision?.workflowType, "review-only");
	assert.equal(result.details.status, "not_launched");
	assert.match(result.details.message ?? "", /prepare fresh state/);
	f.noLaunch();
});

for (const value of [
	{},
	{ workflowType: "unregistered", maxBudget: {} },
	{ workflowType: "approved-change", maxBudget: {}, extra: true },
	{ workflowType: "approved-change", maxBudget: { maxDurationMs: -1 } },
	{ workflowType: "approved-change", maxBudget: { maxTokens: 1.5 } },
	{ workflowType: "approved-change", maxBudget: { maxCost: null } },
	{ workflowType: "approved-change", maxBudget: { extra: 1 } },
	{ workflowType: "approved-change", maxBudget: { maxTokens: 0 } },
]) {
	test(`invalid decision fails closed without fabricating routerDecision: ${JSON.stringify(value)}`, async () => {
		const f = fixture();
		f.infer.mockImplementation(() => messageStream(decisionMessage(value)));
		const result = await f.call();
		assert.equal("routerDecision" in result.details, false);
		assert.equal("status" in result.details ? result.details.status : "", "failed");
		f.noLaunch();
		assert.equal(f.infer.mock.calls.length, 1);
	});
}

test("missing state and credential fields fail before inference", async () => {
	const f = fixture();
	const missing = await f.call({ ...f.args, state: undefined });
	assert.match("error" in missing.details ? (missing.details.error ?? "") : "", /complete top-level state/);
	const secret = await f.call({ ...f.args, inputs: { task: "approved", apiKey: "do-not-send" } });
	assert.match("error" in secret.details ? (secret.details.error ?? "") : "", /credential field/);
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
});

test("explicit inline preference cannot be overridden by a workflow decision", async () => {
	const f = fixture();
	f.args.state!.executionPreference = "inline";
	const result = await f.call();
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /cannot override.*inline/);
	f.noLaunch();
});

for (const budget of [
	{},
	{ maxTokens: 0 },
	{ maxCost: 0.123456789, maxTokens: 1234567, maxDurationMs: 9876543210, warnAtPercent: 12.345 },
] satisfies WorkflowBudget[]) {
	test(`exact canonical budget and inheritance survive launch: ${JSON.stringify(budget)}`, async () => {
		const f = fixture(budget);
		const result = await f.call();
		assert.ok("routerDecision" in result.details);
		assert.deepEqual(result.details.routerDecision?.maxBudget, budget);
		await f.jobs.get(result.details.runId)!.promise;
		const expected = resolve_budget({ config: { maxCost: 1.25 }, definition: f.definition.budget, run: budget });
		assert.deepEqual(f.store.runs()[0]!.budget, { ...expected });
	});
}

test("none preserves zero and omitted fields in its structured decision", async () => {
	const f = fixture({ maxTokens: 0 });
	f.infer.mockImplementation(() =>
		messageStream(decisionMessage({ workflowType: "none", maxBudget: { maxTokens: 0 } })),
	);
	const result = await f.call();
	assert.ok("routerDecision" in result.details);
	assert.deepEqual(result.details.routerDecision, { workflowType: "none", maxBudget: { maxTokens: 0 } });
	f.noLaunch();
});

test("user limits cannot be expanded, disabled, rounded, omitted or lack provenance", async () => {
	for (const maxBudget of [{}, { maxCost: 0 }, { maxCost: 1.24 }, { maxCost: 2 }]) {
		const f = fixture({ maxCost: 1.23456789 });
		f.infer.mockImplementation(() => messageStream(decisionMessage({ workflowType: "approved-change", maxBudget })));
		const result = await f.call();
		assert.equal("routerDecision" in result.details, false);
		f.noLaunch();
	}
	const f = fixture();
	await f.call({ ...f.args, budget: { maxTokens: 10 } });
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
});

for (const setting of ["auto", "missing/model", " decision-test/chat"]) {
	test(`invalid explicit routerModel ${setting} never falls back`, async () => {
		const f = fixture();
		vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
		f.ctx.getRouterModel = () => setting;
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const result = await f.call();
		assert.match("error" in result.details ? (result.details.error ?? "") : "", /Invalid routerModel/);
		assert.equal(fetch.mock.calls.length, 0);
		assert.equal(f.infer.mock.calls.length, 0);
		f.noLaunch();
	});
}

test("cancellation and late approval cannot start a run", async () => {
	const f = fixture();
	const entered = Promise.withResolvers<void>();
	const stream = createAssistantMessageEventStream();
	f.infer.mockImplementation(() => {
		entered.resolve();
		return stream;
	});
	const controller = new AbortController();
	const pending = f.call(f.args, controller.signal);
	await entered.promise;
	controller.abort(new Error("cancel routing"));
	await assert.rejects(pending, /cancel routing/);
	stream.push({
		type: "done",
		reason: "toolUse",
		message: decisionMessage({ workflowType: "approved-change", maxBudget: {} }),
	});
	await Promise.resolve();
	f.noLaunch();
	assert.equal(f.infer.mock.calls.length, 1);
});

test("bounded timeout does not turn a late response into none or a launch", async () => {
	vi.useFakeTimers();
	const f = fixture();
	const stream = createAssistantMessageEventStream();
	f.infer.mockImplementation(() => stream);
	const pending = f.call();
	await vi.advanceTimersByTimeAsync(30001);
	const result = await pending;
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /timed out/);
	assert.equal("routerDecision" in result.details, false);
	f.noLaunch();
	stream.push({
		type: "done",
		reason: "toolUse",
		message: decisionMessage({ workflowType: "approved-change", maxBudget: {} }),
	});
	await vi.advanceTimersByTimeAsync(0);
	f.noLaunch();
});

test("overlapping decisions reject same-name replacement and removed registry generations", async () => {
	const f = fixture();
	const streams = [createAssistantMessageEventStream(), createAssistantMessageEventStream()];
	const entered = Promise.withResolvers<void>();
	let count = 0;
	f.infer.mockImplementation(() => {
		const stream = streams[count++]!;
		if (count === 2) entered.resolve();
		return stream;
	});
	const first = f.call();
	const second = f.call();
	await entered.promise;
	f.replace();
	for (const stream of streams)
		stream.push({
			type: "done",
			reason: "toolUse",
			message: decisionMessage({ workflowType: "approved-change", maxBudget: {} }),
		});
	for (const result of await Promise.all([first, second]))
		assert.match("error" in result.details ? (result.details.error ?? "") : "", /registry changed/);
	f.noLaunch();
	assert.equal(f.infer.mock.calls.length, 2);
});

test("sentinel collision fails closed without hiding a registered workflow", async () => {
	const f = fixture();
	f.replace(
		createRegistry()
			.register(f.definition)
			.register({ ...f.other, name: "none", normalizedName: "none" }),
	);
	const result = await f.call();
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /collides.*sentinel/);
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
});

test("user /workflow command bypasses inference and state preparation", async () => {
	const f = fixture();
	const commands = new Map<string, WorkflowCommandHandler>();
	registerWorkflowSlashCommand({}, commands, {
		runtimeProxy: f.runtime,
		runtimeForContext: () => f.runtime,
		overlay: { open() {}, dispose() {} } as never,
		reloadWorkflowResources: () => undefined,
		ensureWorkflowResourcesLoaded: () => {},
		runWithLifecycleSuppressedForPolicy: async (_policy, execute) => execute(),
		runControl: {} as never,
	});
	await commands.get("workflow")!("approved-change task=Approved", { ...f.ctx, ui: { notify() {} } });
	await Promise.all(f.jobs.runIds().map((id) => f.jobs.get(id)!.promise));
	assert.equal(f.body.mock.calls.length, 1);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("programmatic ctx.workflow composition is not model-tool routed", async () => {
	const f = fixture();
	const parent = workflow({
		name: "composed",
		description: "Composition",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.workflow(f.definition, { inputs: { task: "Approved" }, stageName: "child" });
			return {};
		},
	});
	const result = await run(parent, {}, { store: f.store, durableBackend: f.backend });
	assert.equal(result.status, "completed", result.error);
	assert.equal(f.body.mock.calls.length, 1);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("inspection/control bypass routing and stage calls remain forbidden", async () => {
	const f = fixture();
	await f.execute({ action: "list" }, {});
	await f.execute({ action: "inputs", workflow: "approved-change" }, {});
	await f.execute({ action: "reload" }, {});
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
	const result = await f.execute(f.args, { ...f.ctx, orchestrationContext: { kind: "workflow-stage" } as never });
	assert.match("error" in result ? (result.error ?? "") : "", /cannot invoke workflows/);
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
});

test("normal input validation follows matching approval but precedes admission", async () => {
	const f = fixture();
	const result = await f.call({ ...f.args, inputs: {} });
	assert.ok("routerDecision" in result.details);
	assert.equal(result.details.status, "failed");
	assert.match(result.details.error ?? "", /task/);
	assert.equal(f.infer.mock.calls.length, 1);
	f.noLaunch();
});

type JevRequest = {
	state: { workflows: Array<{ name: string }>; task: { documents: Array<{ content: string }> } };
	questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }>;
};
function jevAnswer(request: JevRequest, selected = "none") {
	return {
		model: "jev-latest",
		usage: { input_tokens: 20, output_tokens: 5 },
		answers: Object.fromEntries(
			Object.entries(request.questions).map(([id, question]) => {
				const choice = id === "workflow" ? selected : "preserve";
				return [
					id,
					{
						type: "choice",
						choice,
						confidence: 0.001,
						probabilities: Object.fromEntries(
							Object.keys(question.criteria).map((key) => [key, key === choice ? 1 : 0]),
						),
					},
				];
			}),
		),
	};
}

test("Jev fallback submits one request with complete registry, contextual Choice semantics and exact budget", async () => {
	const f = fixture({ maxTokens: 0, maxCost: 0.123456789 });
	f.ctx.getRouterModel = () => "";
	vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
	const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
		const request = JSON.parse(String(init?.body)) as JevRequest;
		assert.equal(String(_url), "https://api.typesafe.ai/v1/systemone");
		assert.deepEqual(Object.keys(request.questions), ["workflow", "budget"]);
		assert.deepEqual(Object.keys(request.questions.workflow!.criteria), [
			"none",
			...request.state.workflows.map((entry) => entry.name),
		]);
		assert.equal(request.questions.workflow!.type, "choice");
		assert.match(request.questions.workflow!.instructions, /inline.*not task completion/);
		assert.ok(request.state.task.documents[0]!.content.length > 0);
		assert.match(request.questions.budget!.criteria.preserve!, /0.123456789/);
		return new Response(JSON.stringify(jevAnswer(request)));
	});
	vi.stubGlobal("fetch", fetch);
	const result = await f.call();
	assert.ok("routerDecision" in result.details);
	assert.deepEqual(result.details.routerDecision, {
		workflowType: "none",
		maxBudget: { maxTokens: 0, maxCost: 0.123456789 },
	});
	assert.equal(fetch.mock.calls.length, 1);
	assert.equal(f.infer.mock.calls.length, 0);
	assert.equal(f.ctx.model, decisionModel);
	f.noLaunch();
});

for (const status of [401, 422, 429, 529]) {
	test(`Jev HTTP ${status} fails before any admission without retry or decision`, async () => {
		const f = fixture();
		f.ctx.getRouterModel = () => "";
		vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
		const fetch = vi.fn(async () => new Response("private provider payload", { status }));
		vi.stubGlobal("fetch", fetch);
		const result = await f.call();
		assert.equal("routerDecision" in result.details, false);
		assert.match("error" in result.details ? (result.details.error ?? "") : "", new RegExp(String(status)));
		assert.equal(JSON.stringify(result).includes("private provider payload"), false);
		assert.equal(fetch.mock.calls.length, 1);
		assert.equal(f.infer.mock.calls.length, 0);
		f.noLaunch();
	});
}

for (const malformed of ["unknown-choice", "missing-budget", "wrong-type"]) {
	test(`Jev ${malformed} fails closed without repair`, async () => {
		const f = fixture();
		f.ctx.getRouterModel = () => "typesafe-ai/jev";
		vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
		const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			const response = jevAnswer(JSON.parse(String(init?.body)) as JevRequest);
			if (malformed === "unknown-choice") response.answers.workflow!.choice = "not-registered";
			if (malformed === "missing-budget") delete response.answers.budget;
			if (malformed === "wrong-type") response.answers.workflow!.type = "score";
			return new Response(JSON.stringify(response));
		});
		vi.stubGlobal("fetch", fetch);
		const result = await f.call();
		assert.equal("routerDecision" in result.details, false);
		assert.equal(fetch.mock.calls.length, 1);
		f.noLaunch();
	});
}

test("reload after inference during runtime initialization rejects before admission", async () => {
	const f = fixture();
	const entered = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	vi.spyOn(durableFactory, "initializeDurableBackend").mockImplementation(async () => {
		entered.resolve();
		await release.promise;
		return f.backend;
	});
	const pending = f.call();
	await entered.promise;
	f.noLaunch();
	f.replace();
	release.resolve();
	const result = await pending;
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /registry changed/);
	f.noLaunch();
	assert.equal(f.infer.mock.calls.length, 1);
});

test("a launch uses owned inputs rather than mutations made while inference is pending", async () => {
	const f = fixture();
	const entered = Promise.withResolvers<void>();
	const stream = createAssistantMessageEventStream();
	f.infer.mockImplementation(() => {
		entered.resolve();
		return stream;
	});
	const pending = f.call();
	await entered.promise;
	f.args.inputs = { task: "Changed without approval" };
	stream.push({
		type: "done",
		reason: "toolUse",
		message: decisionMessage({ workflowType: "approved-change", maxBudget: {} }),
	});
	const result = await pending;
	assert.ok("routerDecision" in result.details);
	await f.jobs.get(result.details.runId)!.promise;
	assert.equal(f.store.runs()[0]!.inputs.task, "Approved work");
});

test("Jev refuses a registry exceeding Choice capacity without truncation or inference", async () => {
	const f = fixture();
	let registry = f.runtime.registry;
	for (let i = 0; i < 254; i++)
		registry = registry.register({ ...f.other, name: `extra-${i}`, normalizedName: `extra-${i}` });
	f.replace(registry);
	f.ctx.getRouterModel = () => "typesafe-ai/jev";
	vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	const result = await f.call();
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /255/);
	assert.equal(fetch.mock.calls.length, 0);
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
});

test("documentation paths alone are missing context, not usable documentation", async () => {
	const f = fixture();
	f.args.state!.documents = [{ source: "/tmp/guide.md", content: "/tmp/guide.md" }];
	const result = await f.call();
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /documentation text/);
	assert.equal(f.infer.mock.calls.length, 0);
	f.noLaunch();
});

test("explicit concrete routerModel wins over Jev key at the workflow entrypoint", async () => {
	const f = fixture();
	vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	f.infer.mockImplementation((model) => {
		assert.equal(model.id, decisionModel.id);
		return messageStream(decisionMessage({ workflowType: "none", maxBudget: {} }));
	});
	const result = await f.call();
	assert.ok("routerDecision" in result.details);
	assert.equal(f.infer.mock.calls.length, 1);
	assert.equal(fetch.mock.calls.length, 0);
	assert.equal(f.ctx.model, decisionModel);
	f.noLaunch();
});

test("empty routerModel uses the invocation-time chat selection without changing it", async () => {
	const f = fixture();
	f.ctx.getRouterModel = () => "";
	const nextChat = { ...decisionModel, id: "next-chat" };
	f.ctx.modelRegistry!.getAll = () => [decisionModel, nextChat];
	f.infer.mockImplementation(() => messageStream(decisionMessage({ workflowType: "none", maxBudget: {} })));
	await f.call();
	const nextContext = { ...f.ctx, model: nextChat };
	await f.execute(f.args, nextContext);
	assert.deepEqual(
		f.infer.mock.calls.map(([model]) => model.id),
		[decisionModel.id, nextChat.id],
	);
	assert.equal(f.ctx.model, decisionModel);
	assert.equal(nextContext.model, nextChat);
	f.noLaunch();
});

test("ordinary provider exceptions return no raw payload or decision and cause zero launches", async () => {
	const f = fixture();
	f.infer.mockImplementation(() => {
		throw new Error("private upstream payload mock-secret");
	});
	const result = await f.call();
	assert.equal("routerDecision" in result.details, false);
	assert.match("error" in result.details ? (result.details.error ?? "") : "", /provider request failed/);
	assert.equal(JSON.stringify(result).includes("mock-secret"), false);
	assert.equal(f.infer.mock.calls.length, 1);
	f.noLaunch();
});
