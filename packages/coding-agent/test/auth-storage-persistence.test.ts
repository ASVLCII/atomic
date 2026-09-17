import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { AuthStorage, type AuthStorageBackend } from "../src/core/auth-storage.ts";

class ControllableAuthBackend implements AuthStorageBackend {
	value: string | undefined;
	writeError: Error | undefined;

	constructor(value?: string) {
		this.value = value;
	}

	read(): string | undefined {
		return this.value;
	}

	withLock<T>(fn: Parameters<AuthStorageBackend["withLock"]>[0]): T {
		const { result, next } = fn(this.value);
		if (next !== undefined) {
			if (this.writeError) throw this.writeError;
			this.value = next;
		}
		return result as T;
	}

	async withLockAsync<T>(fn: Parameters<AuthStorageBackend["withLockAsync"]>[0]): Promise<T> {
		const { result, next } = await fn(this.value);
		if (next !== undefined) {
			if (this.writeError) throw this.writeError;
			this.value = next;
		}
		return result as T;
	}
}

describe("AuthStorage persistence failures", () => {
	test("surfaces malformed storage without overwriting the last valid snapshot", async () => {
		const backend = new ControllableAuthBackend(JSON.stringify({ anthropic: { type: "api_key", key: "existing" } }));
		const storage = AuthStorage.fromStorage(backend);
		backend.value = "{invalid-json";
		storage.reload();

		await expect(storage.modify("openai", async () => ({ type: "api_key", key: "new" }))).rejects.toThrow();
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
		expect(await storage.read("openai")).toBeUndefined();
		expect(backend.value).toBe("{invalid-json");
	});

	test("failed modify remains transactional in storage and memory", async () => {
		const backend = new ControllableAuthBackend(JSON.stringify({ anthropic: { type: "api_key", key: "existing" } }));
		const storage = AuthStorage.fromStorage(backend);
		backend.writeError = new Error("disk full");

		await expect(storage.modify("anthropic", async () => ({ type: "api_key", key: "replacement" }))).rejects.toThrow(
			"disk full",
		);
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
		expect(JSON.parse(backend.value ?? "{}")).toEqual({ anthropic: { type: "api_key", key: "existing" } });
	});

	test("failed delete remains transactional in storage and memory", async () => {
		const backend = new ControllableAuthBackend(JSON.stringify({ anthropic: { type: "api_key", key: "existing" } }));
		const storage = AuthStorage.fromStorage(backend);
		backend.writeError = new Error("disk full");

		await expect(storage.delete("anthropic")).rejects.toThrow("disk full");
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
		expect(JSON.parse(backend.value ?? "{}")).toEqual({ anthropic: { type: "api_key", key: "existing" } });
	});

	test("a repaired credential snapshot accepts the next modification", async () => {
		const backend = new ControllableAuthBackend("{invalid-json");
		const storage = AuthStorage.fromStorage(backend);
		backend.value = JSON.stringify({ anthropic: { type: "api_key", key: "existing" } });

		await storage.modify("openai", async () => ({ type: "api_key", key: "new" }));

		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
		expect(await storage.read("openai")).toEqual({ type: "api_key", key: "new" });
	});

	test("delete is serialized behind an in-flight modification", async () => {
		const storage = AuthStorage.inMemory({ anthropic: { type: "api_key", key: "existing" } });
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const modification = storage.modify("anthropic", async () => {
			await gate;
			return { type: "api_key", key: "replacement" };
		});
		const deletion = storage.delete("anthropic");

		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
		release();
		await Promise.all([modification, deletion]);
		expect(await storage.read("anthropic")).toBeUndefined();
	});

	test("does not commit a late modify after cancellation", async () => {
		// Issue #3085
		const storage = AuthStorage.inMemory({ anthropic: { type: "api_key", key: "existing" } });
		let finish!: (credential: { type: "api_key"; key: string }) => void;
		let markEntered!: () => void;
		const entered = new Promise<void>((resolve) => {
			markEntered = resolve;
		});
		const controller = new AbortController();
		const pending = storage.modify(
			"anthropic",
			async () => {
				markEntered();
				return new Promise((resolve) => {
					finish = resolve;
				});
			},
			{ signal: controller.signal },
		);
		await entered;
		controller.abort();
		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		finish({ type: "api_key", key: "stale" });
		await Promise.resolve();
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
	});

	test("releases the write lock after a cancelled in-flight modify", async () => {
		// Issue #3085
		const storage = AuthStorage.inMemory({ anthropic: { type: "api_key", key: "existing" } });
		const controller = new AbortController();
		const hung = storage.modify("anthropic", async () => new Promise(() => {}), { signal: controller.signal });
		controller.abort();
		await expect(hung).rejects.toMatchObject({ name: "AbortError" });

		await storage.modify("anthropic", async () => ({ type: "api_key", key: "recovered" }));
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "recovered" });
	});

	test("file-backed storage does not persist a late callback after abort", async () => {
		// Issue #3085
		const directory = mkdtempSync(join(tmpdir(), "auth-3085-"));
		const authPath = join(directory, "auth.json");
		try {
			const storage = AuthStorage.create(authPath);
			await storage.modify("anthropic", async () => ({ type: "api_key", key: "existing" }));
			let finish!: (credential: { type: "api_key"; key: string }) => void;
			let markEntered!: () => void;
			const entered = new Promise<void>((resolve) => {
				markEntered = resolve;
			});
			const controller = new AbortController();
			const pending = storage.modify(
				"anthropic",
				async () => {
					markEntered();
					return new Promise((resolve) => {
						finish = resolve;
					});
				},
				{ signal: controller.signal },
			);
			await entered;
			controller.abort();
			await expect(pending).rejects.toMatchObject({ name: "AbortError" });
			finish({ type: "api_key", key: "stale" });
			await Promise.resolve();
			expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "existing" });
			expect(JSON.parse(readFileSync(authPath, "utf8"))).toEqual({
				anthropic: { type: "api_key", key: "existing" },
			});

			await storage.modify("anthropic", async () => ({ type: "api_key", key: "recovered" }));
			expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "recovered" });
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
