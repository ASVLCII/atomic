import { sessionScopedExtensionState } from "@bastani/atomic";
import { getDurableBackendProcessOwner } from "../durable/backend-process-owner.js";
import { acquireDbosLease, flushDbos } from "../durable/dbos-lifecycle.js";
import { getDurableBackend } from "../durable/factory.js";
import { settleAdmissionControls } from "../engine/run-durable-admission.js";
import { currentToolControlRegistry } from "../engine/run-tool-control-registry.js";
import { currentCancellationRegistry } from "../runs/background/cancellation-registry.js";
import { currentJobTracker } from "../runs/background/job-tracker.js";
import { quitAllRuns } from "../runs/background/quit.js";
import { killAllRuns } from "../runs/background/status.js";
import { currentStageControlRegistry } from "../runs/foreground/stage-control-registry.js";
import { installCompactionHook } from "../shared/persistence-compaction-policy.js";
import { topLevelWorkflowRuns } from "../shared/run-visibility.js";
import { currentWorkflowStore } from "../shared/store-factory.js";
import { clearForms } from "../tui/inline-form-store.js";
import { installStoreWidget } from "../tui/store-widget-installer.js";
import type { WorkflowExtensionRuntimeState } from "./extension-runtime-state.js";
import { resetWorkflowHilAnswerNotificationState } from "./hil-answer-notifications.js";
import { resetWorkflowLifecycleNotificationState } from "./lifecycle-notifications.js";
import type { ExtensionAPI } from "./public-types.js";
import { formatStartupDiagnostics } from "./workflow-command-surfaces.js";

interface WorkflowLifetime {
	readonly generations: Set<() => Promise<void>>;
	readonly release: () => Promise<void>;
	closing?: Promise<void>;
}

async function attemptAll(actions: readonly (() => unknown | Promise<unknown>)[]): Promise<void> {
	const errors: unknown[] = [];
	for (const action of actions) {
		try {
			await action();
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length > 0) throw new AggregateError(errors, errors.map(String).join("; "));
}

/**
 * `/reload`, `/fork`, `/new`, and `/resume` replace the host session inside
 * one process that keeps running the workflows. Those reasons must not kill
 * in-flight runs or drop live executor handles. `startup` and any reason
 * this code does not recognise still clear: neither names a predecessor
 * that handed anything over. `/reload` reuses the host bus; the others do not.
 */
function replacementStopsWorkflows(reason: string | undefined): boolean {
	return reason !== "reload" && reason !== "fork" && reason !== "new" && reason !== "resume";
}

export interface WorkflowLifecycleRegistrationDeps {
	runtimeState: WorkflowExtensionRuntimeState;
	storeWidgetRef: { current: (() => void) | null };
	intercomControlRef: { current: (() => void) | null };
	disposeObservation?: () => void;
}

export function registerWorkflowLifecycleHandlers(pi: ExtensionAPI, deps: WorkflowLifecycleRegistrationDeps): void {
	if (typeof pi.on !== "function") return;
	const store = currentWorkflowStore();
	const cancellationRegistry = currentCancellationRegistry();
	const stageControlRegistry = currentStageControlRegistry();
	const toolControlRegistry = currentToolControlRegistry();
	const jobs = currentJobTracker();
	const lifetime = sessionScopedExtensionState<WorkflowLifetime>(
		pi.lifecycleScope ?? pi.events ?? pi,
		"workflows:lifecycle:v1",
		() => ({
			generations: new Set(),
			// Injected backends are borrowed: never stop caller-owned durability.
			release: getDurableBackendProcessOwner().injectedBackend === undefined ? acquireDbosLease() : async () => {},
		}),
	);
	lifetime.generations.add(async () => {
		await attemptAll([
			async () => {
				const results = await quitAllRuns({
					store,
					stageControlRegistry,
					toolControlRegistry,
					jobs,
					awaitSettlement: true,
				});
				const abandoned = results.flatMap((result) => (result.ok ? result.abandonedTools : []));
				if (abandoned.length > 0)
					throw new Error(
						`Workflow cleanup left uncooperative tools: ${abandoned.map((tool) => `${tool.runId}/${tool.nodeId}`).join(", ")}`,
					);
				const failures = results.filter((result) => !result.ok);
				if (failures.length > 0)
					throw new Error(
						failures
							.map(
								(result) =>
									`${result.runId}: ${result.reason}${"message" in result ? ` (${result.message})` : ""}`,
							)
							.join("; "),
					);
			},
			async () => {
				if (store.runs().length === 0) return;
				const backend = getDurableBackend();
				const runIds = store.runs().map((run) => run.id);
				await attemptAll([
					() => settleAdmissionControls(backend, runIds),
					...runIds.map((runId) => () => backend.flush(runId)),
				]);
			},
			() => stageControlRegistry.clear(),
		]);
	});
	const { runtimeState } = deps;
	pi.on("session_before_switch", async (event, ctx) => {
		const reason =
			typeof event === "object" && event !== null && "reason" in event
				? (event as { readonly reason?: string }).reason
				: undefined;
		if (reason !== "new" && reason !== "resume") return undefined;
		const inFlightWorkflowCount = topLevelWorkflowRuns(store.runs()).filter(
			(run) => run.endedAt === undefined,
		).length;
		if (inFlightWorkflowCount === 0) return undefined;
		const confirmSessionSwitch = ctx?.ui?.confirm;
		if (typeof confirmSessionSwitch !== "function") return undefined;
		const workflowNoun = inFlightWorkflowCount === 1 ? "workflow" : "workflows";
		const actionLabel = reason === "new" ? "Start a new session" : "Resume another session";
		const messageLabel = reason === "new" ? "Starting a new session" : "Resuming another session";
		try {
			const shouldSwitchSession = await confirmSessionSwitch(
				`${actionLabel} with ${inFlightWorkflowCount} in-flight ${workflowNoun} still running?`,
				`${messageLabel} keeps ${inFlightWorkflowCount} in-flight ${workflowNoun} running in this process. They stay on the session that started them.`,
			);
			if (shouldSwitchSession) return undefined;
		} catch {
			return undefined;
		}
		const cancelledLabel = reason === "new" ? "New session" : "Resume";
		ctx?.ui?.notify?.(`${cancelledLabel} cancelled; in-flight workflows keep running.`, "info");
		return { cancel: true };
	});

	pi.on("session_start", async (event, ctx) => {
		const reason =
			typeof event === "object" && event !== null && "reason" in event
				? (event as { readonly reason?: string }).reason
				: undefined;
		runtimeState.resetWorkflowDiscoveryForSession();
		await runtimeState.ensureWorkflowConfigLoaded();
		if (replacementStopsWorkflows(reason)) {
			killAllRuns({ store, cancellation: cancellationRegistry, persistence: runtimeState.persistenceRef.current });
			store.clear();
		}
		clearForms();
		resetWorkflowLifecycleNotificationState(runtimeState.lifecycleNotificationState);
		resetWorkflowHilAnswerNotificationState(runtimeState.hilAnswerNotificationState);
		if (replacementStopsWorkflows(reason)) await stageControlRegistry.clear();
		else await stageControlRegistry.clearDetached();
		// Named workflows publish lifecycle notices through the normal notification path.
		runtimeState.setNotificationsActive(true);
		runtimeState.startWorkflowDiscoveryWarmup(() => {
			if (!ctx?.ui) return;
			const diagnostics = formatStartupDiagnostics(null, runtimeState.discoveryRef.current);
			if (diagnostics !== null) ctx.ui.notify?.(diagnostics, "warning");
		});
		if (ctx?.ui) {
			const diagnostics = formatStartupDiagnostics(runtimeState.configLoadRef.current, null);
			if (diagnostics !== null) ctx.ui.notify?.(diagnostics, "warning");
			deps.storeWidgetRef.current?.();
			deps.storeWidgetRef.current = installStoreWidget({ ui: ctx.ui }, store);
		}
		// Session JSONL contains chat transcripts only. Workflow state is loaded
		// from DBOS on the first workflow command or run, never during startup.
		runtimeState.updateHostStageSessionDir(ctx?.sessionManager ?? pi.sessionManager);
	});

	installCompactionHook(pi, store);
	pi.on("session_shutdown", async (event) => {
		const reason =
			typeof event === "object" && event !== null && "reason" in event
				? (event as { readonly reason?: string }).reason
				: undefined;
		const closeGeneration = () =>
			attemptAll([
				() => {
					deps.intercomControlRef.current?.();
					deps.intercomControlRef.current = null;
				},
				() => {
					deps.storeWidgetRef.current?.();
					deps.storeWidgetRef.current = null;
				},
				() => runtimeState.resetWorkflowDiscoveryForSession(),
				() => runtimeState.setNotificationsActive(false),
				() => deps.disposeObservation?.(),
			]);
		if (replacementStopsWorkflows(reason)) {
			lifetime.closing ??= attemptAll([
				closeGeneration,
				...lifetime.generations,
				() => {
					lifetime.generations.clear();
				},
				lifetime.release,
			]);
			await lifetime.closing;
		} else {
			await attemptAll([closeGeneration, () => stageControlRegistry.clearDetached(), flushDbos]);
		}
	});
}
