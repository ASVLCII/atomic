import assert from "node:assert/strict";
import { Compile } from "typebox/compile";
import { test } from "vitest";
import {
	durationCriteria,
	estimatedDurations,
	WorkflowEstimatedDurationSchema,
} from "../../packages/workflows/src/extension/workflow-estimated-duration.js";

// Regression for #3106: wire labels are the complete canonical quarter-hour set.
test("workflow durations enumerate exactly 96 finite labels and two sentinels", () => {
	const expected = Array.from({ length: 96 }, (_, index) => {
		const minutes = (index + 1) * 15;
		if (minutes === 1440) return "1d";
		const hours = Math.floor(minutes / 60);
		return `${hours ? `${hours}hr` : ""}${minutes % 60 ? `${minutes % 60}min` : ""}`;
	});
	expected.push("unknown", ">1d");
	assert.deepEqual(estimatedDurations, expected);
	assert.deepEqual(Object.keys(durationCriteria), expected);
	const validator = Compile(WorkflowEstimatedDurationSchema);
	for (const value of expected) assert.equal(validator.Check(value), true, value);
	for (const value of [
		"",
		"0min",
		"16min",
		"24hr",
		"25hr",
		"1hr0min",
		"15",
		" 15min",
		"under_5_minutes",
		"5_to_15_minutes",
		"15_to_60_minutes",
		"1_to_4_hours",
		"over_4_hours",
	])
		assert.equal(validator.Check(value), false, value);
});

test("workflow duration meanings define rounding boundaries and insufficient evidence", () => {
	for (const [label, lower, upper] of [
		["15min", 0, 15],
		["1hr", 45, 60],
		["1hr15min", 60, 75],
		["23hr45min", 1410, 1425],
		["1d", 1425, 1440],
	] as const) {
		assert.equal(
			durationCriteria[label],
			`Estimated elapsed wall-clock duration is greater than ${lower} minutes and at most ${upper} minutes. Round positive estimates up to this quarter-hour bucket.`,
		);
	}
	assert.match(durationCriteria[">1d"]!, /greater than 1440 minutes/);
	assert.match(durationCriteria.unknown!, /insufficient evidence/);
});
