import type { AsyncLocalStorage } from "node:async_hooks";
import type { HostDiagnostic } from "@bastani/atomic";

const contextKey = Symbol.for("atomic.builtin-diagnostic-context.v1");
type Reporter = (diagnostic: Omit<HostDiagnostic, "sessionId">) => void;
const host = globalThis as typeof globalThis & { [contextKey]?: AsyncLocalStorage<Reporter> };

/** Arbitrary remote text, paths and credentials never cross the diagnostic boundary. */
export function reportOwnedWebDiagnostic(level: "warning" | "error" = "error"): boolean {
	const report = host[contextKey]?.getStore();
	if (!report) return false;
	report({ level, source: "web-access", message: level === "error" ? "Web operation failed" : "Web operation warning" });
	return true;
}
