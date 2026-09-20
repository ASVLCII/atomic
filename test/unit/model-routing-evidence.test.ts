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
	readonly metadata: Record<
		string,
		{
			readonly url: string;
			readonly accessed: string;
			readonly version: string;
			readonly units: string;
			readonly valueShape: string;
		}
	>;
	readonly shapeChecks: Record<
		string,
		{ readonly ordered: boolean; readonly values: number; readonly null: string; readonly zero?: string }
	>;
}

const fixturePath = "test/fixtures/router-benchmark/source-fidelity.json";
async function sourceFixture(): Promise<SourceFidelityFixture> {
	return readJson<SourceFidelityFixture>(fixturePath);
}
function sectionRows(document: string, prefix: string): string[] {
	return document.split("\n").filter((line) => line.startsWith(prefix) && /^\w\d{2} /.test(line));
}
function sourceValues(row: string, prefix: string): string[] {
	if (prefix === "A") return row.split("|")[1]!.split("/");
	const metrics = row.match(/\] (.+)$/u)?.[1];
	assert.ok(metrics, row);
	return prefix === "F" ? metrics.split("/") : metrics.split(" ");
}
function assertSourceRows(document: string, rows: readonly string[], prefix: string, expectedValues: number): void {
	const actual = sectionRows(document, prefix);
	assert.deepEqual(actual, rows, `${prefix} rows must preserve source order, identity, and displayed values`);
	assert.equal(actual.length, rows.length);
	const values = actual.map((row) => sourceValues(row, prefix));
	for (const rowValues of values) {
		assert.equal(rowValues.length, expectedValues, rowValues.join("/"));
		assert.ok(
			rowValues.every((value) => value === "∅" || value === "—" || /^-?\d+(?:\.\d+)?(?:±\d+)?$/.test(value)),
			rowValues.join("/"),
		);
	}
	if (prefix !== "D") {
		assert.ok(
			values.some((row) => row.includes(prefix === "A" ? "∅" : "—")),
			`${prefix} null sentinel`,
		);
		assert.ok(
			values.some((row) => row.some((value) => /^0(?:\.0+)?$/.test(value))),
			`${prefix} zero sentinel`,
		);
	}
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

test("the factual evals document preserves source-shaped benchmark records and provenance", async () => {
	const evals = await readText("packages/coding-agent/docs/models/evals.md");
	const fixture = await sourceFixture();
	assert.match(evals, /Artificial Analysis Intelligence Index v4\.3\.2/);
	assert.match(evals, /DeepSWE v1\.1/);
	assert.match(evals, /Cognition FrontierCode 1\.1/);
	assert.match(evals, /Terminal-Bench 4\.0/);
	assert.match(evals, /pass@1±95% run-to-run CI \(percent\)/);
	assert.match(evals, /normalized Elo.*clamp/);
	assert.match(evals, /6,000-question.*1−hallucination/);
	assert.match(evals, new RegExp(`${fixture.counts.aaRows}-config default-chart union`));
	assert.match(evals, new RegExp(`${fixture.counts.aaDisplayedConstituentRecords} displayed constituent records`));
	assert.match(evals, /Best rows in source order/);
	assertSourceRows(evals, fixture.aaRows, "A", fixture.shapeChecks.aaRows.values);
	assertSourceRows(evals, fixture.deepSweRows, "D", fixture.shapeChecks.deepSweRows.values - 1);
	assertSourceRows(evals, fixture.frontierRows, "F", fixture.shapeChecks.frontierMainRows.values);
	for (const [name, source] of Object.entries(fixture.metadata)) {
		assert.match(evals, new RegExp(source.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), name);
		assert.match(evals, new RegExp(source.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), name);
		assert.ok(source.units.length > 10, `${name} source units metadata`);
	}
	assert.match(evals, /GPT-6 Astra\[max;codex\]/);
	assert.match(evals, /DeepSeek V4 Pro 0813\[high;chisel\]/);
	assert.match(evals, /MiniMax M3\[none;msa\]/);
	assert.match(evals, /Mistral 3\.5 Medium\[none;chisel\]/);
	assert.match(evals, /Fable 5 fallback=Opus 4\.8/);
	assert.match(evals, /Inkling `0\.99` is unexplained/);
	assert.match(evals, /`∅`=source null\/absent, not zero/);
	assert.doesNotMatch(evals, /recommend|prefer|should choose|best for/i);
});
