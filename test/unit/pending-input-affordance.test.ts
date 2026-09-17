/**
 * Widget-local pending-input projection. #2529 / #3027
 */
import assert from "node:assert/strict";
import { test } from "vitest";
import type { RunSnapshot, StageSnapshot } from "../../packages/workflows/src/shared/store-types.js";
import {
	pendingInputAffordance,
	sanitizePromptDisplay,
	visibleRootPendingInput,
} from "../../packages/workflows/src/tui/pending-input-affordance.js";

function makeStage(
	id: string,
	name: string,
	status: StageSnapshot["status"],
	extras: Partial<StageSnapshot> = {},
): StageSnapshot {
	return { id, name, status, parentIds: [], toolEvents: [], ...extras };
}

function makeRun(
	id: string,
	name: string,
	status: RunSnapshot["status"],
	stages: StageSnapshot[] = [],
	startedAt = 1_000,
	endedAt?: number,
): RunSnapshot {
	return {
		id,
		name,
		inputs: {},
		status,
		stages,
		startedAt,
		endedAt,
	};
}

function primitive(id: string, message: string) {
	return { id, kind: "confirm" as const, message, createdAt: 1 };
}

function nestedChild(root: RunSnapshot, childId: string, extras: Partial<RunSnapshot> = {}): RunSnapshot {
	root.stages.push(
		makeStage("root-to-child", "child", "running", {
			workflowChildRun: { alias: "child", workflow: "hidden-child", runId: childId },
		}),
	);
	return {
		...makeRun(childId, "hidden-child", "running", [makeStage("ask", "ask", "awaiting_input")]),
		parentRunId: root.id,
		parentStageId: "root-to-child",
		rootRunId: root.id,
		...extras,
	};
}

test("projects one primitive prompt with its concrete ownership tuple", () => {
	const run = makeRun("run-owner", "release-docs", "running");
	run.pendingPrompt = primitive("run-prompt", "  Approve\n\tthis   release?  ");
	assert.deepEqual(pendingInputAffordance(run, [run]), {
		identity: [run.id, null, "run-prompt"],
		visibleRunId: run.id,
		message: "Approve this release?",
	});

	const stageRun = makeRun("stage-owner", "build-check", "running", [makeStage("ask", "ask", "awaiting_input")]);
	stageRun.stages[0]!.pendingPrompt = primitive("stage-prompt", "Enter the approval note");
	assert.deepEqual(pendingInputAffordance(stageRun, [stageRun]), {
		identity: [stageRun.id, "ask", "stage-prompt"],
		visibleRunId: stageRun.id,
		message: "Enter the approval note",
	});
});

test("projects a single-question structured request without mutating raw state", () => {
	const run = makeRun("structured-owner", "readiness", "running", [makeStage("gate", "gate", "awaiting_input")]);
	run.stages[0]!.inputRequest = {
		id: "readiness-request",
		kind: "readiness_gate",
		questions: [{ question: "Ready to continue?", options: [] }],
		createdAt: 1,
	};
	const raw = structuredClone(run);
	assert.deepEqual(pendingInputAffordance(run, [run]), {
		identity: [run.id, "gate", "readiness-request"],
		visibleRunId: run.id,
		message: "Ready to continue?",
	});
	assert.deepEqual(run, raw);
});

test("computes eligibility independently for separate visible roots", () => {
	const alpha = makeRun("alpha", "alpha", "running", [makeStage("ask", "ask", "awaiting_input")]);
	alpha.stages[0]!.pendingPrompt = primitive("alpha-prompt", "Answer alpha?");
	const beta = makeRun("beta", "beta", "running", [makeStage("ask", "ask", "awaiting_input")]);
	beta.stages[0]!.pendingPrompt = primitive("beta-prompt", "Answer beta?");
	const runs = [alpha, beta];
	assert.deepEqual(pendingInputAffordance(alpha, runs)?.identity, [alpha.id, "ask", "alpha-prompt"]);
	assert.deepEqual(pendingInputAffordance(beta, runs)?.identity, [beta.id, "ask", "beta-prompt"]);
});

test("keeps a unique root eligible beside an ambiguous root", () => {
	const unique = makeRun("unique", "unique", "running", [makeStage("ask", "ask", "awaiting_input")]);
	unique.stages[0]!.pendingPrompt = primitive("unique-prompt", "Only this?");
	const ambiguous = makeRun("ambiguous", "ambiguous", "running", [
		makeStage("one", "one", "awaiting_input"),
		makeStage("two", "two", "awaiting_input"),
	]);
	ambiguous.stages[0]!.pendingPrompt = primitive("one-prompt", "First?");
	ambiguous.stages[1]!.pendingPrompt = primitive("two-prompt", "Second?");
	const runs = [unique, ambiguous];
	assert.equal(pendingInputAffordance(unique, runs)?.message, "Only this?");
	assert.equal(pendingInputAffordance(ambiguous, runs), undefined);
	assert.equal(visibleRootPendingInput(ambiguous, runs).hasPendingInput, true);
});

test("transitions one to many to one to none without retaining a selected prompt", () => {
	const run = makeRun("transition", "transition", "running", [
		makeStage("ask", "ask", "awaiting_input"),
		makeStage("other", "other", "running"),
	]);
	run.stages[0]!.pendingPrompt = primitive("first", "First prompt");
	assert.equal(pendingInputAffordance(run, [run])?.identity[2], "first");

	run.stages[1]!.status = "awaiting_input";
	run.stages[1]!.pendingPrompt = primitive("second", "Second prompt");
	assert.equal(pendingInputAffordance(run, [run]), undefined);
	assert.equal(visibleRootPendingInput(run, [run]).hasPendingInput, true);

	delete run.stages[1]!.pendingPrompt;
	run.stages[1]!.status = "running";
	delete run.stages[1]!.awaitingInputSince;
	assert.equal(pendingInputAffordance(run, [run])?.identity[2], "first");

	delete run.stages[0]!.pendingPrompt;
	run.stages[0]!.status = "running";
	delete run.stages[0]!.awaitingInputSince;
	assert.deepEqual(visibleRootPendingInput(run, [run]), { hasPendingInput: false, affordance: undefined });
});

test("descriptor-less waiting markers prevent false uniqueness", () => {
	const mixed = makeRun("promptless-root", "promptless-sibling", "running", [
		makeStage("waiting", "waiting", "awaiting_input"),
		makeStage("ask", "ask", "awaiting_input"),
	]);
	mixed.stages[1]!.pendingPrompt = primitive("real-prompt", "Answer the real prompt");
	assert.equal(pendingInputAffordance(mixed, [mixed]), undefined);
	assert.equal(visibleRootPendingInput(mixed, [mixed]).hasPendingInput, true);

	const sole = makeRun("sole-promptless", "promptless", "running", [
		makeStage("waiting", "waiting", "awaiting_input"),
	]);
	assert.equal(pendingInputAffordance(sole, [sole]), undefined);
	assert.equal(visibleRootPendingInput(sole, [sole]).hasPendingInput, true);
});

test("empty and multi-question requests prevent false uniqueness", () => {
	const empty = makeRun("empty-prompt", "empty", "running", [makeStage("ask", "ask", "awaiting_input")]);
	empty.stages[0]!.pendingPrompt = primitive("empty", " \n\t");
	assert.equal(pendingInputAffordance(empty, [empty]), undefined);
	assert.equal(visibleRootPendingInput(empty, [empty]).hasPendingInput, true);

	const emptySibling = makeRun("empty-sibling", "empty-sibling", "running", [
		makeStage("empty", "empty", "awaiting_input"),
		makeStage("valid", "valid", "awaiting_input"),
	]);
	emptySibling.stages[0]!.pendingPrompt = primitive("empty", " \n\t");
	emptySibling.stages[1]!.pendingPrompt = primitive("valid-sibling-prompt", "Valid sibling prompt");
	assert.equal(pendingInputAffordance(emptySibling, [emptySibling]), undefined);

	const multi = makeRun("multi-question", "multi", "running", [makeStage("ask", "ask", "awaiting_input")]);
	multi.stages[0]!.inputRequest = {
		id: "multi",
		kind: "ask_user_question",
		questions: [
			{ question: "First question", options: [] },
			{ question: "Second question", options: [] },
		],
		createdAt: 1,
	};
	assert.equal(pendingInputAffordance(multi, [multi]), undefined);
	assert.equal(visibleRootPendingInput(multi, [multi]).hasPendingInput, true);
});

test("conflicting descriptors do not select an arbitrary prompt", () => {
	const run = makeRun("conflict", "conflict", "running", [makeStage("ask", "ask", "awaiting_input")]);
	run.stages[0]!.pendingPrompt = primitive("primitive-prompt", "Enter the approval note");
	run.stages[0]!.inputRequest = {
		id: "structured-prompt",
		kind: "ask_user_question",
		questions: [{ question: "Should not be selected", options: [] }],
		createdAt: 1,
	};
	assert.equal(pendingInputAffordance(run, [run]), undefined);
	assert.equal(visibleRootPendingInput(run, [run]).hasPendingInput, true);

	const aligned = makeRun("aligned", "aligned", "running", [makeStage("ask", "ask", "awaiting_input")]);
	aligned.stages[0]!.pendingPrompt = primitive("same-id", "Shared identity");
	aligned.stages[0]!.inputRequest = {
		id: "same-id",
		kind: "ask_user_question",
		questions: [{ question: "Shared identity", options: [] }],
		createdAt: 1,
	};
	assert.deepEqual(pendingInputAffordance(aligned, [aligned])?.identity, [aligned.id, "ask", "same-id"]);
});

test("nested prompts retain owner identity and navigate through the visible root", () => {
	const root = makeRun("visible-root", "nested-release", "running");
	const child = nestedChild(root, "nested-owner");
	child.stages[0]!.pendingPrompt = primitive("nested-prompt", "Continue the child workflow?");
	assert.deepEqual(pendingInputAffordance(root, [child, root]), {
		identity: [child.id, "ask", "nested-prompt"],
		visibleRunId: root.id,
		message: "Continue the child workflow?",
	});

	const otherRoot = makeRun("other-root", "other", "running");
	const otherChild = nestedChild(otherRoot, "other-nested");
	otherChild.stages[0]!.pendingPrompt = primitive("nested-prompt", "Other child?");
	const mixed = [root, child, otherRoot, otherChild];
	assert.deepEqual(pendingInputAffordance(root, mixed)?.identity, [child.id, "ask", "nested-prompt"]);
	assert.deepEqual(pendingInputAffordance(otherRoot, mixed)?.identity, [otherChild.id, "ask", "nested-prompt"]);
});

test("rejects nonreciprocal cyclic missing and conflicting ownership", () => {
	const root = makeRun("unowned-root", "visible-root", "running");
	const claimant = {
		...makeRun("claimant", "claimant", "running", [makeStage("ask", "ask", "awaiting_input")]),
		parentRunId: root.id,
		parentStageId: "missing-boundary",
		rootRunId: root.id,
	};
	claimant.stages[0]!.pendingPrompt = primitive("unowned", "Answer the unowned prompt?");
	assert.equal(pendingInputAffordance(root, [claimant, root]), undefined);
	assert.equal(visibleRootPendingInput(root, [claimant, root]).hasPendingInput, false);

	const cyclicA = makeRun("cycle-a", "cycle-a", "running", [
		makeStage("to-b", "to-b", "running", {
			workflowChildRun: { alias: "b", workflow: "cycle-b", runId: "cycle-b" },
		}),
	]);
	const cyclicB: RunSnapshot = {
		...makeRun("cycle-b", "cycle-b", "running", [
			makeStage("to-a", "to-a", "running", {
				workflowChildRun: { alias: "a", workflow: "cycle-a", runId: "cycle-a" },
			}),
			makeStage("ask", "ask", "awaiting_input"),
		]),
		parentRunId: "cycle-a",
		parentStageId: "to-b",
		rootRunId: "cycle-a",
	};
	cyclicA.parentRunId = "cycle-b";
	cyclicA.parentStageId = "to-a";
	cyclicA.rootRunId = "cycle-a";
	cyclicB.stages[1]!.pendingPrompt = primitive("cycle-prompt", "Cyclic?");
	assert.equal(pendingInputAffordance(cyclicA, [cyclicA, cyclicB]), undefined);

	const conflictRoot = makeRun("conflict-root", "conflict-root", "running", [
		makeStage("to-child", "child", "running", {
			workflowChildRun: { alias: "child", workflow: "child", runId: "conflict-child" },
		}),
	]);
	const conflictChild: RunSnapshot = {
		...makeRun("conflict-child", "child", "running", [makeStage("ask", "ask", "awaiting_input")]),
		parentRunId: conflictRoot.id,
		parentStageId: "to-child",
		rootRunId: "other-root",
	};
	conflictChild.stages[0]!.pendingPrompt = primitive("conflict-prompt", "Conflicting root?");
	assert.equal(pendingInputAffordance(conflictRoot, [conflictRoot, conflictChild]), undefined);
});

test("duplicate identities cannot establish unique ownership", () => {
	const root = makeRun("duplicate-root", "duplicate-root", "running", [
		makeStage("to-child", "child", "running", {
			workflowChildRun: { alias: "child", workflow: "child", runId: "duplicate-child" },
		}),
	]);
	const divergent: RunSnapshot = {
		...makeRun("duplicate-child", "divergent-child", "running", [makeStage("ask", "ask", "awaiting_input")]),
		parentRunId: root.id,
		parentStageId: "missing-boundary",
		rootRunId: root.id,
	};
	divergent.stages[0]!.pendingPrompt = primitive("wrong", "Wrongly attributed prompt");
	const canonical: RunSnapshot = {
		...makeRun("duplicate-child", "canonical-child", "running"),
		parentRunId: root.id,
		parentStageId: "to-child",
		rootRunId: root.id,
	};
	assert.equal(pendingInputAffordance(root, [root, divergent, canonical]), undefined);
	assert.equal(visibleRootPendingInput(root, [root, divergent, canonical]).hasPendingInput, false);
});

test("inactive ancestors and ended stages suppress stale previews", () => {
	const root = makeRun("completed-boundary-root", "completed-boundary-root", "running");
	const child = nestedChild(root, "stale-running-child");
	child.stages[0]!.pendingPrompt = primitive("stale", "Stale completed child question?");
	root.stages[0]!.status = "completed";
	root.stages[0]!.workflowChild = {
		alias: "child",
		workflow: child.name,
		runId: child.id,
		status: "completed",
		outputs: {},
	};
	delete root.stages[0]!.workflowChildRun;
	assert.equal(pendingInputAffordance(root, [root, child]), undefined);
	assert.equal(visibleRootPendingInput(root, [root, child]).hasPendingInput, false);

	for (const status of ["completed", "failed", "skipped"] as const) {
		const live = makeStage("live", "live", "awaiting_input", {
			pendingPrompt: primitive("live-prompt", "Answer the live prompt"),
		});
		const residue = makeStage("residue", "residue", status, {
			pendingPrompt: primitive("stale-prompt", "Stale terminal prompt"),
		});
		const mixed = makeRun(`${status}-mixed`, "mixed", "running", [residue, live]);
		assert.deepEqual(pendingInputAffordance(mixed, [mixed])?.identity, [mixed.id, "live", "live-prompt"]);
	}
});

test("answered cancelled completed and quit prompts do not remain actionable", () => {
	const answered = makeRun("answered", "answered", "running", [makeStage("ask", "ask", "running")]);
	assert.equal(pendingInputAffordance(answered, [answered]), undefined);

	for (const status of ["completed", "failed", "blocked"] as const) {
		const run = makeRun(`${status}-owner`, "stale", status, [makeStage("ask", "ask", "awaiting_input")]);
		run.pendingPrompt = primitive(`${status}-prompt`, "Stale prompt");
		assert.equal(pendingInputAffordance(run, [run]), undefined, `${status} owner must not surface a prompt`);
		assert.equal(visibleRootPendingInput(run, [run]).hasPendingInput, false);
	}

	const quit: RunSnapshot = {
		...makeRun("quit-owner", "quit", "paused", [makeStage("ask", "ask", "awaiting_input")]),
		exitReason: "quit",
		resumable: true,
		pendingPrompt: primitive("quit-prompt", "Continue?"),
	};
	assert.equal(pendingInputAffordance(quit, [quit]), undefined);
	assert.equal(visibleRootPendingInput(quit, [quit]).hasPendingInput, false);
});

test("control sequences cannot manufacture a preview", () => {
	assert.equal(sanitizePromptDisplay("Keep\x1bc this"), "Keep this");
	assert.equal(sanitizePromptDisplay("Approve\x9b2J this\x9d0;pwned\x07 release?"), "Approve this release?");
	assert.equal(sanitizePromptDisplay("Line\u2028break\u2029now"), "Line break now");
	const run = makeRun("control-owner", "release-docs", "running");
	run.pendingPrompt = primitive("control-prompt", "  Approve\x1b[2J this\x1b]0;pwned\x07 release?\x07\x08  ");
	assert.equal(pendingInputAffordance(run, [run])?.message, "Approve this release?");
});
