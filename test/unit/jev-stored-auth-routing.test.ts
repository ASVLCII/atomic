import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { AuthStorage } from "../../packages/coding-agent/src/core/auth-storage.js";
import { ModelRegistry } from "../../packages/coding-agent/src/core/model-registry.js";
import { ModelRuntime } from "../../packages/coding-agent/src/core/model-runtime.js";
import { SettingsManager } from "../../packages/coding-agent/src/core/settings-manager.js";
import {
	inferRouterDecision,
	inferStructuredOutput,
	resolveRouterModel,
} from "../../packages/coding-agent/src/core/structured-output/index.js";
import { decisionModel, decisionRequest, jevResponse } from "../helpers/structured-output.js";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

async function storedRuntime(key = "mock-stored-jev-key") {
	const runtime = await ModelRuntime.create({
		modelsPath: null,
		credentials: AuthStorage.inMemory({ "typesafe-ai": { type: "api_key", key } }),
		allowModelNetwork: false,
	});
	return { runtime, registry: new ModelRegistry(runtime) };
}

for (const environmentKey of ["", "mock-env-jev-key"]) {
	test(`stored Jev credentials route and authenticate without chat exposure, env=${Boolean(environmentKey)}`, async () => {
		vi.stubEnv("TYPESAFE_AI_API_KEY", environmentKey);
		const { runtime, registry } = await storedRuntime();
		const transport = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
			assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer mock-stored-jev-key");
			assert.doesNotMatch(String(options?.body), /mock-stored-jev-key|mock-env-jev-key/);
			return Response.json(jevResponse());
		});
		vi.stubGlobal("fetch", transport);
		const request = { ...decisionRequest(), settings: SettingsManager.inMemory(), modelRegistry: registry };
		assert.equal(resolveRouterModel(request).kind, "jev");
		assert.equal((await inferRouterDecision(request)).model, "typesafe-ai/jev");
		assert.equal(
			(await inferStructuredOutput({ ...request, model: { kind: "jev", fullId: "typesafe-ai/jev" } })).model,
			"typesafe-ai/jev",
		);
		assert.equal(transport.mock.calls.length, 2);
		assert.equal(
			registry.getAll().some((model) => model.provider === "typesafe-ai"),
			false,
		);
		assert.equal(
			registry.getAvailable().some((model) => model.provider === "typesafe-ai"),
			false,
		);
		assert.equal(runtime.canRestoreUnknownModel("typesafe-ai", "jev"), false);
		assert.equal(request.currentModel?.id, "chat");
	});
}

test("explicit chat router wins over saved Jev without resolving its key", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	const { registry } = await storedRuntime();
	const getProviderAuth = vi.spyOn(registry, "getProviderAuth");
	vi.spyOn(registry, "getAll").mockReturnValue([decisionModel]);
	assert.equal(resolveRouterModel({ ...decisionRequest(), modelRegistry: registry }).kind, "chat");
	assert.equal(getProviderAuth.mock.calls.length, 0);
});

test("Jev logout removes stored routing preference and falls back to environment when present", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	const { runtime, registry } = await storedRuntime();
	const request = { ...decisionRequest(), settings: SettingsManager.inMemory(), modelRegistry: registry };
	assert.equal(resolveRouterModel(request).kind, "jev");
	await runtime.logout("typesafe-ai");
	assert.equal(resolveRouterModel(request).kind, "chat");
	const transport = vi.fn(async () => Response.json(jevResponse()));
	vi.stubGlobal("fetch", transport);
	await assert.rejects(
		inferStructuredOutput({ ...request, model: { kind: "jev", fullId: "typesafe-ai/jev" } }),
		/requires an API key/,
	);
	assert.equal(transport.mock.calls.length, 0);

	vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-env-remaining");
	const next = await storedRuntime();
	await next.runtime.logout("typesafe-ai");
	assert.equal(resolveRouterModel({ ...request, modelRegistry: next.registry }).kind, "jev");
	assert.equal((await next.registry.getProviderAuth("typesafe-ai"))?.auth.apiKey, "mock-env-remaining");
});

test("saved Jev key interpolation uses ordinary auth resolution", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	vi.stubEnv("JEV_TEST_KEY", "mock-interpolated-key");
	const { registry } = await storedRuntime("$JEV_TEST_KEY");
	const transport = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
		assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer mock-interpolated-key");
		return Response.json(jevResponse());
	});
	vi.stubGlobal("fetch", transport);
	await inferStructuredOutput({
		...decisionRequest(),
		modelRegistry: registry,
		model: { kind: "jev", fullId: "typesafe-ai/jev" },
	});
	assert.equal(transport.mock.calls.length, 1);
});

test("Jev auth failures are redacted and cannot fall back to environment credentials", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "mock-env-key");
	const request = decisionRequest();
	const transport = vi.fn();
	vi.stubGlobal("fetch", transport);
	await assert.rejects(
		inferStructuredOutput({
			...request,
			modelRegistry: {
				...request.modelRegistry,
				getProviderAuth: async () => {
					throw new Error("private-key-material");
				},
			},
			model: { kind: "jev", fullId: "typesafe-ai/jev" },
		}),
		(error: Error) => {
			assert.match(error.message, /Jev credential resolution failed/);
			assert.doesNotMatch(String(error.stack), /private-key-material/);
			assert.equal(error.cause, undefined);
			return true;
		},
	);
	assert.equal(transport.mock.calls.length, 0);
});

test("Jev credential resolution receives the bounded decision signal", async () => {
	const request = decisionRequest();
	const transport = vi.fn();
	vi.stubGlobal("fetch", transport);
	let authSignal: AbortSignal | undefined;
	await assert.rejects(
		inferStructuredOutput({
			...request,
			modelRegistry: {
				...request.modelRegistry,
				getProviderAuth: async (_provider, options) => {
					authSignal = options?.signal;
					return new Promise(() => {});
				},
			},
			model: { kind: "jev", fullId: "typesafe-ai/jev" },
			timeoutMs: 20,
		}),
		/timed out/,
	);
	assert.equal(authSignal?.aborted, true);
	assert.equal(transport.mock.calls.length, 0);
});
