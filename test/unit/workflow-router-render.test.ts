import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { test } from "vitest";
import { renderResult, type WorkflowToolResult } from "../../packages/workflows/src/extension/render-result.js";

// #3089: validated decisions must be visible to users, not only in model-facing tool metadata.
for (const [workflowType, status, runId] of [
	["none", "not_launched", ""],
	["other-workflow", "not_launched", ""],
	["approved-workflow", "running", "run-123"],
	["approved-workflow", "failed", ""],
] as const) {
	test(`visible router JSON for ${workflowType}/${status}`, () => {
		const decision = { workflowType, maxBudget: { maxTokens: 0, maxCost: 1.125 } };
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
			assert.match(rendered, /ROUTER DECISION/);
			assert.match(rendered, new RegExp(`"workflowType": "${workflowType}"`));
			assert.match(rendered, /"maxTokens": 0/);
			assert.match(rendered, /"maxCost": 1\.125/);
			assert.doesNotMatch(rendered, /maxDurationMs/);
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
