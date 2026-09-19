import { AsyncLocalStorage } from "node:async_hooks";
import { drainExtensionWork } from "./extension-work.ts";
import { retireExtensionAPI, runExtensionAPICleanup } from "./loader-api.ts";
import { createExtensionContext } from "./runner-context.ts";
import { noOpUIContext } from "./runner-ui.ts";
import type { Extension, ExtensionRuntime } from "./types.ts";

export const factoryAcquisitions = new AsyncLocalStorage<{
	pending?: Map<Extension, { cwd: string; runtime: ExtensionRuntime }>;
	replacement?: boolean;
}>();

export async function rollbackFactoryAcquisitions(
	retainedRuntimes: ReadonlySet<ExtensionRuntime> = new Set(),
): Promise<unknown[]> {
	const acquired = factoryAcquisitions.getStore()?.pending;
	const failures: unknown[] = [];
	const runtimes = new Set<ExtensionRuntime>();
	for (const [extension, { cwd, runtime }] of [...(acquired ?? [])].reverse()) {
		failures.push(...(await rollbackExtensionFactories([extension], cwd, runtime)));
		runtimes.add(runtime);
	}
	for (const runtime of runtimes) {
		if (retainedRuntimes.has(runtime)) continue;
		try {
			runtime.invalidate();
		} catch (error) {
			failures.push(error);
		}
	}
	return failures;
}

/** Factories can acquire resources before a session (and its runner) exists. */
export async function rollbackExtensionFactories(
	extensions: Extension[],
	cwd: string,
	runtime: ExtensionRuntime,
): Promise<unknown[]> {
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
		factoryAcquisitions.getStore()?.pending?.delete(extension);
		await runExtensionAPICleanup(extension, async () => {
			for (const handler of extension.handlers.get("session_shutdown") ?? []) {
				try {
					await handler(
						{ type: "session_shutdown", reason: factoryAcquisitions.getStore()?.replacement ? "new" : "quit" },
						context,
					);
				} catch (error) {
					failures.push(error);
				}
			}
		});
		try {
			await drainExtensionWork(runtime);
		} catch (error) {
			failures.push(error);
		}
		try {
			retireExtensionAPI(extension);
		} catch (error) {
			failures.push(error);
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
