import assert from "node:assert/strict";
import { test } from "vitest";
import type { HostInput as ExtensionHostInput } from "../../packages/coding-agent/src/core/extensions/index.js";
import type {
	QuestionParams as OriginalParams,
	QuestionnaireResult as OriginalResult,
} from "../../packages/coding-agent/src/core/tools/ask-user-question/tool/types.js";
import type {
	HostDiagnostic,
	HostInput,
	HostInputOptions,
	QuestionnaireResult,
	QuestionParams,
} from "../../packages/coding-agent/src/index.js";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

// #3105: checked by the root TypeScript gate, not just runtime assertions.
const exact: [
	Equal<QuestionParams, OriginalParams>,
	Equal<QuestionnaireResult, OriginalResult>,
	Equal<HostInput, ExtensionHostInput>,
	IsAny<HostInput>,
	IsAny<QuestionParams>,
] = [true, true, true, false, false];
const options: HostInputOptions = { signal: new AbortController().signal, requestId: "request", sessionId: "session" };
const diagnostic: HostDiagnostic = { level: "warning", source: "fixture", message: "safe", sessionId: "session" };
// @ts-expect-error All five human-input methods are required.
const incomplete: HostInput = { confirm: async () => true };
// @ts-expect-error Confirmation must be a boolean, not a truthy string.
const invalidConfirm: HostInput["confirm"] = async () => "yes";
// @ts-expect-error Request identity is mandatory.
const missingIdentity: HostInputOptions = { signal: new AbortController().signal, sessionId: "session" };

test("public host-input exports retain concrete original questionnaire types", () => {
	assert.deepEqual(exact, [true, true, true, false, false]);
	assert.equal(options.workflowRunId, undefined);
	assert.equal(diagnostic.level, "warning");
	assert.equal(typeof incomplete.confirm, "function");
	assert.equal(typeof invalidConfirm, "function");
	assert.equal(missingIdentity.sessionId, "session");
});
