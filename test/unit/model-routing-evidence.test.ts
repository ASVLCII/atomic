import assert from "node:assert/strict";
import { test } from "vitest";
import { readJson, readText } from "../helpers/runtime.js";

interface SourceFidelityFixture {
	readonly counts: {
		readonly aaRows: number;
		readonly aaAggregateRows: number;
		readonly aaDisplayedConstituentRecords: number;
		readonly aaDisplayedTotalRecords: number;
		readonly deepsweRows: number;
		readonly frontierMainRows: number;
		readonly frontierExtendedRows: number;
	};
	readonly aaRows: readonly string[];
	readonly deepSweRows: readonly string[];
	readonly frontierRows: readonly string[];
	readonly sentinels: Record<string, string>;
}

const fixturePath = "test/fixtures/router-benchmark/source-fidelity.json";

async function sourceFixture(): Promise<SourceFidelityFixture> {
	return readJson<SourceFidelityFixture>(fixturePath);
}

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

test("the factual evals document preserves broad primary-source benchmark rows", async () => {
	const evals = await readText("packages/coding-agent/docs/models/evals.md");
	const fixture = await sourceFixture();
	assert.match(evals, /Artificial Analysis/);
	assert.match(evals, /DeepSWE/);
	assert.match(evals, /FrontierCode/);
	assert.match(evals, /Terminal-Bench/);
	assert.match(evals, /pass@1/);
	assert.match(evals, new RegExp(`${fixture.counts.aaRows}-config default-chart union`));
	assert.match(evals, new RegExp(`${fixture.counts.aaDisplayedConstituentRecords} displayed constituent records`));
	assert.match(evals, new RegExp(`All ${fixture.counts.frontierMainRows} Best rows`));
	assert.equal(fixture.aaRows.filter((line) => evals.includes(line)).length, fixture.counts.aaRows);
	assert.equal(fixture.deepSweRows.filter((line) => evals.includes(line)).length, fixture.counts.deepsweRows);
	assert.equal(fixture.frontierRows.filter((line) => evals.includes(line)).length, fixture.counts.frontierMainRows);
	for (const [name, row] of Object.entries(fixture.sentinels)) assert.ok(evals.includes(row), name);
	assert.match(evals, /Fable 5 fallback=Opus 4\.8/);
	assert.match(evals, /Inkling `0\.99` is an unexplained source key/);
	assert.match(evals, /`∅`=source null\/absent, not zero/);
	assert.doesNotMatch(evals, /recommend|prefer|should choose|best for/i);
});
