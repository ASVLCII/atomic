import { AsyncLocalStorage } from "node:async_hooks";
import type { Extension, ExtensionRuntime } from "./types.ts";

type Callback = (...args: never[]) => unknown;

interface Invocation {
	runtimes: Map<ExtensionRuntime, ExtensionRuntime>;
	extensions: Map<Extension, Extension>;
	callbacks: Map<Callback, Callback>;
}
// Built/source loaders can coexist. This is invocation context, not a session cache.
const key = Symbol.for("atomic.extension-invocation.v1");
const host = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<Invocation> };
host[key] ??= new AsyncLocalStorage<Invocation>();
const invocation = host[key];

export function resolveInvocationRuntime(runtime: ExtensionRuntime): ExtensionRuntime {
	return invocation.getStore()?.runtimes.get(runtime) ?? runtime;
}

export function invocationRuntime(runtime: ExtensionRuntime): ExtensionRuntime {
	return new Proxy(runtime, {
		get(target, key) {
			return Reflect.get(invocation.getStore()?.runtimes.get(target) ?? target, key);
		},
		set(target, key, value) {
			return Reflect.set(invocation.getStore()?.runtimes.get(target) ?? target, key, value);
		},
	});
}

export function invocationExtension(extension: Extension): Extension {
	return new Proxy(extension, {
		get(target, key) {
			return Reflect.get(invocation.getStore()?.extensions.get(target) ?? target, key);
		},
		set(target, key, value) {
			return Reflect.set(invocation.getStore()?.extensions.get(target) ?? target, key, value);
		},
	});
}

/** Snapshot registration containers, retaining opaque values and function identities. */
export function copyRegistrations<T>(value: T, functions?: (fn: Callback) => Callback): T {
	if (typeof value === "function") return (functions ? functions(value as Callback) : value) as T;
	if (value instanceof Map)
		return new Map([...value].map(([key, item]) => [key, copyRegistrations(item, functions)])) as T;
	if (Array.isArray(value)) return value.map((item) => copyRegistrations(item, functions)) as T;
	if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(
			Reflect.ownKeys(value).map((key) => [key, copyRegistrations(Reflect.get(value, key), functions)]),
		) as T;
	}
	return value;
}

export const registrationFields = [
	"handlers",
	"tools",
	"commands",
	"flags",
	"shortcuts",
	"messageRenderers",
	"entryRenderers",
	"markdownTransformer",
] as const;

export function prepareRegistrationCallbacks(extension: Extension): void {
	for (const key of registrationFields) {
		Reflect.set(
			extension,
			key,
			copyRegistrations(extension[key], (fn) => {
				const wrapped = function (this: unknown, ...args: unknown[]) {
					const replacement = invocation.getStore()?.callbacks.get(wrapped);
					return Reflect.apply(replacement ?? fn, this, args);
				};
				return wrapped;
			}),
		);
	}
}

export function createInvocationBindings(sourceRuntime: ExtensionRuntime, runtime: ExtensionRuntime): Invocation {
	return { runtimes: new Map([[sourceRuntime, runtime]]), extensions: new Map(), callbacks: new Map() };
}

/** Three-way registration merge: replay unchanged factory state, preserve every caller edit. */
export function reconcileRegistration(
	source: unknown,
	baseline: unknown,
	fresh: unknown,
	bindings: Invocation,
): unknown {
	if (typeof baseline === "function" && typeof fresh === "function")
		bindings.callbacks.set(baseline as Callback, fresh as Callback);
	if (source === baseline) return fresh;
	if (source instanceof Map && baseline instanceof Map && fresh instanceof Map) {
		return new Map(
			[...source].map(([key, value]) => [
				key,
				baseline.has(key) ? reconcileRegistration(value, baseline.get(key), fresh.get(key), bindings) : value,
			]),
		);
	}
	if (Array.isArray(source) && Array.isArray(baseline) && Array.isArray(fresh)) {
		return source.map((value, index) => {
			const originalIndex = baseline.indexOf(value);
			const slot = originalIndex < 0 ? index : originalIndex;
			return reconcileRegistration(value, baseline[slot], fresh[slot], bindings);
		});
	}
	if (
		source &&
		baseline &&
		fresh &&
		typeof source === "object" &&
		typeof baseline === "object" &&
		typeof fresh === "object" &&
		Object.getPrototypeOf(source) === Object.prototype &&
		Object.getPrototypeOf(baseline) === Object.prototype
	) {
		return Object.fromEntries(
			Reflect.ownKeys(source).map((key) => [
				key,
				Object.hasOwn(baseline, key)
					? reconcileRegistration(
							Reflect.get(source, key),
							Reflect.get(baseline, key),
							Reflect.get(fresh, key),
							bindings,
						)
					: Reflect.get(source, key),
			]),
		);
	}
	return source;
}

export function bindRegistrationCallbacks(extension: Extension, bindings: Invocation): void {
	for (const key of registrationFields) {
		Reflect.set(
			extension,
			key,
			copyRegistrations(
				extension[key],
				(fn) =>
					function (this: unknown, ...args: unknown[]) {
						return invocation.run(bindings, () => Reflect.apply(fn, this, args));
					},
			),
		);
	}
}

/** Registrations made by copied APIs retain the registering invocation after it returns. */
export function captureRegistrationInvocation<T>(value: T, sourceRuntime: ExtensionRuntime): T {
	const bindings = invocation.getStore();
	if (!bindings?.runtimes.has(sourceRuntime)) return value;
	return copyRegistrations(
		value,
		(fn) =>
			function (this: unknown, ...args: unknown[]) {
				return invocation.run(bindings, () => Reflect.apply(fn, this, args));
			},
	);
}
