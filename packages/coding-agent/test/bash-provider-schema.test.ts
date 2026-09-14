import assert from "node:assert/strict";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { stream } from "@earendil-works/pi-ai/api/openai-responses";
import { getModel } from "@earendil-works/pi-ai/compat";
import { test } from "vitest";
import { createBashToolDefinition } from "../src/core/tools/bash.ts";

// Regression #3031: xAI rejects root union branches without explicit object types.
test("Grok receives object-typed bash alternatives without weakening local validation", async () => {
	const tool = createBashToolDefinition(process.cwd());
	let captured = false;
	const result = await stream(
		{ ...getModel("xai", "grok-4.6"), baseUrl: "http://127.0.0.1:9" },
		{ messages: [{ role: "user", content: "Run bash", timestamp: 0 }], tools: [tool] },
		{
			apiKey: "test-key",
			onPayload(payload) {
				const request = payload as {
					tools: Array<{ name: string; parameters: { type: string; anyOf: Array<{ type: string }> } }>;
				};
				const bash = request.tools.find((entry) => entry.name === "bash");
				assert.ok(bash);
				assert.equal(bash.parameters.type, "object");
				assert.equal(bash.parameters.anyOf.length, 2);
				for (const branch of bash.parameters.anyOf) assert.equal(branch.type, "object");
				captured = true;
				throw new Error("payload captured before network request");
			},
		},
	).result();
	assert.ok(captured, result.errorMessage);

	for (const args of [
		{ command: "true" },
		{ command: "true", wait: { kind: "background" }, timeout: 60 },
		{ action: "wait", id: "task-1" },
		{ action: "wait", id: "task-1", budgetMs: 0 },
	]) {
		assert.deepEqual(
			validateToolArguments(tool, { type: "toolCall", id: "test", name: "bash", arguments: args }),
			args,
		);
	}
	for (const args of [
		{},
		{ action: "wait" },
		{ id: "task-1" },
		{ command: "true", action: "wait", id: "task-1" },
		{ command: "true", id: "task-1" },
		{ command: "true", budgetMs: 0 },
		{ action: "wait", id: "task-1", timeout: 60 },
		{ action: "wait", id: "task-1", wait: { kind: "background" } },
		{ action: "wait", id: "task-1", budgetMs: -1 },
		{ command: {} },
	]) {
		assert.throws(
			() => validateToolArguments(tool, { type: "toolCall", id: "test", name: "bash", arguments: args }),
			JSON.stringify(args),
		);
	}
});
