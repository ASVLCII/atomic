import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { DbosDependencyError } from "../../packages/workflows/src/durable/dbos-admission.js";
import { DbosDurableBackend, type DbosSdkHandle } from "../../packages/workflows/src/durable/dbos-backend.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { resumeDurableWorkflow } from "../../packages/workflows/src/durable/resume-runtime.js";
import { run } from "../../packages/workflows/src/engine/run.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import { createJobTracker, jobTracker } from "../../packages/workflows/src/runs/background/job-tracker.js";
import { createStore, store } from "../../packages/workflows/src/shared/store.js";
import { createRegistry } from "../../packages/workflows/src/workflows/registry.js";
import { testRunId } from "../helpers/run-id.js";
import { createMockSdk } from "./durable-dbos-backend-helpers.js";

afterEach(() => setDurableBackend(undefined));

// #3072/#3074: an acknowledged checkpoint and an uncertain external effect are different guarantees.
for (const committed of [true, false]) {
	test(`mid-checkpoint outage replays only durably committed results: committed=${committed}`, async () => {
		const sdk = createMockSdk();
		let fail = true;
		let effects = 0;
		const handle: DbosSdkHandle = {
			...sdk,
			async recordStepOutput(id, step, output) {
				const tool = typeof output === "object" && output !== null && "kind" in output && output.kind === "tool";
				if (tool && fail) {
					fail = false;
					if (committed) await sdk.recordStepOutput(id, step, output);
					throw new DbosDependencyError("checkpoint response lost");
				}
				if (!sdk.state.steps.has(`${id}:checkpoint:${step}`)) await sdk.recordStepOutput(id, step, output);
			},
		};
		const backend = new DbosDurableBackend(handle);
		const id = testRunId(`checkpoint-${committed}`);
		const definition = workflow({
			name: "outage-replay",
			description: "",
			inputs: {},
			outputs: {},
			run: async (ctx) => {
				await ctx.tool("external-effect", {}, async () => {
					effects++;
					return "receipt";
				});
				return {};
			},
		});
		setDurableBackend(backend);
		const initial = await run(definition, {}, { runId: id, store: createStore(), durableBackend: backend });
		assert.equal(initial.status, "failed");
		assert.equal(backend.isCheckpointUnavailable(id), true);
		assert.equal(effects, 1);
		const fresh = new DbosDurableBackend(handle);
		await fresh.hydrateWorkflow(id);
		setDurableBackend(fresh);
		const resumed = await run(definition, {}, { runId: id, store: createStore(), durableBackend: fresh });
		assert.equal(resumed.status, "completed");
		assert.equal(
			effects,
			committed ? 1 : 2,
			"missing checkpoint cannot prove an arbitrary external effect did not happen",
		);
		assert.deepEqual([...sdk.state.workflows.keys()], [id]);
	});
}

test("concurrent explicit resumes reconcile incomplete admission and execute one same-ID body", async () => {
	const sdk = createMockSdk();
	let unavailable = true;
	const handle: DbosSdkHandle = {
		...sdk,
		async startWorkflow(...args) {
			if (unavailable) throw new DbosDependencyError();
			await sdk.startWorkflow(...args);
		},
		async recordStepOutput(id, step, value) {
			if (!sdk.state.steps.has(`${id}:checkpoint:${step}`)) await sdk.recordStepOutput(id, step, value);
		},
	};
	const backend = new DbosDurableBackend(handle);
	setDurableBackend(backend);
	const id = testRunId("reconciled-public-resume");
	let executions = 0;
	const finish = Promise.withResolvers<void>();
	const definition = workflow({
		name: "reconcile-resume",
		description: "",
		inputs: {},
		outputs: {},
		run: async () => {
			executions++;
			await finish.promise;
			return {};
		},
	});
	const store = createStore();
	assert.equal((await run(definition, {}, { runId: id, durableBackend: backend, store })).status, "failed");
	unavailable = false;
	const jobs = createJobTracker();
	const deps = {
		registry: createRegistry().register(definition),
		durableBackend: backend,
		baseRunOpts: { store, jobs },
		jobs,
	};
	try {
		const results = await Promise.all([resumeDurableWorkflow(id, deps), resumeDurableWorkflow(id, deps)]);
		assert.equal(results.filter((result) => result.ok).length, 1);
		assert.equal(executions, 1);
		assert.deepEqual([...sdk.state.workflows.keys()], [id]);
	} finally {
		finish.resolve();
		await jobs.get(id)?.promise;
	}
});

// #3072/#3074: reconciliation must survive a refused public resume without becoming a new-ID continuation.
for (const checkpointFailure of [false, true]) {
	for (const missingDefinition of [false, true]) {
		test(`public workflow tool resumes an unavailable root under the same ID: checkpoint=${checkpointFailure}, missing definition=${missingDefinition}`, async () => {
			const sdk = createMockSdk();
			let unavailable = true;
			const backend = new DbosDurableBackend({
				...sdk,
				async startWorkflow(...args) {
					if (unavailable && !checkpointFailure) throw new DbosDependencyError();
					await sdk.startWorkflow(...args);
				},
				async recordStepOutput(id, step, value) {
					if (!sdk.state.steps.has(`${id}:checkpoint:${step}`)) await sdk.recordStepOutput(id, step, value);
					if (
						checkpointFailure &&
						unavailable &&
						typeof value === "object" &&
						value !== null &&
						"kind" in value &&
						value.kind === "tool"
					)
						throw new DbosDependencyError("checkpoint response lost");
				},
			});
			setDurableBackend(backend);
			const id = testRunId("unavailable-tool-resume");
			let executions = 0;
			let effects = 0;
			const finish = Promise.withResolvers<void>();
			const definition = workflow({
				name: "unavailable-tool-resume",
				description: "",
				inputs: {},
				outputs: {},
				run: async (ctx) => {
					executions++;
					const receipt = await ctx.tool("recovered-effect", {}, async () => {
						effects++;
						return "receipt";
					});
					assert.equal(receipt, "receipt");
					await finish.promise;
					return {};
				},
			});
			try {
				assert.equal((await run(definition, {}, { runId: id })).status, "failed");
				assert.equal(store.runs().find((candidate) => candidate.id === id)?.status, "failed");
				assert.equal(executions, checkpointFailure ? 1 : 0);
				unavailable = false;
				if (missingDefinition) {
					const executeWithoutDefinition = makeExecuteWorkflowTool(createExtensionRuntime(), () => undefined);
					const rejected = await executeWithoutDefinition({ action: "resume", runId: id }, {} as never);
					assert.equal(rejected.action, "resume");
					if (rejected.action !== "resume") assert.fail("expected resume result");
					assert.equal(rejected.status, "noop");
					assert.match(rejected.message ?? "", /Workflow definition not found/);
					assert.equal(executions, checkpointFailure ? 1 : 0, "missing definition must not execute a body");
					assert.equal(backend.isAdmissionUnavailable(id), false);
					assert.equal(backend.isCheckpointUnavailable(id), false);
					assert.equal(backend.getWorkflow(id)?.status, "blocked");
					assert.equal(backend.isWorkflowRecoveryPending(id), true);
				}
				const execute = makeExecuteWorkflowTool(
					createExtensionRuntime({ definitions: [definition] }),
					() => undefined,
				);
				const resumed = await execute({ action: "resume", runId: id }, {} as never);
				assert.equal(resumed.action, "resume");
				if (resumed.action !== "resume") assert.fail("expected resume result");
				assert.equal(resumed.status, "running", resumed.message);
				assert.equal(resumed.runId, id);
				assert.equal(executions, checkpointFailure ? 2 : 1);
				assert.deepEqual([...sdk.state.workflows.keys()], [id]);
				assert.equal(
					backend.isWorkflowRecoveryPending(id),
					false,
					"successful admission consumes recovery routing",
				);
				finish.resolve();
				await jobTracker.get(id)?.promise;
				const completed = store.runs().find((candidate) => candidate.id === id);
				assert.equal(completed?.status, "completed", JSON.stringify(completed));
				assert.equal(executions, checkpointFailure ? 2 : 1);
				assert.equal(effects, 1, "committed effect must not run again");
			} finally {
				finish.resolve();
				await jobTracker.get(id)?.promise;
				store.removeRun(id);
			}
		});
	}
}
