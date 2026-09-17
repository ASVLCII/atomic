import { afterEach, expect, test, vi } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { RpcProviderAuth } from "../src/modes/rpc/rpc-provider-auth.ts";

afterEach(() => vi.unstubAllEnvs());

test("Jev supports stored API-key login and logout without exposing chat models", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "environment-test-key");
	const credentials = AuthStorage.inMemory();
	const runtime = await ModelRuntime.create({ credentials, modelsPath: null });
	const provider = runtime.getProviders().find((candidate) => candidate.id === "typesafe-ai");
	expect(provider?.auth.apiKey).toBeTruthy();
	expect((await runtime.getAuth("typesafe-ai"))?.auth.apiKey).toBe("environment-test-key");
	await runtime.login("typesafe-ai", "api_key", {
		signal: new AbortController().signal,
		prompt: async () => "stored-test-key",
		notify: () => {},
	});
	expect(credentials.peek("typesafe-ai")).toEqual({ type: "api_key", key: "stored-test-key" });
	expect(runtime.hasConfiguredAuth("typesafe-ai")).toBe(true);
	expect((await runtime.getAuth("typesafe-ai"))?.auth.apiKey).toBe("stored-test-key");
	expect(runtime.getModels("typesafe-ai")).toEqual([]);
	expect(await runtime.getAvailable("typesafe-ai")).toEqual([]);
	expect(runtime.canRestoreUnknownModel("typesafe-ai", "jev")).toBe(false);
	await runtime.logout("typesafe-ai");
	expect(credentials.peek("typesafe-ai")).toBeUndefined();
	expect((await runtime.getAuth("typesafe-ai"))?.auth.apiKey).toBe("environment-test-key");
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	expect(await runtime.getAuth("typesafe-ai")).toBeUndefined();
});

test("Jev resolves stored environment references and removes stored-only availability on logout", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	const runtime = await ModelRuntime.create({
		credentials: AuthStorage.inMemory({
			"typesafe-ai": { type: "api_key", key: "$JEV_TEST_KEY", env: { JEV_TEST_KEY: "scoped-test-key" } },
		}),
		modelsPath: null,
	});
	expect(runtime.hasConfiguredAuth("typesafe-ai")).toBe(true);
	expect((await runtime.getAuth("typesafe-ai"))?.auth.apiKey).toBe("scoped-test-key");
	await runtime.logout("typesafe-ai");
	expect(runtime.hasConfiguredAuth("typesafe-ai")).toBe(false);
	expect(await runtime.getAuth("typesafe-ai")).toBeUndefined();
});

test("isolated Jev login persists in the engine and returns no key or chat model", async () => {
	const credentials = AuthStorage.inMemory();
	const modelRuntime = await ModelRuntime.create({ credentials, modelsPath: null });
	const session = { modelRuntime, scopedModels: [] } as unknown as AgentSession;
	const result = await new RpcProviderAuth({ open: async () => ({ value: "isolated-test-secret" }) }).login(
		session,
		"typesafe-ai",
	);
	expect(result.cancelled).toBe(false);
	expect(credentials.peek("typesafe-ai")?.type).toBe("api_key");
	expect((await modelRuntime.getAuth("typesafe-ai"))?.auth.apiKey).toBe("isolated-test-secret");
	expect(JSON.stringify(result)).not.toContain("isolated-test-secret");
	expect(result.models?.some((model) => model.provider === "typesafe-ai")).toBe(false);
});
