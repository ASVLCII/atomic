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
const busScopes = new WeakMap<object, object>();

export function lifecycleScopeForBus(bus: object): object {
	let scope = busScopes.get(bus);
	if (!scope) {
		scope = sessionLifecycleCreation.getStore()?.scope ?? {};
		busScopes.set(bus, scope);
	}
	return scope;
}
