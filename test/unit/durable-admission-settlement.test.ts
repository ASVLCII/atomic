import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { afterEach, test, vi } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import {
	DBOS_ADMISSION_TIMEOUT_MS,
	DbosDependencyError,
	dbosAdmissionContext,
} from "../../packages/workflows/src/durable/dbos-admission.js";
import { DbosDurableBackend } from "../../packages/workflows/src/durable/dbos-backend.js";
import {
	launchDbosOnce,
	resetDbosLifecycleForTests,
	shutdownDbos,
} from "../../packages/workflows/src/durable/dbos-lifecycle.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { run } from "../../packages/workflows/src/engine/run.js";
import { createToolControlRegistry } from "../../packages/workflows/src/engine/run-tool-control-registry.js";
import { quitRun } from "../../packages/workflows/src/runs/background/quit.js";
import { pauseRun, resumeRun } from "../../packages/workflows/src/runs/background/status.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { createMockSdk } from "./durable-dbos-backend-helpers.js";

afterEach(() => {
	vi.useRealTimers();
	setDurableBackend(undefined);
	resetDbosLifecycleForTests();
});

// #3072 / #3074: every admission exit shares the same settlement contract.
const exits = [
	"success",
	"deadline",
	"dependency",
	"rejection",
	"cancel-before",
	"cancel-after",
	"quit-before",
	"quit-after",
	"pause",
	"continuation",
	"continuation-dependency",
	"continuation-rejection",
	"shutdown",
] as const;

test.each(exits)("admission exit matrix: %s", async (exit) => {
	vi.useFakeTimers();
	const sdk = createMockSdk();
	const entered = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	const caller = new AbortController();
	const store = createStore();
	const controls = createToolControlRegistry();
	const runId = `matrix-${exit}`;
	const rejection = new Error("permission denied for admission");
	const continuation = exit.startsWith("continuation");
	const unavailable = exit === "deadline" || exit.endsWith("dependency");
	const rejected = exit.endsWith("rejection");
	let armed = false;
	let control: Promise<unknown> | undefined;
	let admissionSignal: AbortSignal | undefined;
	const gate = async () => {
		if (!armed) return;
		admissionSignal ??= dbosAdmissionContext.getStore();
		entered.resolve();
		await release.promise;
		if (unavailable && exit !== "deadline") throw new DbosDependencyError();
		if (rejected) throw rejection;
	};
	const backend = new DbosDurableBackend({
		...sdk,
		startWorkflow: async (...args) => {
			await gate();
			await sdk.startWorkflow(...args);
		},
		resumeWorkflow: async (...args) => {
			await gate();
			await sdk.resumeWorkflow(...args);
		},
		recordStepOutput: async (...args) => {
			await sdk.recordStepOutput(...args);
			if (!armed || control !== undefined) return;
			if (exit === "cancel-after") {
				caller.abort(new Error("user cancelled"));
				control = Promise.resolve();
			}
			if (exit === "quit-after") control = quitRun(runId, { store, toolControlRegistry: controls });
		},
	});
	setDurableBackend(backend);
	if (continuation) {
		backend.registerWorkflow({
			workflowId: runId,
			name: runId,
			inputs: {},
			status: "paused",
			createdAt: 1,
			resumable: true,
		});
		await backend.flush(runId);
	}
	const shutdown = vi.fn(async () => {});
	if (exit === "shutdown") {
		resetDbosLifecycleForTests(
			async () => ({ backend, launch: async () => {}, shutdown }),
			async () => {},
			async () => {},
		);
		await launchDbosOnce();
	}
	armed = true;
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
	const pending = run(
		definition,
		{},
		{
			runId,
			store,
			durableBackend: backend,
			signal: caller.signal,
			toolControlRegistry: controls,
			...(continuation
				? {
						continuation: {
							source: {
								id: runId,
								name: runId,
								inputs: {},
								status: "paused" as const,
								startedAt: 1,
								stages: [],
							},
						},
					}
				: {}),
		},
	);
	const outcome = pending.then(
		(result) => result,
		(error: unknown) => error,
	);
	await entered.promise;
	if (exit === "cancel-before") caller.abort(new Error("user cancelled"));
	if (exit === "quit-before") control = quitRun(runId, { store, toolControlRegistry: controls });
	if (exit === "pause") control = pauseRun(runId, { store, toolControlRegistry: controls });
	if (exit === "shutdown") control = shutdownDbos();
	if (exit === "deadline") await vi.advanceTimersByTimeAsync(DBOS_ADMISSION_TIMEOUT_MS);
	else release.resolve();
	await vi.advanceTimersByTimeAsync(0);
	if (exit === "pause") {
		await control;
		assert.equal(store.runs()[0]?.status, "paused");
		assert.equal(backend.getWorkflow(runId)?.status, "paused");
		assert.equal(author.mock.calls.length, 0);
		assert.equal((await resumeRun(runId, { store, toolControlRegistry: controls })).ok, true);
	}
	await control;
	const result = await outcome;
	if (rejected) assert.equal(result, rejection);
	const cancelled = exit.startsWith("cancel");
	const quit = exit.startsWith("quit");
	const status = cancelled ? "cancelled" : quit ? "paused" : unavailable || rejected ? "failed" : "completed";
	assert.equal(backend.getWorkflow(runId)?.status, status);
	assert.equal(store.runs()[0]?.status, cancelled ? "killed" : status);
	assert.equal(backend.isAdmissionUnavailable(runId), unavailable);
	assert.equal(author.mock.calls.length, status === "completed" ? 1 : 0);
	assert.deepEqual(sdk.state.cancels, exit === "cancel-after" ? [runId] : []);
	if (quit || cancelled || rejected) assert.equal(backend.getWorkflow(runId)?.resumable, false);
	if (unavailable)
		assert.equal(
			backend.getWorkflow(runId)?.resumable,
			true,
			"local same-ID retry, not evidence of persisted admission",
		);
	assert.equal(controls.runControl(runId), undefined);
	assert.equal(controls.admissionBoundary(runId), undefined);
	const persisted = [...sdk.state.steps.entries()];
	release.resolve();
	await vi.advanceTimersByTimeAsync(0);
	assert.deepEqual([...sdk.state.steps.entries()], persisted, "abandoned admission cannot publish late metadata");
	if (exit === "shutdown") {
		await shutdownDbos();
		assert.equal(shutdown.mock.calls.length, 1);
	}
	if (!unavailable && !rejected && exit !== "cancel-before") {
		const fresh = new DbosDurableBackend(sdk);
		await fresh.hydrateWorkflow(runId);
		assert.equal(fresh.getWorkflow(runId)?.status, status, "authoritative metadata agrees with local settlement");
	}
	assert.equal(vi.getTimerCount(), 0);
	assert.equal(getEventListeners(caller.signal, "abort").length, 0);
	assert.ok(admissionSignal);
	assert.equal(getEventListeners(admissionSignal, "abort").length, 0);
	assert.equal(dbosAdmissionContext.getStore(), undefined);
});
