import assert from "node:assert/strict";
import { test } from "vitest";
import { MODEL_SELECTION_GUIDE } from "../../packages/coding-agent/src/core/execution-model-router.js";
import { readText } from "../helpers/runtime.js";

test("the general model-selection guide stays compact and points to factual evals", async () => {
	const guide = await readText("packages/coding-agent/docs/models/model-selection.md");
	assert.ok(Buffer.byteLength(JSON.stringify(guide), "utf8") <= 8_000);
	assert.match(guide, /\[Evals\]\(\/models\/evals\)/);
	assert.match(guide, /Role-based thinking effort/);
	assert.match(guide, /Choose only eligible provider\/model and effort pairs/);
	assert.doesNotMatch(guide, /^\| Model \[measured effort\]/m);
	assert.doesNotMatch(guide, /\b\d+% ±\d+\b/);
	assert.doesNotMatch(guide, /implementation and debugging work should look/i);
	assert.doesNotMatch(guide, /planning and research work should look/i);
	assert.doesNotMatch(guide, /narrow domain tasks should use/i);
});

test("the shipped routing guide and user docs both prefer recently released comparable models", async () => {
	const docs = await readText("packages/coding-agent/docs/models/model-selection.md");
	const rule =
		/Prefer recency\..*most recently released model over an older one.*Do not let an older model win only because it has no evals row.*Recency does not override the role's cost tier/su;
	assert.match(docs, rule);
	assert.match(MODEL_SELECTION_GUIDE, rule);
	assert.match(await readText("packages/coding-agent/docs/models/evals.md"), /^\| slug \| Model \| Release date \|/mu);
});

test("the factual evals document includes every Artificial Analysis leaderboard model", async () => {
	const evals = await readText("packages/coding-agent/docs/models/evals.md");
	assert.match(evals, /Artificial Analysis Intelligence Index v4\.3\.2/u);
	assert.doesNotMatch(evals, /frontier[ -]?code|cognition\.com|^\| F\d{2} /imu);
	assert.match(evals, /Terminal-Bench 4\.0/u);
	assert.match(evals, /normalized Elo.*clamp/u);
	assert.match(evals, /ONH rate.*\(partial\+notattempted\)\/\(incorrect\+partial\+notattempted\)/u);
	assert.doesNotMatch(evals, /top 26|Fifty does not fit|32k tokens for state/u);
	assert.doesNotMatch(evals, /^## Grok 4\.7$/mu);
	assert.match(evals, /^Last Accessed: 2026-09-25\.$/mu);
	assert.match(evals, /^\| slug \| Model \| Release date \| idx \| Brief \| Gn \| Auto \| TB4 \|/mu);
	assert.match(
		evals,
		/^\| grok-4-7 \| Grok 4\.7 \(xhigh\) \| 2026-09-21 \| 46\.4 \| 57\.9 \| 59\.8 \| 65\.6 \| 25\.8 \|/mu,
	);
	assert.match(
		evals,
		/^\| grok-4-7-high \| Grok 4\.7 \(high\) \| 2026-09-21 \| 46\.3 \| 56\.8 \| 59\.7 \| 63\.5 \| 24\.7 \|/mu,
	);
	assert.match(
		evals,
		/^\| claude-opus-5-5 \| Claude Opus 5\.5 \(Adaptive Reasoning, Max Effort, Default Fallback\) \| 2026-09-22 \| 57\.6 \| 66\.1 \| 67\.3 \| 69\.5 \| 59\.6 \|/mu,
	);
	assert.match(
		evals,
		/^\| gpt-6-luna \| GPT-6 Luna \(max\) \| 2026-09-22 \| 37\.3 \| 40 \| 43\.4 \| 53\.2 \| 12\.6 \|/mu,
	);
	const table = evals.split("\n").slice(evals.split("\n").findIndex((line) => line.startsWith("| slug |")) + 2);
	const aaRows = table.filter((line) => line.startsWith("| "));
	assert.equal(aaRows.length, Number(/all (\d+) models on the Artificial Analysis leaderboard/u.exec(evals)?.[1]));
	assert.ok(aaRows.length > 500, "the catalog covers the whole leaderboard, not a top-N excerpt");
	const aaHeaderCells = evals.match(/^\| slug \|.*$/mu)![0].split("|").length;
	for (const row of aaRows) assert.equal(row.split("|").length, aaHeaderCells, row);
	assert.doesNotMatch(evals, /no suffix=`?max|slug model names are exact source labels/i);
	const scoreColumns = evals
		.match(/^\| slug \|.*$/mu)![0]
		.split("|")
		.slice(4, -1)
		.map((cell) => cell.trim());
	for (const column of scoreColumns) {
		const description = evals.split("\n").find((line) => line.startsWith(`- \`${column}\`:`));
		assert.ok(description && /, \S.+/.test(description), `${column} must describe what it measures`);
	}
	assert.match(evals, /Openness Index.*not task-solving ability/u);
	assert.match(evals, /`∅`=source null\/absent, not zero/u);
	assert.doesNotMatch(evals, /recommend|prefer|should choose|best for/i);
});
