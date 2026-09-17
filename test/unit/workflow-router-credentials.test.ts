import assert from "node:assert/strict";
import { Type } from "typebox";
import { afterEach, beforeEach, test, vi } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { InMemoryDurableBackend } from "../../packages/workflows/src/durable/backend.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import type { WorkflowToolArgs } from "../../packages/workflows/src/extension/public-types.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import { routeWorkflowLaunch } from "../../packages/workflows/src/extension/workflow-router.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import { registerWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool-registration.js";
import { createJobTracker } from "../../packages/workflows/src/runs/background/job-tracker.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { createRegistry } from "../../packages/workflows/src/workflows/registry.js";
import { workflowRouterContext, workflowRouterState } from "../helpers/workflow-router.js";

beforeEach(() => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
});
afterEach(() => {
	setDurableBackend(undefined);
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function fixture(description = "Review authorization handling") {
	const definition = workflow({
		name: "credential-contract",
		description,
		inputs: { authorization: Type.String(), nested: Type.Object({ secret: Type.String() }) },
		outputs: {},
		run: async () => ({}),
	});
	const other = workflow({
		name: "other",
		description: "Another candidate",
		inputs: {},
		outputs: {},
		run: async () => ({}),
	});
	const registry = createRegistry().register(definition).register(other);
	const runtime = createExtensionRuntime({ registry, store: createStore(), jobs: createJobTracker() });
	const ctx = workflowRouterContext("none");
	const infer = vi.spyOn(ctx.modelRegistry!, "streamSimple");
	const args = { workflow: definition.name, inputs: {}, state: workflowRouterState() };
	return {
		definition,
		other,
		ctx,
		infer,
		args,
		route: (input = args) => routeWorkflowLaunch(input, ctx, () => runtime),
	};
}

test("credential-named schema properties preserve every candidate and complete contract", async () => {
	const f = fixture();
	const result = await f.route();
	assert.equal(result.decision.workflowType, "none");
	const context = f.infer.mock.calls[0]![1];
	const snapshot = JSON.parse(context.messages[0]!.content as string).state;
	assert.deepEqual(
		snapshot.workflows.map((entry: { name: string }) => entry.name),
		[f.definition.normalizedName, f.other.normalizedName],
	);
	assert.deepEqual(snapshot.workflows[0].inputs, JSON.parse(JSON.stringify(f.definition.inputs)));
});

test("supplied nested credential fields still fail before inference", async () => {
	const f = fixture();
	await assert.rejects(f.route({ ...f.args, inputs: { nested: { secret: "do-not-send" } } }), /credential field/);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("known credential text in contract metadata still fails before inference", async () => {
	const f = fixture("Do not send Bearer abcdefghijklmnop");
	await assert.rejects(f.route(), /credential-like text/);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("known credential text in task documents still fails before inference", async () => {
	const f = fixture();
	f.args.state.documents[0]!.content = "Bearer abcdefghijklmnop";
	await assert.rejects(f.route(), /credential-like text/);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("TypeSafe none preserves exact budget limits alongside credential-named contracts", async () => {
	const f = fixture();
	const budget = { maxTokens: 0, maxCost: 0.123456789, warnAtPercent: 12.345 };
	f.ctx.getRouterModel = () => "typesafe-ai/jev";
	vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-key");
	const transport = vi.fn(async () =>
		Response.json({
			model: "jev-2026-09",
			answers: {
				workflow: {
					type: "choice",
					choice: "none",
					probabilities: { none: 1, "credential-contract": 0, other: 0 },
					confidence: 1,
				},
				budget: { type: "choice", choice: "preserve", probabilities: { preserve: 1 }, confidence: 1 },
			},
			usage: { input_tokens: 20, output_tokens: 10 },
		}),
	);
	vi.stubGlobal("fetch", transport);
	const result = await f.route({ ...f.args, state: workflowRouterState(budget) });
	assert.deepEqual(result.decision, { workflowType: "none", maxBudget: budget });
	assert.equal(transport.mock.calls.length, 1);
	assert.equal(f.infer.mock.calls.length, 0);
});

function registeredFixture(metadata?: { field: string; text: string }) {
	const backend = new InMemoryDurableBackend();
	setDurableBackend(backend);
	const admissions = vi.spyOn(backend, "registerWorkflow");
	const body = vi.fn(async () => ({ result: "Applied" }));
	const text = metadata?.text ?? "Safe contract";
	const definition = workflow({
		name: metadata?.field === "registry name" ? text : "approved-change",
		description: metadata?.field === "registry description" ? text : "Approved changes",
		inputs: {
			task: Type.String(),
			...(metadata?.field === "registry input key" ? { [text]: Type.String() } : {}),
			option: Type.Optional(Type.String({ default: metadata?.field === "registry default" ? text : "safe" })),
		},
		outputs: { result: Type.String({ description: metadata?.field === "registry output" ? text : "Result" }) },
		run: async (ctx) => ctx.tool("apply", {}, body),
	});
	const store = createStore();
	const jobs = createJobTracker();
	const runtime = createExtensionRuntime({ registry: createRegistry().register(definition), store, jobs });
	const execute = makeExecuteWorkflowTool(
		() => runtime,
		() => undefined,
	);
	const tool = registerWorkflowTool({ registerTool: () => {} }, execute, async (_policy, run) => run())!;
	const ctx = workflowRouterContext("none");
	const infer = vi.spyOn(ctx.modelRegistry!, "streamSimple");
	const transport = vi.fn(async () =>
		Response.json({
			model: "jev-2026-09",
			answers: {
				workflow: {
					type: "choice",
					choice: "none",
					probabilities: { none: 1, [definition.normalizedName]: 0 },
					confidence: 1,
				},
				budget: { type: "choice", choice: "preserve", probabilities: { preserve: 1 }, confidence: 1 },
			},
			usage: { input_tokens: 20, output_tokens: 10 },
		}),
	);
	vi.stubGlobal("fetch", transport);
	const args: WorkflowToolArgs = {
		workflow: definition.name,
		inputs: { task: "Approved work" },
		state: workflowRouterState(),
	};
	return {
		args,
		ctx,
		infer,
		transport,
		call: () => tool.execute("credential-check", args, undefined, undefined, ctx),
		noLaunch: () => {
			assert.equal(admissions.mock.calls.length, 0);
			assert.equal(body.mock.calls.length, 0);
			assert.equal(store.runs().length, 0);
			assert.equal(jobs.runIds().length, 0);
		},
	};
}

const locations = [
	"literal request",
	"intent",
	"conversation",
	"constraint",
	"document source",
	"document content",
	"budget provenance",
	"input value",
	"input key",
	"registry name",
	"registry description",
	"registry input key",
	"registry default",
	"registry output",
] as const;

// #3089: opaque configured keys must never reach either provider through the registered tool.
for (const action of ["run", undefined] as const) {
	for (const provider of ["ordinary", "jev"] as const) {
		for (const [kind, key] of [
			["opaque", "opaque-round-two-3089"],
			["escaped", 'opaque-"quote"-\\slash-\nline-\ttab'],
		] as const) {
			for (const location of locations) {
				test(`rejects ${kind} key in ${location} (${action ?? "default"}, ${provider})`, async () => {
					vi.stubEnv("TYPESAFE_AI_API_KEY", key);
					const text = `Context ${key} end`;
					const f = registeredFixture({ field: location, text });
					f.args.action = action;
					f.ctx.getRouterModel = () => (provider === "jev" ? "typesafe-ai/jev" : "decision-test/chat");
					const state = f.args.state!;
					switch (location) {
						case "literal request":
							state.literalRequest = text;
							break;
						case "intent":
							state.intent = text;
							break;
						case "conversation":
							state.conversation[0]!.text = text;
							break;
						case "constraint":
							state.constraints.push(text);
							break;
						case "document source":
							state.documents[0]!.source = text;
							break;
						case "document content":
							state.documents[0]!.content = text;
							break;
						case "budget provenance":
							state.userBudget = { limits: {}, provenance: text };
							break;
						case "input value":
							f.args.inputs = { task: "Approved", nested: [{ note: text }] };
							break;
						case "input key":
							f.args.inputs = { task: "Approved", nested: [{ [text]: "value" }] };
							break;
					}
					const result = await f.call();
					assert.equal(f.infer.mock.calls.length, 0, "ordinary inference must not receive the snapshot");
					assert.equal(f.transport.mock.calls.length, 0, "Jev inference must not receive the snapshot");
					f.noLaunch();
					assert.ok("status" in result.details);
					assert.equal(result.details.status, "failed");
					assert.match("error" in result.details ? (result.details.error ?? "") : "", /credential/);
					const diagnostic = JSON.stringify(result);
					assert.equal(diagnostic.includes(key), false);
					assert.equal(diagnostic.includes(JSON.stringify(key).slice(1, -1)), false);
				});
			}
		}
		for (const [kind, key] of [
			["unset", undefined],
			["empty", ""],
			["whitespace", "   "],
			["configured", "opaque-safe-3089"],
		] as const) {
			if (provider === "jev" && kind !== "configured") continue; // Jev itself requires authentication.
			test(`safe context routes with ${kind} key (${action ?? "default"}, ${provider})`, async () => {
				vi.stubEnv("TYPESAFE_AI_API_KEY", key);
				const f = registeredFixture();
				f.args.action = action;
				f.ctx.getRouterModel = () => (provider === "jev" ? "typesafe-ai/jev" : "decision-test/chat");
				const result = await f.call();
				assert.ok("status" in result.details);
				assert.equal(result.details.status, "not_launched");
				assert.ok("routerDecision" in result.details);
				assert.deepEqual(result.details.routerDecision, { workflowType: "none", maxBudget: {} });
				assert.equal(f.infer.mock.calls.length, provider === "ordinary" ? 1 : 0);
				assert.equal(f.transport.mock.calls.length, provider === "jev" ? 1 : 0);
				f.noLaunch();
			});
		}
	}
}
