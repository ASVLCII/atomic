import assert from "node:assert/strict";
import { test } from "vitest";
import { readText } from "../helpers/runtime.js";

test("the general model-selection guide stays compact and points to factual evals", async () => {
	const guide = await readText("packages/coding-agent/docs/models/model-selection.md");
	assert.ok(Buffer.byteLength(JSON.stringify(guide), "utf8") <= 8_000);
	assert.match(guide, /\[Evals\]\(\/models\/evals\)/);
	assert.match(guide, /Role-based thinking effort/);
	assert.match(guide, /Choose only eligible provider\/model and effort pairs/);
	assert.doesNotMatch(guide, /^\| Model \[measured effort\]/m);
	assert.doesNotMatch(guide, /\b\d+% ±\d+\b/);
});

test("the complete factual evals document fits the routing context without truncating scores", async () => {
	const evals = await readText("packages/coding-agent/docs/models/evals.md");
	assert.ok(Buffer.byteLength(JSON.stringify(evals), "utf8") <= 8_000);
	assert.match(evals, /Artificial Analysis/);
	assert.match(evals, /DeepSWE/);
	assert.match(evals, /FrontierCode/);
	assert.match(evals, /Terminal-Bench/);
	assert.match(evals, /pass@1/);
	assert.doesNotMatch(evals, /recommend|prefer|should choose|best for/i);
});
