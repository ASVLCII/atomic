import type { AsyncLocalStorage } from "node:async_hooks";

const contextKey = Symbol.for("atomic.builtin-diagnostic-context.v1");
const ownerKey = Symbol.for("atomic.builtin-owner.v1");
type Reporter = { [ownerKey]?: object };
const host = globalThis as typeof globalThis & { [contextKey]?: AsyncLocalStorage<Reporter> };

/** In-memory builtin state follows the lifecycle scope, including host rebinding. */
export function createOwnerState<T extends object>(create: (owner?: object) => T): () => T {
	const owners = new WeakMap<object, T>();
	let standalone: T | undefined;
	return () => {
		const owner = host[contextKey]?.getStore()?.[ownerKey];
		if (!owner) return standalone ??= create();
		let state = owners.get(owner);
		if (!state) {
			state = create(owner);
			owners.set(owner, state);
		}
		return state;
	};
}
