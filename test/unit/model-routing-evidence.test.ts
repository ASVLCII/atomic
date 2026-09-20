import assert from "node:assert/strict";
import { test } from "vitest";
import { routingEvidence } from "../../packages/coding-agent/src/core/model-routing-evidence.js";
import { readText } from "../helpers/runtime.js";

const ids = [
	"gpt-6-astra",
	"gemini-3.8-flash",
	"claude-opus-5",
	"gpt-5.6-sol",
	"claude-fable-5",
	"glm-5.3",
	"kimi-k3",
	"grok-4.6",
	"gpt-5.6-luna",
	"gpt-5.5",
	"gemini-3.7-flash",
	"glm-5.3-flash",
	"deepseek-v4-pro",
	"claude-opus-4.8",
	"qwen3.8-max",
	"muse-spark-1.2",
	"claude-sonnet-5",
	"deepseek-v4-flash",
	"gemini-3.6-flash",
	"glm-5.2",
	"gemini-3.5-flash",
	"claude-fable-5-1",
	"gpt-5.6-terra",
	"muse-spark-1.3",
	"deepseek-v4-pro-0813",
	"deepseek-v4-flash-0731",
];

test("compact routing measurements preserve documented configuration, units and source precision", async () => {
	const docs = await readText("packages/coding-agent/docs/models/evals.md");
	const tables = docs
		.split("\n")
		.filter((line) => line.startsWith("| "))
		.map((line) =>
			line
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);
	const [deepSwe, aa] = routingEvidence(ids);
	assert.ok(deepSwe && aa);
	assert.equal(deepSwe.date, "2026-09-03");
	assert.equal(aa.retrieved, "2026-09-08");
	assert.match(docs, /September 3, 2026/);
	assert.match(docs, /2026-09-08/);
	assert.match(docs, /Intelligence Index v4.3/);
	assert.equal(deepSwe.rows.length, 21);
	assert.equal(aa.rows.length, 31);
	for (const [id, effort, score, interval, cost, tokens, steps] of deepSwe.rows) {
		const row = tables.find(([label]) => label === `${id} [${effort}]`);
		assert.ok(row, String(id));
		assert.equal(row[1], `${score}% ±${interval}`);
		assert.equal(Number(row[2]!.replace("$", "")), cost);
		assert.equal(row[3], `${tokens}k`);
		assert.equal(Number(row[4]), steps);
	}
	for (const [, label, ...scores] of aa.rows) {
		const rows = tables.filter((row) => row[0] === label && row.slice(1).every((cell) => /^\d+%$/.test(cell)));
		assert.equal(rows.length, 2, String(label));
		assert.deepEqual(
			rows.flatMap((row) => row.slice(1).map((cell) => Number(cell.slice(0, -1)))),
			scores,
			String(label),
		);
	}
});

test("unavailable identities and unmeasured variants do not acquire predecessor evidence", () => {
	assert.deepEqual(
		routingEvidence(["custom", "gpt-6-astra-fast", "claude-fable-latest", "anthropic/claude-opus-5"]),
		[],
	);
	const selected = routingEvidence(["gpt-6-astra"]);
	assert.ok(selected.every((dataset) => dataset.rows.every(([id]) => id === "gpt-6-astra")));
	assert.ok(Buffer.byteLength(JSON.stringify(selected)) < 4_000);
	assert.ok(Buffer.byteLength(JSON.stringify(routingEvidence(ids))) < 12_000);
});
