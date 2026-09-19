import type { AsyncLocalStorage } from "node:async_hooks";
import type { ExtensionAPI, HostDiagnostic } from "@bastani/atomic";

const diagnosticKey = Symbol.for("atomic.builtin-diagnostic.v1");
type DiagnosticScope = { [diagnosticKey]?: (diagnostic: Omit<HostDiagnostic, "sessionId">) => void };

const contextKey = Symbol.for("atomic.builtin-diagnostic-context.v1");
const ownerKey = Symbol.for("atomic.builtin-owner.v1");
type Reporter = ((diagnostic: Omit<HostDiagnostic, "sessionId">) => void) & { [ownerKey]?: object };
const host = globalThis as typeof globalThis & { [contextKey]?: AsyncLocalStorage<Reporter> };

/** Stable SDK invocation owner; absent for standalone helpers. */
export function getMcpOwner(): object | undefined {
  return host[contextKey]?.getStore()?.[ownerKey];
}

/** Redact at the logger boundary: arbitrary messages, contexts and errors are never forwarded. */
export function reportOwnedMcpLog(level: "debug" | "info" | "warn" | "error"): boolean {
  const report = host[contextKey]?.getStore();
  if (!report) return false;
  report({
    level: level === "warn" ? "warning" : level === "debug" ? "info" : level,
    source: "mcp",
    message: level === "error" ? "MCP operation failed" : level === "warn" ? "MCP operation warning" : "MCP operation update",
  });
  return true;
}

/** Only fixed operational messages belong here, never exception text or server configuration. */
export function reportMcpDiagnostic(pi: ExtensionAPI, message: string): void {
  const scope = pi.lifecycleScope as DiagnosticScope | undefined;
  const report = scope?.[diagnosticKey];
  if (report) {
    report({ level: "error", source: "mcp", message });
  } else {
    // Hosts without Atomic's owner bridge retain their existing terminal diagnostics.
    console.error(message);
  }
}
