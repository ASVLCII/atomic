/**
 * BACKGROUND pending-input affordance against a real store and answer path. #2529 / #3027
 */
import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { workflowAnswerAction } from "../../packages/workflows/src/extension/workflow-tool-answer.js";
import { store } from "../../packages/workflows/src/shared/store.js";
import type { PendingPrompt, StageSnapshot } from "../../packages/workflows/src/shared/store-types.js";
import { installStoreWidget } from "../../packages/workflows/src/tui/store-widget-installer.js";
import { renderWidgetLines } from "../../packages/workflows/src/tui/widget.js";
import { testRunId } from "../helpers/run-id.js";

const runIds = new Set<string>();

afterEach(() => {
	for (const runId of runIds) store.removeRun(runId);
	runIds.clear();
});

function makeRun(seed: string, name: string) {
	const id = testRunId(seed);
	runIds.add(id);
	store.recordRunStart({
		id,
		name,
		inputs: {},
		status: "running",
		stages: [{ id: "ask", name: "ask", status: "running", parentIds: [], toolEvents: [] }] as StageSnapshot[],
		startedAt: Date.now(),
	});
	return id;
}

function prompt(id: string, message: string): PendingPrompt {
	return { id, kind: "input", message, createdAt: Date.now() };
}

test("answer and cancellation clear only the owning background affordance", () => {
	const ownerA = makeRun("owner-a", "alpha");
	const ownerB = makeRun("owner-b", "beta");
	assert.equal(store.recordStagePendingPrompt(ownerA, "ask", prompt("prompt-a", "Answer alpha?")), true);
	assert.equal(store.recordStagePendingPrompt(ownerB, "ask", prompt("prompt-b", "Answer beta?")), true);

	const both = renderWidgetLines(store.snapshot(), 120).join("\n");
	assert.match(both, /"Answer alpha\?"/);
	assert.match(both, /"Answer beta\?"/);

	assert.equal(store.resolveStagePendingPrompt(ownerA, "ask", "prompt-a", true), true);
	const afterAnswer = renderWidgetLines(store.snapshot(), 120).join("\n");
	assert.doesNotMatch(afterAnswer, /Answer alpha/);
	assert.match(afterAnswer, /"Answer beta\?"/);

	assert.equal(store.resolveStagePendingPrompt(ownerB, "ask", "prompt-b", true, { recordAnswer: false }), true);
	const afterCancel = renderWidgetLines(store.snapshot(), 120).join("\n");
	assert.doesNotMatch(afterCancel, /Answer beta/);
	assert.doesNotMatch(afterCancel, new RegExp(`/workflow connect ${ownerB}`));
});

test("background preview updates emit no transcript or model messages", async () => {
	const widgetCalls: Array<{ key: string; factory: unknown }> = [];
	const dispose = installStoreWidget(
		{
			ui: {
				setWidget(key, factory) {
					widgetCalls.push({ key, factory });
				},
				requestRender() {},
			},
		},
		store,
	);
	try {
		const noticesBefore = store.notices().length;
		const runId = makeRun("silent-root", "silent");
		assert.equal(store.recordStagePendingPrompt(runId, "ask", prompt("silent-prompt", "Stay off transcript?")), true);
		await Promise.resolve();
		assert.equal(store.notices().length, noticesBefore);
		assert.equal(
			widgetCalls.every((call) => call.key === "workflow.run"),
			true,
		);
		assert.match(renderWidgetLines(store.snapshot(), 120).join("\n"), /"Stay off transcript\?"/);
	} finally {
		dispose();
	}
});

test("existing explicit workflow answer remains available", async () => {
	const runId = makeRun("answer-root", "answerable");
	assert.equal(store.recordStagePendingPrompt(runId, "ask", prompt("answer-prompt", "Answer me?")), true);
	assert.match(renderWidgetLines(store.snapshot(), 120).join("\n"), /"Answer me\?"/);

	const result = await workflowAnswerAction({ runId, text: "ship it" });
	assert.equal(result.status, "ok");
	assert.doesNotMatch(renderWidgetLines(store.snapshot(), 120).join("\n"), /Answer me/);
	assert.equal(store.runs().find((run) => run.id === runId)?.stages[0]?.pendingPrompt, undefined);
});
