const work = new WeakMap<object, Set<Promise<void>>>();
const lifetimes = new WeakMap<object, AbortController>();
export const sessionGenerationClosing = new WeakSet<object>();

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
	const result = operation();
	const settled = result.then(
		() => {},
		() => {},
	);
	pending.add(settled);
	void settled.then(() => pending.delete(settled));
	return result;
}

export function abortSessionWork(session: object): void {
	sessionLifetime(session);
	lifetimes.get(session)!.abort();
}

export async function drainSessionWork(session: object): Promise<void> {
	await Promise.all(work.get(session) ?? []);
}

export function renewSessionWork(session: object): void {
	lifetimes.delete(session);
}
