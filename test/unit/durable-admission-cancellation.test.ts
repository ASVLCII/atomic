import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import {
	DBOS_ADMISSION_TIMEOUT_MS,
	DbosDependencyError,
	dbosAdmissionContext,
} from "../../packages/workflows/src/durable/dbos-admission.js";
import { DbosDurableBackend } from "../../packages/workflows/src/durable/dbos-backend.js";
import { resetDbosLifecycleForTests } from "../../packages/workflows/src/durable/dbos-lifecycle.js";
import { isMetadataStep, parseCurrentMetadataRecord } from "../../packages/workflows/src/durable/dbos-metadata.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { run } from "../../packages/workflows/src/engine/run.js";
import { createToolControlRegistry } from "../../packages/workflows/src/engine/run-tool-control-registry.js";
import { quitRun } from "../../packages/workflows/src/runs/background/quit.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { createMockSdk } from "./durable-dbos-backend-helpers.js";

afterEach(() => {
	vi.useRealTimers();
	setDurableBackend(undefined);
	resetDbosLifecycleForTests();
});

// #3072 / #3074: graceful quit during admission must not durably cancel a paused run.
test.each(["before-commit", "after-commit"] as const)(
	"public quit %s preserves paused durable state",
	async (timing) => {
		vi.useFakeTimers();
		const sdk = createMockSdk();
		const runId = `quit-${timing}`;
		const store = createStore();
		const toolControlRegistry = createToolControlRegistry();
		let quit: ReturnType<typeof quitRun> | undefined;
		const entered = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const backend = new DbosDurableBackend({
			...sdk,
			startWorkflow: async (...args) => {
				if (timing === "before-commit") {
					entered.resolve();
					await release.promise;
				}
				await sdk.startWorkflow(...args);
			},
			recordStepOutput: async (id, step, output) => {
				await sdk.recordStepOutput(id, step, output);
				if (timing === "after-commit" && isMetadataStep(step) && quit === undefined) {
					quit = quitRun(runId, { store, toolControlRegistry, actor: "user" });
				}
			},
		});
		setDurableBackend(backend);
		const author = vi.fn(async () => ({}));
		const definition = workflow({ name: runId, description: "", inputs: {}, outputs: {}, run: author });
		const pending = run(definition, {}, { runId, durableBackend: backend, store, toolControlRegistry });
		if (timing === "before-commit") {
			await entered.promise;
			quit = quitRun(runId, { store, toolControlRegistry, actor: "user" });
		}
		await vi.advanceTimersByTimeAsync(0);
		const result = await pending;
		assert.ok(quit);
		assert.equal(store.runs()[0]?.status, "paused", "local quit does not wait for admission SQL");
		release.resolve();
		await vi.advanceTimersByTimeAsync(0);
		const quitResult = await quit;
		assert.equal(quitResult.ok, true);
		assert.equal(result.status, "paused");
		assert.equal(result.exitReason, "quit");
		assert.equal(store.runs()[0]?.status, "paused");
		assert.equal(store.runs()[0]?.exitReason, "quit");
		assert.equal(store.runs()[0]?.resumable, false, "registration alone is not durable progress");
		assert.equal(author.mock.calls.length, 0);
		assert.deepEqual(sdk.state.cancels, [], "graceful quit is not destructive cancellation");
		assert.equal(backend.getWorkflow(runId)?.status, "paused");
		assert.equal(backend.getWorkflow(runId)?.resumable, false);
		assert.equal(
			backend.listResumableWorkflows().some((entry) => entry.workflowId === runId),
			false,
		);
		assert.equal(backend.isAdmissionUnavailable(runId), false);
		assert.equal(toolControlRegistry.runControl(runId), undefined);
		assert.equal(toolControlRegistry.admissionBoundary(runId), undefined);
		const other = new DbosDurableBackend(sdk, { executorId: "other-executor" });
		await other.hydrateWorkflow(runId);
		assert.equal(other.getWorkflow(runId)?.status, "paused");
		assert.equal(other.getWorkflow(runId)?.resumable, false);
		assert.equal(store.notices().length, 0);
		assert.equal(vi.getTimerCount(), 0);
	},
);

// #3072 / #3074: the backend must reject cancellation for non-cancelled outcomes too.
test.each(["running", "paused"] as const)("unadmitted cancellation leaves a %s record untouched", async (status) => {
	const sdk = createMockSdk();
	const admission = new AbortController();
	const reason = new Error("admission interrupted after commit");
	const runId = `guard-${status}`;
	const backend = new DbosDurableBackend({
		...sdk,
		recordStepOutput: async (id, step, output) => {
			await sdk.recordStepOutput(id, step, output);
			if (isMetadataStep(step)) admission.abort(reason);
		},
	});
	await assert.rejects(
		backend.admitWorkflow(
			runId,
			{ workflowId: runId, name: runId, inputs: {}, createdAt: 1, status: "running" },
			admission.signal,
		),
		(error) => error === reason,
	);
	dbosAdmissionContext.run(admission.signal, () => backend.setWorkflowStatus(runId, status));
	const persisted = [...sdk.state.steps.entries()];
	await backend.cancelUnadmittedWorkflow(runId, new AbortController().signal);
	assert.deepEqual(sdk.state.cancels, []);
	assert.deepEqual([...sdk.state.steps.entries()], persisted);
	assert.equal(backend.getWorkflow(runId)?.status, status);
});

// #3072 / #3074: cancellation must retire a possibly committed running owner,
// even while its abandoned admission write queue is still unresolved.
test.each(["after-commit", "in-flight-fenced", "abandoned-queue"] as const)(
	"healthy cancellation persists after admission metadata committed (%s)",
	async (timing) => {
		vi.useFakeTimers();
		const sdk = createMockSdk();
		const caller = new AbortController();
		const late = Promise.withResolvers<void>();
		const runId = `cancel-${timing}`;
		let admissionSignal: AbortSignal | undefined;
		let cancellationSignal: AbortSignal | undefined;
		const backend = new DbosDurableBackend({
			...sdk,
			recordStepOutput: async (id, step, output) => {
				await sdk.recordStepOutput(id, step, output);
				if (!isMetadataStep(step) || caller.signal.aborted) return;
				admissionSignal = dbosAdmissionContext.getStore();
				caller.abort(new Error("user cancelled after metadata committed"));
				if (timing === "in-flight-fenced") throw admissionSignal?.reason;
				if (timing === "abandoned-queue") await late.promise;
			},
			cancelWorkflow: async (id) => {
				cancellationSignal = dbosAdmissionContext.getStore();
				await sdk.cancelWorkflow(id);
			},
		});
		const author = vi.fn(async () => ({}));
		const definition = workflow({ name: runId, description: "", inputs: {}, outputs: {}, run: author });
		const store = createStore();
		let settled = false;
		const pending = run(definition, {}, { runId, durableBackend: backend, store, signal: caller.signal }).then(
			(result) => {
				settled = true;
				return result;
			},
		);
		await vi.advanceTimersByTimeAsync(0);
		assert.equal(settled, true, "healthy cancellation must not wait on the abandoned admission queue");
		const result = await pending;
		assert.equal(result.status, "killed");
		assert.equal(store.runs()[0]?.failureCode, "cancelled");
		assert.equal(author.mock.calls.length, 0);
		assert.equal(backend.getWorkflow(runId)?.status, "cancelled");
		assert.deepEqual(sdk.state.cancels, [runId], "committed running owner must be cancelled durably");
		assert.ok(cancellationSignal && !cancellationSignal.aborted);
		assert.notEqual(cancellationSignal, admissionSignal, "finalization has a fresh bounded fence");
		const persisted = [...sdk.state.steps.entries()]
			.map(([key, output]) => ({ stepName: key.split(":checkpoint:")[1] ?? "", output }))
			.filter((record) => isMetadataStep(record.stepName))
			.map((record) => parseCurrentMetadataRecord(record, runId)?.status);
		assert.equal(persisted.at(-1), "cancelled");
		const before = [...sdk.state.steps.entries()];
		late.resolve();
		await vi.advanceTimersByTimeAsync(0);
		assert.deepEqual(
			[...sdk.state.steps.entries()],
			before,
			"late admission settlement cannot republish running metadata",
		);
		assert.equal(vi.getTimerCount(), 0);
	},
);

// #3072: a cancellation before metadata is attempted remains local and prompt.
test("slow-start cancellation does not wait or publish late metadata", async () => {
	vi.useFakeTimers();
	const sdk = createMockSdk();
	const entered = Promise.withResolvers<void>();
	const late = Promise.withResolvers<void>();
	const caller = new AbortController();
	const backend = new DbosDurableBackend({
		...sdk,
		startWorkflow: async (...args) => {
			entered.resolve();
			await late.promise;
			await sdk.startWorkflow(...args);
		},
	});
	const author = vi.fn(async () => ({}));
	const definition = workflow({ name: "slow", description: "", inputs: {}, outputs: {}, run: author });
	const store = createStore();
	let settled = false;
	const pending = run(definition, {}, { runId: "slow", durableBackend: backend, store, signal: caller.signal }).then(
		(result) => {
			settled = true;
			return result;
		},
	);
	await entered.promise;
	caller.abort(new Error("user cancelled"));
	await vi.advanceTimersByTimeAsync(0);
	assert.equal(settled, true);
	assert.equal((await pending).status, "killed");
	assert.equal(store.runs()[0]?.failureCode, "cancelled");
	assert.deepEqual(sdk.state.cancels, []);
	late.resolve();
	await vi.advanceTimersByTimeAsync(DBOS_ADMISSION_TIMEOUT_MS);
	assert.equal(sdk.state.steps.size, 0);
	assert.equal(author.mock.calls.length, 0);
	assert.equal(backend.isAdmissionUnavailable("slow"), false);
	assert.equal(vi.getTimerCount(), 0);
});

// #3072: failure to confirm cancellation must preserve killed/cancelled and
// report uncertainty, with a bounded fresh fence and no late follow-up writes.
for (const operation of ["cancel", "metadata"] as const) {
	test.each(["refusing", "frozen"] as const)(
		`unconfirmed ${operation} finalization stays bounded (%s)`,
		async (mode) => {
			vi.useFakeTimers();
			const sdk = createMockSdk();
			const caller = new AbortController();
			const late = Promise.withResolvers<void>();
			const entered = Promise.withResolvers<void>();
			let finalizationSignal: AbortSignal | undefined;
			let metadataCalls = 0;
			const fail = async () => {
				finalizationSignal = dbosAdmissionContext.getStore();
				assert.ok(finalizationSignal && !finalizationSignal.aborted);
				entered.resolve();
				if (mode === "refusing") throw new Error("connection refused during cancellation finalization");
				await late.promise;
				finalizationSignal.throwIfAborted();
			};
			const backend = new DbosDurableBackend({
				...sdk,
				recordStepOutput: async (id, step, output) => {
					if (isMetadataStep(step)) {
						metadataCalls++;
						if (caller.signal.aborted && operation === "metadata") await fail();
					}
					await sdk.recordStepOutput(id, step, output);
					if (isMetadataStep(step) && !caller.signal.aborted) caller.abort(new Error("user cancelled"));
				},
				cancelWorkflow: async (id) => {
					if (operation === "cancel") await fail();
					await sdk.cancelWorkflow(id);
				},
			});
			const author = vi.fn(async () => ({}));
			const definition = workflow({ name: "uncertain", description: "", inputs: {}, outputs: {}, run: author });
			const store = createStore();
			let settled = false;
			const pending = run(
				definition,
				{},
				{ runId: "uncertain", durableBackend: backend, store, signal: caller.signal },
			).then((result) => {
				settled = true;
				return result;
			});
			await entered.promise;
			await vi.advanceTimersByTimeAsync(DBOS_ADMISSION_TIMEOUT_MS - 1);
			assert.equal(settled, mode === "refusing");
			await vi.advanceTimersByTimeAsync(1);
			assert.equal(settled, true, "finalization is independently bounded");
			assert.equal((await pending).status, "killed");
			assert.equal(store.runs()[0]?.failureCode, "cancelled");
			assert.equal(backend.getWorkflow("uncertain")?.status, "cancelled");
			assert.equal(author.mock.calls.length, 0);
			assert.ok(
				store
					.notices()
					.some(
						(notice) =>
							notice.runId === "uncertain" &&
							/durable cancellation could not be confirmed.*unknown/u.test(notice.message),
					),
			);
			assert.equal(finalizationSignal?.aborted, true);
			const persisted = [...sdk.state.steps.entries()];
			late.resolve();
			await vi.advanceTimersByTimeAsync(0);
			assert.equal(metadataCalls, operation === "cancel" ? 1 : 2);
			assert.deepEqual([...sdk.state.steps.entries()], persisted);
			assert.equal(vi.getTimerCount(), 0);
		},
	);
}

// #3072 / #3074: quit acknowledges locally before registration settles; failures
// remain visible through status without losing durable progress or fencing.
test.each(["deadline", "dependency", "rejection"] as const)(
	"public quit settles failed admission: %s",
	async (mode) => {
		vi.useFakeTimers();
		const sdk = createMockSdk();
		const entered = Promise.withResolvers<void>();
		const late = Promise.withResolvers<void>();
		const rejection = new Error("permission denied during admission");
		let attempts = 0;
		const backend = new DbosDurableBackend({
			...sdk,
			startWorkflow: async (...args) => {
				const first = ++attempts === 1;
				entered.resolve();
				await late.promise;
				if (first && mode === "rejection") throw rejection;
				if (first && mode === "dependency") throw new DbosDependencyError();
				await sdk.startWorkflow(...args);
			},
		});
		setDurableBackend(backend);
		const store = createStore();
		const controls = createToolControlRegistry();
		const runId = `quit-failed-${mode}`;
		const author = vi.fn(async () => ({}));
		const definition = workflow({
			name: runId,
			description: "",
			inputs: {},
			outputs: {},
			run: async (ctx) => {
				await ctx.tool("effect", {}, author);
				return {};
			},
		});
		const pending = run(definition, {}, { runId, durableBackend: backend, store, toolControlRegistry: controls });
		await entered.promise;
		const quit = quitRun(runId, { store, toolControlRegistry: controls });
		assert.equal((await quit).ok, true, "quit acknowledges before SDK admission is released");
		assert.equal((await pending).status, "paused");
		assert.equal(store.runs()[0]?.resumable, false);
		let concurrentSettled = false;
		const concurrent = quitRun(runId, { store, toolControlRegistry: controls }).then((result) => {
			concurrentSettled = true;
			return result;
		});
		assert.equal((await concurrent).ok, true, "concurrent quit also acknowledges pending admission");
		if (mode !== "deadline") late.resolve();
		await vi.advanceTimersByTimeAsync(DBOS_ADMISSION_TIMEOUT_MS);
		assert.match(store.runs()[0]?.error ?? "", /durable paused transition failed/);
		assert.match(store.runs()[0]?.error ?? "", mode === "rejection" ? /permission denied/ : /database|timed out/);
		assert.equal(concurrentSettled, true);
		let repeatedSettled = false;
		const repeated = quitRun(runId, { store, toolControlRegistry: controls }).then((result) => {
			repeatedSettled = true;
			return result;
		});
		await vi.advanceTimersByTimeAsync(0);
		assert.equal(repeatedSettled, true, "repeat quit cannot wait on an abandoned queue");
		assert.equal((await repeated).ok, true);
		assert.equal(backend.getWorkflow(runId)?.status, "paused");
		assert.equal(backend.getWorkflow(runId)?.resumable, false);
		assert.equal(backend.isAdmissionUnavailable(runId), mode !== "rejection");
		assert.deepEqual(sdk.state.cancels, []);
		assert.equal(author.mock.calls.length, 0);
		assert.equal(controls.runControl(runId), undefined);
		assert.equal(controls.admissionBoundary(runId), undefined);
		late.resolve();
		await vi.advanceTimersByTimeAsync(0);
		assert.equal(sdk.state.steps.size, 0, "failed admission cannot publish late running metadata");
		assert.equal(
			(await run(definition, {}, { runId, durableBackend: backend, store: createStore() })).status,
			"completed",
		);
		assert.equal(author.mock.calls.length, 1, "retry executes once and retires the previous admission failure");
		assert.equal(backend.isAdmissionUnavailable(runId), false);
		await backend.settleWorkflowAdmission(runId);
		assert.equal(vi.getTimerCount(), 0);
	},
);
