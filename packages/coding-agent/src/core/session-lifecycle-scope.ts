import { AsyncLocalStorage } from "node:async_hooks";
import type { ExtensionBindings } from "./agent-session-types.ts";

/** Internal factory context; never inherited by independently admitted child sessions. */
export interface SessionLifecycleContext {
	scope: object;
	bindings?: ExtensionBindings;
	claimed?: boolean;
}
export const sessionLifecycleCreation = new AsyncLocalStorage<SessionLifecycleContext>();
export const sessionLifecycleScopes = new WeakMap<object, object>();

/** Communication transports may be borrowed; only runtime/loader identities own a lifetime. */
export function lifecycleScopeForOwner(owner: object): object {
	let scope = sessionLifecycleScopes.get(owner);
	if (!scope) {
		scope = sessionLifecycleCreation.getStore()?.scope ?? {};
		sessionLifecycleScopes.set(owner, scope);
	}
	return scope;
}
