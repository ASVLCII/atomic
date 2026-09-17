import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import type { AgentSession } from "../src/core/agent-session.js";
import { AuthStorage } from "../src/core/auth-storage.js";
import { ModelRuntime } from "../src/core/model-runtime.js";
import { RpcProviderAuth } from "../src/modes/rpc/rpc-provider-auth.js";

afterEach(() => vi.unstubAllEnvs());

test("Jev supports stored API-key login and logout without exposing chat models", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "environment-test-key");
	const credentials = AuthStorage.inMemory();
	const runtime = await ModelRuntime.create({ credentials, modelsPath: null });
	const provider = runtime.getProviders().find((candidate) => candidate.id === "typesafe-ai");
	assert.ok(provider?.auth.apiKey);
	assert.equal((await runtime.getAuth("typesafe-ai"))?.auth.apiKey, "environment-test-key");
	await runtime.login("typesafe-ai", "api_key", {
		signal: new AbortController().signal,
		prompt: async () => "stored-test-key",
		notify: () => {},
	});
	assert.deepEqual(credentials.peek("typesafe-ai"), { type: "api_key", key: "stored-test-key" });
	assert.equal(runtime.hasConfiguredAuth("typesafe-ai"), true);
	assert.equal((await runtime.getAuth("typesafe-ai"))?.auth.apiKey, "stored-test-key");
	assert.deepEqual(runtime.getModels("typesafe-ai"), []);
	assert.deepEqual(await runtime.getAvailable("typesafe-ai"), []);
	assert.equal(runtime.canRestoreUnknownModel("typesafe-ai", "jev"), false);
	await runtime.logout("typesafe-ai");
	assert.equal(credentials.peek("typesafe-ai"), undefined);
	assert.equal((await runtime.getAuth("typesafe-ai"))?.auth.apiKey, "environment-test-key");
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	assert.equal(await runtime.getAuth("typesafe-ai"), undefined);
});

test("Jev resolves stored environment references and removes stored-only availability on logout", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	const runtime = await ModelRuntime.create({
		credentials: AuthStorage.inMemory({
			"typesafe-ai": { type: "api_key", key: "$JEV_TEST_KEY", env: { JEV_TEST_KEY: "scoped-test-key" } },
		}),
		modelsPath: null,
	});
	assert.equal(runtime.hasConfiguredAuth("typesafe-ai"), true);
	assert.equal((await runtime.getAuth("typesafe-ai"))?.auth.apiKey, "scoped-test-key");
	await runtime.logout("typesafe-ai");
	assert.equal(runtime.hasConfiguredAuth("typesafe-ai"), false);
	assert.equal(await runtime.getAuth("typesafe-ai"), undefined);
});

test("isolated Jev login persists in the engine and returns no key or chat model", async () => {
	const credentials = AuthStorage.inMemory();
	const modelRuntime = await ModelRuntime.create({ credentials, modelsPath: null });
	const session = { modelRuntime, scopedModels: [] } as unknown as AgentSession;
	const result = await new RpcProviderAuth({ open: async () => ({ value: "isolated-test-secret" }) }).login(
		session,
		"typesafe-ai",
	);
	assert.equal(result.cancelled, false);
	assert.equal(credentials.peek("typesafe-ai")?.type, "api_key");
	assert.equal((await modelRuntime.getAuth("typesafe-ai"))?.auth.apiKey, "isolated-test-secret");
	assert.equal(JSON.stringify(result).includes("isolated-test-secret"), false);
	assert.equal(
		result.models?.some((model) => model.provider === "typesafe-ai"),
		false,
	);
});
