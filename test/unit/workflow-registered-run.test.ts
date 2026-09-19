import assert from "node:assert/strict";
import { Type } from "typebox";
import { afterEach, test, vi } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { InMemoryDurableBackend } from "../../packages/workflows/src/durable/backend.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import { captureWorkflowOwnerResources } from "../../packages/workflows/src/extension/workflow-owner-resources.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import { createJobTracker } from "../../packages/workflows/src/runs/background/job-tracker.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { createRegistry } from "../../packages/workflows/src/workflows/registry.js";
import { type JevFixtureRequest, jevFixtureResponse } from "../helpers/jev-tournament.js";
import { workflowRouterContext } from "../helpers/workflow-router.js";
import { waitForExecutorStagePendingPrompt } from "./executor-shared.js";

afterEach(() => {
	setDurableBackend(undefined);
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

function fixture(provider: "structured" | "jev" = "structured", lifecycle = false) {
	setDurableBackend(new InMemoryDurableBackend());
	const store = createStore();
	const jobs = createJobTracker();
	const body = vi.fn(async () => ({}));
	let markGap!: () => void;
	const gapReached = new Promise<void>((resolve) => {
		markGap = resolve;
	});
	let releaseGap!: () => void;
	const gap = new Promise<void>((resolve) => {
		releaseGap = resolve;
	});
	const definition = workflow({
		name: "registered",
		description: "Approved implementation",
		inputs: { objective: Type.String() },
		outputs: {},
		run: async (ctx) => {
			await ctx.tool("effect", {}, body);
			if (lifecycle) {
				markGap();
				await gap;
				assert.equal(await ctx.ui.input("Approve next step"), "approved");
				await ctx.tool("after-approval", {}, body);
			}
			return {};
		},
	});
	const runtime = createExtensionRuntime({ registry: createRegistry().register(definition), store, jobs });
	const execute = makeExecuteWorkflowTool(
		runtime,
		() => undefined,
		() => {},
		{ ...captureWorkflowOwnerResources(), store, jobs },
	);
	const ctx = { ...workflowRouterContext("registered"), sessionId: "owner" };
	const inference = vi.spyOn(ctx.modelRegistry!, "streamSimple");
	if (provider === "jev") {
		ctx.getRouterModel = () => "typesafe-ai/jev";
		vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: RequestInit) => {
				const request = JSON.parse(String(init.body)) as JevFixtureRequest;
				return Response.json(
					jevFixtureResponse(
						request,
						(_keys, id) =>
							({
								workflow: "registered",
								duration: "unknown",
								interaction: "executable",
								complexity: "workflow_beneficial",
								budget: "preserve",
							})[id]!,
					),
				);
			}),
		);
	}
	return { store, jobs, definition, execute, ctx, inference, body, runtime, gapReached, releaseGap };
}

// #3106: real model-tool admission, dispatcher and durable runner, deterministic inference.
test.each(["structured", "jev"] as const)(
	"%s route reserves without launch and corrected inputs admit one stable instance",
	async (provider) => {
		const f = fixture(provider);
		const route = await f.execute(
			{ action: "route", state: { task: "Implement the approved change", conversation: [], documents: [] } },
			f.ctx,
		);
		assert.equal(route.action, "route");
		if (route.action !== "route") throw new Error("wrong action");
		assert.equal(route.workflowType, "registered");
		assert.deepEqual(route.inputSchema, f.definition.inputs);
		assert.equal(f.store.runs().length, 0);
		const args = { action: "run" as const, workflowId: route.workflowId };
		const missing = await f.execute(args, f.ctx);
		assert.equal("status" in missing && missing.status, "needs_input");
		assert.equal("runId" in missing && missing.runId, route.workflowId);
		const results = await Promise.all(
			Array.from({ length: 4 }, () => f.execute({ ...args, inputs: { objective: "approved" } }, f.ctx)),
		);
		assert.equal(results.filter((r) => "status" in r && r.status !== "failed").length, 1, JSON.stringify(results));
		await Promise.all(f.jobs.runIds().map((id) => f.jobs.get(id)!.promise));
		assert.equal(f.body.mock.calls.length, 1);
		assert.equal(f.store.runs().length, 1);
		assert.equal(f.store.runs()[0]!.id, route.workflowId);
		assert.equal(provider === "jev" ? vi.mocked(fetch).mock.calls.length : f.inference.mock.calls.length, 1);
		const retry = await f.execute({ ...args, inputs: { objective: "approved" } }, f.ctx);
		assert.match("error" in retry ? (retry.error ?? "") : "", /Terminal/);
		assert.equal(f.body.mock.calls.length, 1);
	},
);

test("registered run rejects absent, forged, foreign and overridden IDs without inference", async () => {
	const f = fixture();
	for (const workflowId of [undefined, "", "forged", crypto.randomUUID()]) {
		const result = await f.execute({ action: "run", workflowId }, f.ctx);
		assert.equal("status" in result && result.status, "failed");
	}
	assert.equal(f.inference.mock.calls.length, 0);
	const route = await f.execute({ action: "route", state: { task: "Implement approved work" } }, f.ctx);
	if (route.action !== "route") throw new Error("wrong action");
	const foreign = await f.execute({ action: "run", workflowId: route.workflowId }, { ...f.ctx, sessionId: "foreign" });
	assert.match("error" in foreign ? (foreign.error ?? "") : "", /another caller/);
	const override = await f.execute({ action: "run", workflowId: route.workflowId, workflow: "other" }, f.ctx);
	assert.match("error" in override ? (override.error ?? "") : "", /override/);
	const omitted = await f.execute({ workflowId: route.workflowId }, f.ctx);
	assert.equal("status" in omitted && omitted.status, "failed");
	assert.equal(f.store.runs().length, 0);
});

// #3106: a reservation's contract cannot silently change between assessment and admission.
test("registry replacement invalidates a reservation and repeated stale admission never infers", async () => {
	const f = fixture();
	const route = await f.execute({ action: "route", state: { task: "Implement approved work" } }, f.ctx);
	assert.equal(route.action, "route");
	const replacement = createRegistry().register(
		workflow({
			name: "registered",
			description: "Changed",
			inputs: { changed: Type.Number() },
			outputs: {},
			run: async () => ({}),
		}),
	);
	Object.defineProperty(f.runtime, "registry", { value: replacement });
	for (let attempt = 0; attempt < 2; attempt++) {
		const result = await f.execute(
			{ action: "run", workflowId: route.workflowId, inputs: { objective: "approved" } },
			f.ctx,
		);
		assert.equal("status" in result && result.status, "failed");
		assert.match("error" in result ? (result.error ?? "") : "", /registry changed|invalidated/);
	}
	assert.equal(f.inference.mock.calls.length, 1);
	assert.equal(f.body.mock.calls.length, 0);
});

test("distinct registered IDs execute independently and remain inspectable after completion", async () => {
	const f = fixture();
	const routes = await Promise.all(
		[1, 2].map(() => f.execute({ action: "route", state: { task: "Implement approved work" } }, f.ctx)),
	);
	const ids = routes.map((route) => {
		assert.equal(route.action, "route");
		return route.workflowId;
	});
	assert.notEqual(ids[0], ids[1]);
	await Promise.all(
		ids.map((workflowId) => f.execute({ action: "run", workflowId, inputs: { objective: "approved" } }, f.ctx)),
	);
	await Promise.all(f.jobs.runIds().map((id) => f.jobs.get(id)!.promise));
	assert.equal(f.body.mock.calls.length, 2);
	for (const runId of ids) {
		const result = await f.execute({ action: "status", runId }, f.ctx);
		assert.equal(result.action, "statusDetail");
		assert.ok("detail" in result);
		assert.equal(result.detail.status, "completed");
		await assert.rejects(
			f.execute({ action: "status", runId }, { ...f.ctx, sessionId: "foreign" }),
			/another caller/,
		);
	}
});

// #3106: executable public-tool route → correction → pending input → controls → terminal.
test.each(["structured", "jev"] as const)(
	"%s registered identity survives pending input and pause/resume",
	async (provider) => {
		const f = fixture(provider, true);
		const route = await f.execute(
			{ action: "route", state: { task: "Implement approved work with a human gate" } },
			f.ctx,
		);
		assert.equal(route.action, "route");
		const runId = route.workflowId;
		assert.equal(f.store.runs().length, 0);
		const invalid = await f.execute({ action: "run", workflowId: runId, inputs: { objective: 42 } }, f.ctx);
		assert.equal("status" in invalid && invalid.status, "needs_input");
		const started = await f.execute({ action: "run", workflowId: runId, inputs: { objective: "approved" } }, f.ctx);
		assert.equal("runId" in started && started.runId, runId);
		await f.gapReached;
		assert.equal(f.body.mock.calls.length, 1);
		const paused = await f.execute({ action: "pause", runId }, f.ctx);
		assert.equal("status" in paused && paused.status, "paused", JSON.stringify(paused));
		const resumed = await f.execute({ action: "resume", runId }, f.ctx);
		assert.equal("runId" in resumed && resumed.runId, runId);
		assert.equal("status" in resumed && resumed.status, "ok");
		f.releaseGap();
		const pending = await waitForExecutorStagePendingPrompt(f.store);
		assert.equal(pending.runId, runId);
		const answer = await f.execute({ action: "answer", runId, stageId: pending.stageId, text: "approved" }, f.ctx);
		assert.equal("status" in answer && answer.status, "ok");
		await Promise.all(f.jobs.runIds().map((id) => f.jobs.get(id)!.promise));
		const terminal = await f.execute({ action: "status", runId }, f.ctx);
		assert.equal(terminal.action, "statusDetail");
		assert.equal("detail" in terminal && terminal.detail.status, "completed");
		assert.equal(f.store.runs().length, 1);
		assert.equal(f.body.mock.calls.length, 2);
		assert.equal(provider === "jev" ? vi.mocked(fetch).mock.calls.length : f.inference.mock.calls.length, 1);
		const duplicate = await f.execute({ action: "run", workflowId: runId, inputs: { objective: "approved" } }, f.ctx);
		assert.match("error" in duplicate ? (duplicate.error ?? "") : "", /Terminal/);
		assert.equal(f.body.mock.calls.length, 2);
	},
);
