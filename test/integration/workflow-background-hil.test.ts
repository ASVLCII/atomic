/**
 * BACKGROUND pending-input affordance against a real store and answer path. #2529 / #3027
 */
import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { workflowAnswerAction } from "../../packages/workflows/src/extension/workflow-tool-answer.js";
import { buildStagePromptAdapter } from "../../packages/workflows/src/shared/stage-prompt.js";
import { StageUiBroker } from "../../packages/workflows/src/shared/stage-ui-broker.js";
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

function owningCard(lines: string[], runId: string): string {
	const start = lines.findIndex((line) => line.includes(runId));
	assert.notEqual(start, -1, `missing card for ${runId}`);
	const card = [lines[start]!];
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i]!;
		if (line.includes("╰") || line.trim() === "") break;
		card.push(line);
	}
	return card.join("\n");
}

test("structured stage prompts preview one question and keep multi-question roots general", () => {
	const broker = new StageUiBroker(store);
	const uniqueId = makeRun("structured-unique", "structured-unique");
	const formId = makeRun("structured-form", "structured-form");
	const uniqueAdapter = buildStagePromptAdapter(
		"unique-structured",
		"ask_user_question",
		{ questions: [{ question: "Ready to continue?", options: [{ label: "Yes" }, { label: "No" }] }] },
		1,
	);
	const formAdapter = buildStagePromptAdapter(
		"form-structured",
		"ask_user_question",
		{
			questions: [
				{ question: "First structured field?", options: [] },
				{ question: "Second structured field?", options: [] },
			],
		},
		1,
	);
	assert.ok(uniqueAdapter);
	assert.ok(formAdapter);
	broker.provideStagePrompt(uniqueId, "ask", uniqueAdapter);
	broker.provideStagePrompt(formId, "ask", formAdapter);
	assert.equal(store.recordStageAwaitingInput(uniqueId, "ask", true), true);
	assert.equal(store.recordStageAwaitingInput(formId, "ask", true), true);

	const lines = renderWidgetLines(store.snapshot(), 180);
	const uniqueCard = owningCard(lines, uniqueId);
	const formCard = owningCard(lines, formId);
	assert.match(uniqueCard, /"Ready to continue\?"/);
	assert.match(uniqueCard, new RegExp(`Answer: /workflow connect ${uniqueId}`));
	assert.doesNotMatch(formCard, /First structured field/);
	assert.doesNotMatch(formCard, /Second structured field/);
	assert.doesNotMatch(formCard, /Answer: \/workflow connect/);
	assert.match(lines[0] ?? "", /needs attention/);

	broker.clearStagePrompt(uniqueId, "ask");
	assert.equal(store.recordStageAwaitingInput(uniqueId, "ask", false), true);
	const uniqueAfter = store.runs().find((run) => run.id === uniqueId);
	assert.equal(uniqueAfter?.stages[0]?.inputRequest, undefined);
	const afterUniqueClear = renderWidgetLines(store.snapshot(), 180);
	assert.doesNotMatch(owningCard(afterUniqueClear, uniqueId), /Ready to continue/);
	assert.doesNotMatch(owningCard(afterUniqueClear, uniqueId), /Answer: \/workflow connect/);
	assert.doesNotMatch(owningCard(afterUniqueClear, formId), /Answer: \/workflow connect/);

	broker.clearStagePrompt(formId, "ask");
	assert.equal(store.recordStageAwaitingInput(formId, "ask", false), true);
	const formAfter = store.runs().find((run) => run.id === formId);
	assert.equal(formAfter?.stages[0]?.inputRequest, undefined);
	const cleared = renderWidgetLines(store.snapshot(), 180).join("\n");
	assert.doesNotMatch(cleared, /Ready to continue/);
	assert.doesNotMatch(cleared, /First structured field/);
	assert.doesNotMatch(cleared, /Answer: \/workflow connect/);
});
