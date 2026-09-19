import { AsyncLocalStorage } from "node:async_hooks";
import type { HostDiagnostic } from "./extensions/host-input.js";
import { lifecycleScopeForOwner } from "./session-lifecycle-scope.ts";

const contextKey = Symbol.for("atomic.builtin-diagnostic-context.v1");
const diagnosticKey = Symbol.for("atomic.builtin-diagnostic.v1");
type Reporter = (diagnostic: Omit<HostDiagnostic, "sessionId">) => void;
// Raw builtin TS and the compiled host share invocation context, never a current-session singleton.
const host = globalThis as typeof globalThis & { [contextKey]?: AsyncLocalStorage<Reporter> };
host[contextKey] ??= new AsyncLocalStorage<Reporter>();
const context = host[contextKey];

export function withBuiltinDiagnostics<T>(owner: object, operation: () => T): T {
	const scope = lifecycleScopeForOwner(owner) as { [diagnosticKey]?: Reporter };
	const report = scope[diagnosticKey];
	return report ? context.run(report, operation) : operation();
}
