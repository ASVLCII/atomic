import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { test } from "vitest";
import { renderCall } from "../../packages/workflows/src/extension/render-call.js";
import { renderResult, type WorkflowToolResult } from "../../packages/workflows/src/extension/render-result.js";

// #3089: validated decisions must be visible to users, not only in model-facing tool metadata.
for (const [workflowType, status, runId] of [
	["none", "not_launched", ""],
	["other-workflow", "not_launched", ""],
	["approved-workflow", "running", "run-123"],
	["approved-workflow", "failed", ""],
] as const) {
	test(`visible router JSON for ${workflowType}/${status}`, () => {
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
			assert.match(rendered, /ROUTER DECISION/);
			assert.match(rendered, new RegExp(`"workflowType": "${workflowType}"`));
			assert.match(rendered, /"maxTokens": 0/);
			assert.match(rendered, /"maxCost": 1\.125/);
			assert.match(rendered, /15min/);
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
			assert.match(rendered, /ROUTER DECISION/);
			assert.doesNotMatch(rendered, /started in background|in progress|accepted|running/);
		}
	}
});

// #3106: presentation uses canonical labels directly for reservation and execution.
for (const estimatedDuration of ["15min", "1hr", "1hr15min", "23hr45min", "1d", ">1d", "unknown"] as const) {
	test(`route presents ${estimatedDuration} without a display conversion`, () => {
		const rendered = renderResult(
			{
				action: "route",
				workflowType: "goal",
				workflowId: "reserved-id",
				status: "reserved",
				routerDecision: { workflowType: "goal", estimatedDuration, maxBudget: {} },
			},
			{ plain: true, width: 80 },
		);
		assert.ok(rendered.includes(estimatedDuration));
		assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 80));
		assert.doesNotMatch(rendered, /started in background/);
	});
}

for (const status of ["reserved", "not_launched", "failed"] as const) {
	test(`route ${status} boxes the complete structured result`, () => {
		const result: WorkflowToolResult = {
			action: "route",
			workflowType: status === "reserved" ? "goal" : status === "not_launched" ? "none" : "",
			workflowId: status === "reserved" ? "reserved-id" : "",
			status,
			...(status === "failed"
				? { error: "Routing unavailable. Retry later." }
				: {
						routerDecision: {
							workflowType: status === "reserved" ? "goal" : "none",
							estimatedDuration: "1hr15min" as const,
							maxBudget: { maxTokens: 0 },
						},
					}),
			...(status === "reserved" ? { inputSchema: {} } : { message: "Keep  spacing and 日本語." }),
		};
		for (const plain of [false, true]) {
			for (const isPartial of [false, true]) {
				const rendered = renderResult(result, { plain, isPartial, width: 100 });
				assert.match(rendered, /╭ WORKFLOW ROUTE /);
				assert.match(rendered, /╰─+╯/);
				assert.doesNotMatch(rendered, /ROUTER DECISION/);
				for (const line of JSON.stringify(result, null, 2).split("\n")) {
					assert.ok(rendered.includes(` ${line} `), line);
				}
				assert.ok(rendered.split("\n").every((line) => visibleWidth(line) === 100));
				const compact = renderResult(result, { plain, isPartial, width: 32 });
				assert.ok(compact.split("\n").every((line) => visibleWidth(line) === 32));
			}
		}
	});
}

test("route request timeout retains the workflow timeout notice", () => {
	const rendered = renderResult(
		{
			action: "route",
			status: "failed",
			code: "WORKFLOW_TIMEOUT",
			timeoutMs: 120000,
			error: "Workflow route request timed out after 120000ms.",
		},
		{ plain: true, width: 80 },
	);
	assert.match(rendered, /╭ WORKFLOW TIMEOUT /);
	assert.match(rendered, /Workflow route request timed out after 120000ms\./);
	assert.doesNotMatch(rendered, /routerDecision|estimatedDuration/);
});
