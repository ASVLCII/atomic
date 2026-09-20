import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@bastani/pi-ai/compat";
import { afterEach, it, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createTestResourceLoader } from "./utilities.ts";

interface CachePayload {
	system: Array<{ cache_control?: { type: "ephemeral"; ttl?: "1h" } }>;
}

afterEach(() => vi.unstubAllEnvs());

it("session requests serialize long caching, retain overrides and obey provider capabilities", async () => {
	vi.stubEnv("PI_CACHE_RETENTION", undefined);
	const cwd = mkdtempSync(join(tmpdir(), "atomic-cache-retention-"));
	const credentials = AuthStorage.inMemory();
	await credentials.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
	const modelRuntime = await ModelRuntime.create({ credentials, modelsPath: null });
	const model = getModel("anthropic", "claude-haiku-4-5");
	const { session } = await createAgentSession({
		cwd,
		agentDir: cwd,
		model,
		modelRuntime,
		sessionManager: SessionManager.inMemory(cwd),
		settingsManager: SettingsManager.inMemory(),
		resourceLoader: createTestResourceLoader(),
		builtins: { workflows: false, subagents: false, mcp: false, "web-access": false, intercom: false },
		tools: [],
	});
	try {
		for (const scenario of [
			{ retention: undefined, supported: true, expected: { type: "ephemeral", ttl: "1h" } },
			{ retention: "short", supported: true, expected: { type: "ephemeral" } },
			{ retention: "none", supported: true, expected: undefined },
			{ retention: "long", supported: true, expected: { type: "ephemeral", ttl: "1h" } },
			{ retention: undefined, supported: false, expected: { type: "ephemeral" } },
		] as const) {
			let payload: CachePayload | undefined;
			const stream = await session.agent.streamFunction(
				{ ...model, compat: { ...model.compat, supportsLongCacheRetention: scenario.supported } },
				{ systemPrompt: "Cache this prefix", messages: [{ role: "user", content: "Hello", timestamp: 0 }] },
				{
					cacheRetention: scenario.retention,
					onPayload: (value) => {
						payload = value as CachePayload;
						// Stop before the HTTP boundary: no credentials, paid calls or cache-warming required.
						throw new Error("payload captured");
					},
				},
			);
			await stream.result();
			assert.ok(payload, "provider payload must be captured");
			assert.deepEqual(payload.system[0].cache_control, scenario.expected);
		}
	} finally {
		await session.dispose();
		rmSync(cwd, { recursive: true, force: true });
	}
});
