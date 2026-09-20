import assert from "node:assert/strict";
import { test } from "vitest";
import { readText } from "../helpers/runtime.js";

test("the complete routing guide fits alongside task and candidate context", async () => {
	const guide = await readText("packages/coding-agent/docs/models/model-selection.md");
	assert.ok(Buffer.byteLength(JSON.stringify(guide), "utf8") <= 8_000);
	assert.match(guide, /2026-09-03/);
	assert.match(guide, /2026-09-08/);
	assert.match(guide, /measurement configuration/);
	assert.match(guide, /not identical behavior, latency or reliability across serving providers/);
});

test("the guide's DeepSWE table preserves the detailed evals measurements", async () => {
	const guide = await readText("packages/coding-agent/docs/models/model-selection.md");
	const evals = await readText("packages/coding-agent/docs/models/evals.md");
	const rows = (text: string) => text.split("\n").filter((line) => /^\| [^|]+ \[[^\]]+\] \| \d+%/.test(line));
	const normalized = (row: string) => row.replaceAll("$", "");
	assert.equal(rows(guide).length, 21);
	for (const row of rows(guide))
		assert.ok(
			rows(evals).some((other) => normalized(row) === normalized(other)),
			row,
		);
});
