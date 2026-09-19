import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { test } from "vitest";
import { renderCall } from "../../packages/workflows/src/extension/render-call.js";
import { renderResult, type WorkflowToolResult } from "../../packages/workflows/src/extension/render-result.js";

// Run receipts retain status and identity without repeating routing metadata.
for (const [workflowType, status, runId] of [
	["none", "not_launched", ""],
	["other-workflow", "not_launched", ""],
	["approved-workflow", "running", "run-123"],
	["approved-workflow", "failed", ""],
] as const) {
	test(`run hides router JSON for ${workflowType}/${status}`, () => {
		const decision = {
			workflowType,
			maxBudget: { maxTokens: 0, maxCost: 1.125 },
			estimatedDuration: "15min" as const,
		};
		const result: WorkflowToolResult = {
			action: "run",
			status,
			runId,
			routerDecision: decision,
			message: workflowType === "none" ? "Continue inline." : "Inspect the selected workflow.",
			...(status === "failed" ? { error: "Setup unavailable" } : {}),
		};
		for (const plain of [false, true]) {
			const rendered = renderResult(result, { plain, width: 80 });
			assert.doesNotMatch(rendered, /ROUTER DECISION|workflowType|maxBudget|estimatedDuration/);
			assert.equal(rendered, renderResult({ ...result, routerDecision: undefined }, { plain, width: 80 }));
			if (workflowType === "none") assert.match(rendered, /Continue inline/);
			if (status === "failed") assert.match(rendered, /Setup unavailable/);
			if (runId) assert.match(rendered, /run-123/);
		}
		// Shared workflow panels have a 32-cell minimum width.
		const compact = renderResult(result, { width: 32, plain: true });
		assert.ok(compact.split("\n").every((line) => visibleWidth(line) <= 32));
	});
}

test("no fabricated router JSON on bypass or inference failure", () => {
	for (const status of ["running", "failed"]) {
		assert.doesNotMatch(
			renderResult({ action: "run", status, runId: "" }, { plain: true }),
			/ROUTER DECISION|workflowType|maxBudget/,
		);
	}
});

test("run call displays no assistant-selected workflow before routing", () => {
	assert.equal(renderCall({ action: "run", workflow: "goal" }), "workflow: run");
	assert.equal(renderCall({ workflow: "goal" }), "workflow: run");
});

test("needs_input renders a selected but unlaunched workflow, including partial results", () => {
	for (const plain of [false, true]) {
		for (const isPartial of [false, true]) {
			const rendered = renderResult(
				{
					action: "run",
					name: "chosen",
					status: "needs_input",
					runId: "",
					routerDecision: { workflowType: "chosen", maxBudget: {}, estimatedDuration: "unknown" },
					message: "No workflow was launched. Required input: approval.",
				},
				{ plain, isPartial, width: 100 },
			);
			assert.match(rendered, /chosen/);
			assert.match(rendered, /needs input/);
			assert.match(rendered, /No workflow was launched/);
			assert.match(rendered, /Required input: approval/);
			assert.doesNotMatch(rendered, /ROUTER DECISION|workflowType|maxBudget|estimatedDuration/);
			assert.doesNotMatch(rendered, /started in background|in progress|accepted|running/);
		}
	}
});

for (const status of ["running", "completed", "failed", "skipped", "cancelled", "blocked", "killed"] as const) {
	test(`run preserves ${status} receipts with routing metadata`, () => {
		const receipt: WorkflowToolResult = {
			action: "run",
			name: "chosen",
			runId: "339e05a4-2289-408e-9076-d1a348f582ae",
			status,
		};
		const decision = { workflowType: "chosen", maxBudget: {}, estimatedDuration: "unknown" as const };
		for (const plain of [false, true]) {
			for (const isPartial of [false, true]) {
				for (const width of [32, 80]) {
					const opts = { plain, isPartial, width };
					const result: WorkflowToolResult = { ...receipt, routerDecision: decision };
					const rendered = renderResult(result, opts);
					assert.equal(rendered, renderResult(receipt, opts));
					assert.doesNotMatch(rendered, /ROUTER DECISION|workflowType|maxBudget|estimatedDuration/);
					assert.strictEqual(result.routerDecision, decision);
					if (width === 80) {
						assert.ok(rendered.includes(receipt.runId));
						if (!isPartial) assert.match(rendered, /chosen/);
					}
					assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= width));
				}
			}
		}
	});
}

// #3106: presentation uses canonical labels directly for reservation and execution.
for (const estimatedDuration of ["15min", "1hr", "1hr15min", "23hr45min", "1d", ">1d", "unknown"] as const) {
	test(`route presents ${estimatedDuration} without a display conversion`, () => {
		const rendered = renderResult(
			{
				action: "route",
				workflowType: "goal",
				workflowId: "reserved-id",
				status: "reserved",
				estimatedDuration,
				routerDecision: { workflowType: "goal", estimatedDuration, maxBudget: {} },
			},
			{ plain: true, width: 80 },
		);
		assert.ok(rendered.includes(estimatedDuration));
		assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 80));
		assert.doesNotMatch(rendered, /started in background/);
	});
}
