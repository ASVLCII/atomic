/**
 * Durable root-run registration and startup admission.
 *
 * Root registration/status must be durably persisted before startup admission
 * or workflow code runs: a stopped or unhealthy backend fails here, before
 * any side effects execute (issue #1957).
 */

import type { DurableWorkflowBackend, WorkflowRegistrationInput } from "../durable/backend.js";
import { boundedAdmission, dbosAdmissionContext, isDbosDependencyError } from "../durable/dbos-admission.js";
import { isDurableWorkflowResumable } from "../durable/resume-eligibility.js";
import type { WorkflowSerializableValue } from "../shared/types.js";
import {
	type DurableTerminalFinalizeInput,
	finalizeCancelledAdmission,
	finalizeDurableTerminalStatus,
	finalizeUnadmittedDurableStatus,
} from "./run-durable-finalize.js";
import { findWorkflowGracefulQuit } from "./workflow-tool-abort.js";

/** Build the root registration handle, or `undefined` when the run must not (re-)register. */
export function durableRootRegistrationForRun(args: {
	readonly runId: string;
	readonly name: string;
	readonly inputs: Readonly<Record<string, unknown>>;
	readonly createdAt: number;
	readonly hasPersistence: boolean;
	readonly isChildRun: boolean;
	readonly continuationSourceId: string | undefined;
	readonly possibleStages?: readonly string[];
}): WorkflowRegistrationInput | undefined {
	const shouldRegister =
		!args.isChildRun && (args.continuationSourceId === undefined || args.continuationSourceId !== args.runId);
	if (!shouldRegister) return undefined;
	return {
		workflowId: args.runId,
		name: args.name,
		inputs: args.inputs as Record<string, WorkflowSerializableValue>,
		createdAt: args.createdAt,
		status: "running" as const,
		rootWorkflowId: args.runId,
		resumable: true,
		...(args.hasPersistence ? { sessionFile: undefined } : {}),
		...(args.possibleStages !== undefined ? { possibleStages: args.possibleStages } : {}),
	};
}

/** Register/mark the root run and flush so admission requires healthy durable persistence. */
export async function admitDurableRootRun(args: {
	readonly backend: DurableWorkflowBackend;
	readonly runId: string;
	readonly isChildRun: boolean;
	readonly registration: WorkflowRegistrationInput | undefined;
	readonly signal?: AbortSignal;
	readonly timeoutMs?: number;
	/** Retry only after an explicitly resumed live pause. */
	readonly onDependencyBlocked?: (message: string) => Promise<boolean>;
}): Promise<void> {
	if (args.isChildRun) return;
	for (;;) {
		try {
			await boundedAdmission(
				async (signal) => {
					if (args.backend.admitWorkflow !== undefined) {
						await args.backend.admitWorkflow(args.runId, args.registration, signal);
						return;
					}
					if (args.registration !== undefined) args.backend.registerWorkflow(args.registration);
					else args.backend.setWorkflowStatus(args.runId, "running");
					await args.backend.flush(args.runId);
				},
				args.signal,
				args.timeoutMs,
			);
			return;
		} catch (error) {
			if (!isDbosDependencyError(error) || !(await args.onDependencyBlocked?.(error.message))) throw error;
		}
	}
}

/** Observe and fence failed durable controls without blocking local acknowledgement. */
export function backgroundAdmissionControl(
	backend: DurableWorkflowBackend | undefined,
	runId: string,
	settlement: Promise<void>,
	onFailure: (error: unknown, resumable: boolean) => void,
): void {
	void settlement.catch((error: unknown) => {
		const handle = backend?.getWorkflow(runId);
		const resumable =
			handle !== undefined && isDurableWorkflowResumable({ ...handle, status: "paused", resumable: true });
		onFailure(error, resumable);
		if (handle === undefined || (handle.status !== "running" && handle.status !== "paused")) return;
		// Never enqueue an unfenced write behind abandoned admission. Preserve progress
		// and expose uncertainty in the existing local status/error fields only.
		const fence = new AbortController();
		fence.abort();
		dbosAdmissionContext.run(fence.signal, () => backend?.setWorkflowStatus(runId, "paused", undefined, resumable));
	});
}

/** One owner for admission and every executor exit, including a detached graceful quit. */
export function createDurableAdmissionSettlement(input: DurableTerminalFinalizeInput, signal: AbortSignal) {
	let admitted = false;
	let rejected = false;
	let pending: Promise<void> | undefined;
	return {
		get admitting(): boolean {
			return !admitted;
		},
		admit(
			registration: WorkflowRegistrationInput | undefined,
			onDependencyBlocked?: (message: string) => Promise<boolean>,
		): Promise<void> {
			const controller = new AbortController();
			const onAbort = () => {
				// Quit suspends author execution immediately but drains registration before
				// publishing paused metadata. Real cancellation still fences it immediately.
				if (findWorkflowGracefulQuit(signal.reason) === undefined) controller.abort(signal.reason);
			};
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
			pending = admitDurableRootRun({
				backend: input.durableBackend,
				runId: input.runId,
				isChildRun: !input.isRoot,
				registration,
				signal: controller.signal,
				onDependencyBlocked,
			})
				.then(() => {
					admitted = true;
				})
				.catch((error: unknown) => {
					rejected = true;
					throw error;
				})
				.finally(() => signal.removeEventListener("abort", onAbort));
			return pending;
		},
		get failed(): boolean {
			return rejected;
		},
		async settle(cancelled: boolean, onUnconfirmedCancellation: () => void): Promise<void> {
			const gracefulQuit = findWorkflowGracefulQuit(signal.reason) !== undefined;
			const settlement = (async () => {
				if (gracefulQuit) {
					try {
						await input.durableBackend.settleWorkflowAdmission?.(input.runId);
					} catch (error) {
						// Preserve the prompt local stop, not a fictitious durable pause.
						// Never flush the abandoned queue under a new, unfenced context.
						const handle = input.durableBackend.getWorkflow(input.runId);
						const resumable =
							handle !== undefined &&
							isDurableWorkflowResumable({ ...handle, status: "paused", resumable: true });
						const fence = new AbortController();
						fence.abort();
						dbosAdmissionContext.run(fence.signal, () =>
							input.durableBackend.setWorkflowStatus(input.runId, "paused", undefined, resumable),
						);
						throw error;
					}
					return; // Public quit owns the authoritative paused transition.
				}
				if (admitted) return finalizeDurableTerminalStatus(input);
				await finalizeUnadmittedDurableStatus(input);
				if (!cancelled) return;
				try {
					await finalizeCancelledAdmission(input);
				} catch {
					onUnconfirmedCancellation();
				}
			})();
			// Public quit observes the backend's retained registration outcome separately.
			// The suspended executor must not wait for independent startup drains.
			if (gracefulQuit) void settlement.catch(() => {});
			else await settlement;
		},
	};
}
