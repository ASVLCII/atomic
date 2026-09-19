import { drainSessionWork, trackSessionWork } from "../session-lifecycle-work.ts";
import type { ExtensionRuntime } from "./types.ts";

// Runtime objects can cross the built/source loader boundary. Keep the binding on
// the actual generation, not in a module-local owner map or the shared event bus.
const workBinding = Symbol.for("atomic.extension-work.v1");
interface WorkBinding {
	sealed: boolean;
	run<T>(operation: () => Promise<T>): Promise<T>;
	drain(): Promise<void>;
}
type OwnedRuntime = ExtensionRuntime & { [workBinding]?: WorkBinding };

export function bindExtensionWork(runtime: ExtensionRuntime, owner: object): void {
	(runtime as OwnedRuntime)[workBinding] ??= {
		sealed: false,
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
