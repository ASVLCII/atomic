/**
 * Durable root-run registration and startup admission.
 *
 * Root registration/status must be durably persisted before startup admission
 * or workflow code runs: a stopped or unhealthy backend fails here, before
 * any side effects execute (issue #1957).
 */

import type { DurableWorkflowBackend, WorkflowRegistrationInput } from "../durable/backend.js";
import { boundedAdmission, dbosAdmissionContext } from "../durable/dbos-admission.js";
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
}): Promise<void> {
	if (args.isChildRun) return;
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
}

/** One owner for admission and every executor exit, including a detached graceful quit. */
export function createDurableAdmissionSettlement(input: DurableTerminalFinalizeInput, signal: AbortSignal) {
	let admitted = false;
	let pending: Promise<void> | undefined;
	let settlement: Promise<void> = Promise.resolve();
	return {
		admit(registration: WorkflowRegistrationInput | undefined): Promise<void> {
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
			})
				.then(() => {
					admitted = true;
				})
				.finally(() => signal.removeEventListener("abort", onAbort));
			return pending;
		},
		async settled(): Promise<void> {
			await settlement;
		},
		async settle(cancelled: boolean, onUnconfirmedCancellation: () => void): Promise<void> {
			const gracefulQuit = findWorkflowGracefulQuit(signal.reason) !== undefined;
			settlement = (async () => {
				if (gracefulQuit) {
					try {
						await pending;
					} catch (error) {
						// Preserve the prompt local stop, not a fictitious durable pause.
						// Never flush the abandoned queue under a new, unfenced context.
						const fence = new AbortController();
						fence.abort();
						dbosAdmissionContext.run(fence.signal, () =>
							input.durableBackend.setWorkflowStatus(input.runId, "paused", undefined, false),
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
			// The public quit acknowledgement awaits this same settlement, while
			// the suspended executor can return without waiting for in-flight SQL.
			if (!gracefulQuit) await settlement;
		},
	};
}
