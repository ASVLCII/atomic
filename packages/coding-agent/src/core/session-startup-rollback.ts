import type { ExtensionRunner } from "./extensions/index.js";

// CLI assembly mounts its real UI after construction. Retain rollback until its first binding starts.
const rollbacks = new WeakMap<ExtensionRunner, (error: Error) => Promise<never>>();

export function registerStartupRollback(runner: ExtensionRunner, rollback: (error: Error) => Promise<never>): void {
	rollbacks.set(runner, rollback);
}

export function completeStartup(runner: ExtensionRunner): void {
	rollbacks.delete(runner);
}

export async function rollbackStartup(
	runner: ExtensionRunner,
	error: Error,
	fallback?: (error: Error) => Promise<never>,
): Promise<never> {
	const rollback = rollbacks.get(runner) ?? fallback;
	rollbacks.delete(runner);
	if (rollback) return rollback(error);
	throw error;
}
