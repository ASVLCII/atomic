import { AsyncLocalStorage } from "node:async_hooks";
import { drainSessionWork, trackSessionWork } from "../session-lifecycle-work.ts";
import { STALE_EXTENSION_CONTEXT_MESSAGE } from "./stale-context.ts";
import type { ExtensionRuntime } from "./types.ts";

// Runtime objects can cross the built/source loader boundary. Keep the binding on
// the actual generation, not in a module-local owner map or the shared event bus.
const workBinding = Symbol.for("atomic.extension-work.v1");
interface WorkBinding {
	sealed: boolean;
	cleanup: AsyncLocalStorage<{ active: boolean }>;
	revoked?: boolean;
	run<T>(operation: () => Promise<T>): Promise<T>;
	drain(): Promise<void>;
}
type OwnedRuntime = ExtensionRuntime & { [workBinding]?: WorkBinding };

export function bindExtensionWork(runtime: ExtensionRuntime, owner: object): void {
	(runtime as OwnedRuntime)[workBinding] ??= {
		sealed: false,
		cleanup: new AsyncLocalStorage<{ active: boolean }>(),
		run: (operation) => trackSessionWork(owner, () => trackSessionWork(runtime, operation)),
		drain: () => drainSessionWork(runtime),
	};
}

export function sealExtensionWork(runtime: ExtensionRuntime): void {
	const binding = (runtime as OwnedRuntime)[workBinding];
	if (binding) binding.sealed = true;
}

export function resumeExtensionWork(runtime: ExtensionRuntime): void {
	const binding = (runtime as OwnedRuntime)[workBinding];
	if (binding) binding.sealed = false;
}

export function extensionWorkOpen(runtime: ExtensionRuntime): boolean {
	return !(runtime as OwnedRuntime)[workBinding]?.sealed;
}

export function trackExtensionWork<T>(runtime: ExtensionRuntime, operation: () => Promise<T>): Promise<T> {
	return (runtime as OwnedRuntime)[workBinding]?.run(operation) ?? operation();
}

export async function drainExtensionWork(runtime: ExtensionRuntime): Promise<void> {
	await (runtime as OwnedRuntime)[workBinding]?.drain();
}

/** Revoke capabilities without releasing resources still owned by admitted callbacks. */
export function revokeExtensionAuthority(runtime: ExtensionRuntime): void {
	const binding = (runtime as OwnedRuntime)[workBinding];
	if (!binding || binding.revoked) return;
	binding.revoked = true;
	const assertActive = runtime.assertActive.bind(runtime);
	runtime.assertActive = () => {
		assertActive();
		if (!binding.cleanup.getStore()?.active) throw new Error(STALE_EXTENSION_CONTEXT_MESSAGE);
	};
}

export async function runExtensionCleanup<T>(runtime: ExtensionRuntime, operation: () => Promise<T>): Promise<T> {
	const binding = (runtime as OwnedRuntime)[workBinding];
	if (!binding) return operation();
	const scope = { active: true };
	try {
		return await binding.cleanup.run(scope, operation);
	} finally {
		scope.active = false;
	}
}
