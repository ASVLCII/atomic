import type { QuestionnaireResult, QuestionParams } from "@bastani/atomic";
import { stageUiBroker } from "../shared/stage-ui-broker.js";
import type { Store } from "../shared/store.js";
import type { PendingPrompt } from "../shared/store-types.js";
import type { PiUISurface } from "./ui-surface.js";

export interface WorkflowHumanInputContext {
	readonly hasUI?: boolean;
	readonly hasHumanInput?: boolean;
	readonly ui?: PiUISurface;
}

// Private runner seam, not a second host contract. The runner retains request
// identity, validation and cancellation ownership across adapter changes.
const WORKFLOW_INPUT = Symbol.for("atomic-coding-agent/workflow-input@1");
interface WorkflowInputBridge {
	subscribe(listener: () => void): () => void;
	scope(
		runId: string,
		stageId: string,
	): {
		ui: PiUISurface;
		questionnaire(params: QuestionParams, signal?: AbortSignal): Promise<QuestionnaireResult>;
	};
}
function bridge(ui: PiUISurface | undefined): WorkflowInputBridge | undefined {
	return (ui as (PiUISurface & { [WORKFLOW_INPUT]?: WorkflowInputBridge }) | undefined)?.[WORKFLOW_INPUT];
}

/**
 * #3105: a non-presenting host consumes runtime-owned pending descriptors through
 * the runner's validated dialogs. CLI prompts still belong to the attached graph
 * host; background runs must not open dialogs in the main chat.
 */
export function bindWorkflowHumanInput(store: Store, ctx: WorkflowHumanInputContext): () => void {
	const requests = new Map<string, AbortController>();
	let disposed = false;
	const refresh = (): void => {
		if (disposed) return;
		const pending = new Set<string>();
		for (const run of store.runs()) {
			if (run.status !== "running") continue;
			for (const stage of run.stages) {
				if (stage.status !== "awaiting_input") continue;
				const prompt = stage.pendingPrompt;
				const questionnaire = stageUiBroker.peekStageQuestionnaire(run.id, stage.id);
				if (!prompt && !questionnaire) continue;
				const key = `${run.id}\0${stage.id}\0${questionnaire?.requestId ?? prompt!.id}`;
				pending.add(key);
				if (requests.has(key) || ctx.hasUI !== false || ctx.hasHumanInput !== true) continue;
				const controller = new AbortController();
				requests.set(key, controller);
				// Defer presentation until the publisher has installed its pending waiter.
				void Promise.resolve().then(async () => {
					if (controller.signal.aborted) return;
					try {
						const scoped = bridge(ctx.ui)?.scope(run.id, stage.id);
						if (questionnaire) {
							const answer = await scoped?.questionnaire(questionnaire.params, controller.signal);
							if (controller.signal.aborted || !answer || answer.cancelled || answer.error) return;
							if (stageUiBroker.peekStageQuestionnaire(run.id, stage.id)?.requestId !== questionnaire.requestId)
								return;
							stageUiBroker.answerStagePrompt(
								run.id,
								stage.id,
								{ raw: answer },
								{ answerSource: "workflow_ui" },
							);
						} else if (prompt) {
							const answer = await ask(scoped?.ui ?? ctx.ui, prompt, controller.signal);
							if (controller.signal.aborted || answer === undefined) return;
							store.resolveStagePendingPrompt(run.id, stage.id, prompt.id, answer, {
								answerSource: "workflow_ui",
							});
						}
					} catch {
						// Withdrawal, cancellation and malformed replies never settle a durable
						// gate. Keep its descriptor available for explicit answer/resumption.
					}
				});
			}
		}
		for (const [key, controller] of requests) {
			if (pending.has(key)) continue;
			controller.abort();
			requests.delete(key);
		}
	};
	const unsubscribe = store.subscribeInvalidation(refresh);
	const unsubscribeBinding = bridge(ctx.ui)?.subscribe(() => {
		for (const controller of requests.values()) controller.abort();
		requests.clear();
		refresh();
	});
	refresh();
	return () => {
		disposed = true;
		unsubscribe();
		unsubscribeBinding?.();
		for (const controller of requests.values()) controller.abort();
		requests.clear();
	};
}

async function ask(ui: PiUISurface | undefined, prompt: PendingPrompt, signal: AbortSignal): Promise<unknown> {
	switch (prompt.kind) {
		case "input":
			return ui?.input?.(prompt.message, undefined, { signal });
		case "confirm":
			return ui?.confirm?.("Workflow approval", prompt.message, { signal });
		case "select":
			return ui?.select?.(prompt.message, [...(prompt.choices ?? [])], { signal });
		case "editor":
			return ui?.editor?.(prompt.message, prompt.initial, { signal });
		default:
			return undefined;
	}
}
