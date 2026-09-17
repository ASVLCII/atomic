import assert from "node:assert/strict";
import { Type } from "typebox";
import { afterEach, beforeEach, test, vi } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import { routeWorkflowLaunch } from "../../packages/workflows/src/extension/workflow-router.js";
import { createJobTracker } from "../../packages/workflows/src/runs/background/job-tracker.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { createRegistry } from "../../packages/workflows/src/workflows/registry.js";
import { workflowRouterContext, workflowRouterState } from "../helpers/workflow-router.js";

beforeEach(() => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
});
afterEach(() => {
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
