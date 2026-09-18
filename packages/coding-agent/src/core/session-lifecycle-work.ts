import { AsyncLocalStorage } from "node:async_hooks";

const currentWork = new AsyncLocalStorage<ReadonlySet<Promise<void>>>();
const reloads = new WeakMap<object, Promise<void>>();
const reloadCleanupFailures = new WeakMap<object, unknown[]>();
const work = new WeakMap<object, Set<Promise<void>>>();
const lifetimes = new WeakMap<object, AbortController>();
export const sessionGenerationClosing = new WeakSet<object>();

export function hasSessionReload(session: object): boolean {
	return reloads.has(session);
}

export function trackSessionReload(session: object, operation: () => Promise<void>): Promise<void> {
	const result = operation();
	reloads.set(session, result);
	const forget = () => {
		if (reloads.get(session) === result) reloads.delete(session);
	};
	void result.then(forget, (error: unknown) => {
		if (error instanceof Error && "code" in error && error.code === "ShutdownFailed") {
			const failures = reloadCleanupFailures.get(session) ?? [];
			failures.push(error);
			reloadCleanupFailures.set(session, failures);
		}
		forget();
	});
	return result;
}

export async function drainSessionReload(session: object): Promise<void> {
	// Preparation errors belong to the reload caller; failed rollback also belongs to final cleanup.
	await reloads.get(session)?.catch(() => {});
	const failures = reloadCleanupFailures.get(session);
	if (failures?.length)
		throw Object.assign(new AggregateError(failures, "Reload cleanup failed"), { code: "ShutdownFailed" });
}

export function sessionLifetime(session: object): AbortSignal {
	let controller = lifetimes.get(session);
	if (!controller) {
		controller = new AbortController();
		lifetimes.set(session, controller);
	}
	return controller.signal;
}

export function trackSessionWork<T>(session: object, operation: () => Promise<T>): Promise<T> {
	const pending = work.get(session) ?? new Set<Promise<void>>();
	work.set(session, pending);
	let finish!: () => void;
	const settled = new Promise<void>((resolve) => {
		finish = resolve;
	});
	pending.add(settled);
	const ancestors = new Set(currentWork.getStore());
	ancestors.add(settled);
	const result = currentWork.run(ancestors, async () => operation());
	void result
		.finally(() => {
			pending.delete(settled);
			finish();
		})
		.catch(() => {});
	return result;
}

export function abortSessionWork(session: object): void {
	sessionLifetime(session);
	lifetimes.get(session)!.abort();
}

// A /reload command may be admitted inside a prompt. It drains peers, not its own caller.
// Terminal disposal never excludes callers: callback settlement remains part of cleanup.
export async function drainSessionWork(session: object, excludeCallingWork = false): Promise<void> {
	const ancestors = excludeCallingWork ? currentWork.getStore() : undefined;
	while (true) {
		const pending = [...(work.get(session) ?? [])].filter((item) => !ancestors?.has(item));
		if (!pending.length) return;
		await Promise.all(pending);
	}
}

export function renewSessionWork(session: object): void {
	lifetimes.delete(session);
}
