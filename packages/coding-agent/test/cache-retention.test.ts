import assert from "node:assert/strict";
import { getModel } from "@bastani/pi-ai/compat";
import { it } from "vitest";
import { getDefaultCacheRetention } from "../src/core/cache-retention.js";

// PR #3125: CodeQL flagged URL substring matching as an unreliable provider classifier.
for (const api of ["openai-responses", "openai-completions"] as const) {
	it(`${api} classifies OpenAI endpoints by hostname rather than URL substrings`, () => {
		const base = { ...getModel("openai", "gpt-4o"), api, provider: "custom", compat: {} };
		for (const baseUrl of [
			"https://api.openai.com/v1",
			"https://API.OPENAI.COM/v1",
			"https://api.openai.com:443/v1",
		]) {
			assert.equal(getDefaultCacheRetention({ ...base, baseUrl }), "short", baseUrl);
		}
		for (const baseUrl of [
			"https://api.openai.com.example.com/v1",
			"https://notapi.openai.com/v1",
			"https://example.com/api.openai.com/v1",
			"https://example.com/v1?upstream=api.openai.com",
			"https://api.openai.com@example.com/v1",
			"not-a-url/api.openai.com",
			"",
		]) {
			assert.equal(getDefaultCacheRetention({ ...base, baseUrl }), "long", baseUrl);
		}
		assert.equal(
			getDefaultCacheRetention({ ...base, provider: "openai", baseUrl: "https://proxy.example/v1" }),
			"short",
		);
		assert.equal(
			getDefaultCacheRetention({ ...base, id: "openai/gpt-4o", baseUrl: "https://proxy.example/v1" }),
			"short",
		);
		assert.equal(
			getDefaultCacheRetention({
				...base,
				baseUrl: "https://api.openai.com/v1",
				compat: { supportsLongCacheRetention: true },
			}),
			"long",
		);
	});
}
