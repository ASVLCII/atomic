import { createExtensionContext } from "./runner-context.ts";
import { noOpUIContext } from "./runner-ui.ts";
import type { Extension } from "./types.ts";

/** Factories can acquire resources before a session (and its runner) exists. */
export async function rollbackExtensionFactories(extensions: Extension[], cwd: string): Promise<unknown[]> {
	const unavailable = (): never => {
		throw new Error("Session is not initialized during factory rollback");
	};
	const noop = () => {};
	const context = createExtensionContext({
		assertActive: noop,
		getUIContext: () => noOpUIContext,
		getMode: () => "print",
		hasUI: () => false,
		getCwd: () => cwd,
		getSessionManager: unavailable,
		getModelRegistry: unavailable,
		getModel: () => undefined,
		getScopedModels: () => [],
		getThinkingLevel: () => undefined,
		getOrchestrationContext: () => undefined,
		getSubagentPolicy: () => undefined,
		isIdle: () => true,
		isProjectTrusted: () => false,
		getSignal: () => AbortSignal.abort(),
		abort: noop,
		hasPendingMessages: () => false,
		shutdown: noop,
		getContextUsage: () => undefined,
		compact: unavailable,
		getSystemPrompt: () => "",
		observeWorkflowActivity: unavailable,
	});
	const failures: unknown[] = [];
	for (const extension of [...extensions].reverse()) {
		for (const handler of extension.handlers.get("session_shutdown") ?? []) {
			try {
				await handler({ type: "session_shutdown", reason: "quit" }, context);
			} catch (error) {
				failures.push(error);
			}
		}
	}
	return failures;
}

export function factoryRollbackError(error: unknown, failures: unknown[]): unknown {
	return failures.length
		? Object.assign(
				new AggregateError([error, ...failures], "Extension factory failed and rollback reported errors"),
				{ code: "ShutdownFailed" },
			)
		: error;
}
