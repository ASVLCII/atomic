import assert from "node:assert/strict";
import { test } from "vitest";
import {
	filterModelSelectionEvals,
	MODEL_SELECTION_EVALS_JSON_BYTES,
	modelEvidenceTokens,
} from "../../packages/coding-agent/src/core/model-routing-evals.js";

const slugs = [
	"claude-opus-4-6",
	"claude-opus-4-6-adaptive",
	"claude-opus-5-5",
	"claude-opus-5-5-xhigh",
	"claude-opus-5",
	"claude-4-5-sonnet",
	"claude-4-5-sonnet-thinking",
	"claude-sonnet-4-6-non-reasoning-low-effort",
	"gpt-5-5",
	"gpt-5-5-high",
	"gpt-5-5-pro",
	"gpt-5-5-mini",
];
const evals = [
	"# Evals",
	"",
	"| slug | Model |",
	"| --- | --- |",
	...slugs.map((slug) => `| ${slug} | ${slug} |`),
].join("\n");

function rowsFor(candidates: readonly string[]): string[] {
	return filterModelSelectionEvals(evals, candidates)
		.split("\n")
		.slice(4)
		.map((line) => line.split("|")[1]!.trim());
}

test("provider catalog IDs normalize to the same model tokens", () => {
	const expected = ["claude", "4", "6", "opus"];
	for (const id of [
		"anthropic/claude-opus-4-6",
		"claude-opus-4.6",
		"openrouter/anthropic/claude-opus-4.6:batch",
		"amazon-bedrock/global.anthropic.claude-opus-4-6-v1",
		"amazon-bedrock/us.anthropic.claude-opus-4-6-v1",
		"eu.anthropic.claude-opus-4-6-v1",
	])
		assert.deepEqual(modelEvidenceTokens(id), expected, id);
	assert.deepEqual(modelEvidenceTokens("anthropic.claude-opus-4-5-20251101-v1:0"), ["claude", "4", "5", "opus"]);
});

test("a candidate receives its own row and every effort variant of it", () => {
	assert.deepEqual(rowsFor(["anthropic/claude-opus-4-6"]), ["claude-opus-4-6", "claude-opus-4-6-adaptive"]);
	assert.deepEqual(rowsFor(["github-copilot/claude-opus-5.5"]), ["claude-opus-5-5", "claude-opus-5-5-xhigh"]);
	assert.deepEqual(rowsFor(["openai/gpt-5.5"]), ["gpt-5-5", "gpt-5-5-high"]);
});

test("Artificial Analysis version-first Claude slugs match catalog family-first IDs", () => {
	assert.deepEqual(rowsFor(["anthropic/claude-sonnet-4-5"]), ["claude-4-5-sonnet", "claude-4-5-sonnet-thinking"]);
	assert.deepEqual(rowsFor(["anthropic/claude-sonnet-4-6"]), ["claude-sonnet-4-6-non-reasoning-low-effort"]);
});

test("a shorter version or a different product line never borrows another model's evidence", () => {
	assert.deepEqual(rowsFor(["anthropic/claude-opus-5"]), ["claude-opus-5"]);
	assert.deepEqual(rowsFor(["openai/gpt-5.5-pro"]), ["gpt-5-5-pro"]);
	assert.deepEqual(rowsFor(["anthropic/claude-haiku-4-5"]), []);
});

test("filtered evidence keeps the preamble and stays within the routing budget", () => {
	const filtered = filterModelSelectionEvals(evals, ["anthropic/claude-opus-4-6"]);
	assert.ok(filtered.startsWith("# Evals\n\n| slug | Model |\n| --- | --- |\n"));
	const oversized = `${"legend ".repeat(5_000)}\n| slug | Model |\n| --- | --- |\n| claude-opus-4-6 | x |`;
	assert.ok(
		Buffer.byteLength(JSON.stringify(filterModelSelectionEvals(oversized, ["claude-opus-4-6"])), "utf8") <=
			MODEL_SELECTION_EVALS_JSON_BYTES,
	);
});
