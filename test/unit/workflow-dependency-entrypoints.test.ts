import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { workflowDependency as DeclaredDependency } from "../../packages/workflows/src/authoring.js";
import type { ExtensionAPI, PiCommandContext } from "../../packages/workflows/src/extension/public-types.js";
import { renderCall } from "../../packages/workflows/src/extension/render-call.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import {
	workflowArgumentCompletions,
	workflowArgumentCompletionsNeedWorkflowResources,
} from "../../packages/workflows/src/extension/workflow-command-completions.js";
import { registerWorkflowSlashCommand } from "../../packages/workflows/src/extension/workflow-command-registration.js";
import type { WorkflowCommandHandler } from "../../packages/workflows/src/extension/workflow-command-utils.js";
import { WorkflowParametersSchema } from "../../packages/workflows/src/extension/workflow-schema.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import { renderWorkflowToolContent } from "../../packages/workflows/src/extension/workflow-tool-content.js";
import { workflowDependency } from "../../packages/workflows/src/index.js";

const backend = vi.hoisted(() => ({
	inspect: vi.fn(async (operation: string) => ({ operation, fixture: "dependency-report" })),
}));
vi.mock("../../packages/workflows/src/durable/dependency-doctor.js", () => ({ workflowDependency: backend.inspect }));

beforeEach(() => backend.inspect.mockClear());

// #3074: public routing must not require workflow admission or a loaded registry.
test("package API forwards dependency operations and matches the authoring declaration", async () => {
	const publicApi: typeof DeclaredDependency = workflowDependency;
	assert.deepEqual(await publicApi(), { operation: "status", fixture: "dependency-report" });
	for (const operation of ["status", "doctor", "recover"] as const) {
		assert.deepEqual(await publicApi(operation), { operation, fixture: "dependency-report" });
	}
	assert.deepEqual(
		backend.inspect.mock.calls.map(([operation]) => operation),
		["status", "status", "doctor", "recover"],
	);
});

test("workflow tool reports dependency data without resolving the workflow runtime", async () => {
	const execute = makeExecuteWorkflowTool(
		() => {
			throw new Error("runtime must not initialize");
		},
		() => undefined,
		() => {
			throw new Error("resources must not load");
		},
	);
	for (const operation of [undefined, "status", "doctor", "recover"] as const) {
		const args = { action: "dependency" as const, operation };
		const result = await execute(args, { hasUI: false });
		assert.deepEqual(result, {
			action: "dependency",
			operation: operation ?? "status",
			report: {
				operation: operation ?? "status",
				fixture: "dependency-report",
			},
		});
		assert.deepEqual(JSON.parse(renderWorkflowToolContent(result, args)), result);
		assert.equal(renderCall(args), `workflow: dependency ${operation ?? "status"}`);
	}
});

function slashHarness() {
	const messages: string[] = [];
	const handlers = new Map<string, WorkflowCommandHandler>();
	const pi: ExtensionAPI = {
		sendMessage(message) {
			if (typeof message.content === "string") messages.push(message.content);
		},
	};
	const runtime = createExtensionRuntime();
	const overlay = { open() {}, toggle() {}, close() {} };
	const noResources = () => {
		throw new Error("resources must not load");
	};
	registerWorkflowSlashCommand(pi, handlers, {
		runtimeProxy: runtime,
		runtimeForContext: () => {
			throw new Error("runtime must not initialize");
		},
		overlay,
		reloadWorkflowResources: () => undefined,
		ensureWorkflowResourcesLoaded: noResources,
		runWithLifecycleSuppressedForPolicy: (_policy, run) => run(),
		runControl: { pi, overlay, runtimeForContext: () => runtime, ensureWorkflowResourcesLoaded: noResources },
	});
	const ctx: PiCommandContext = { hasUI: false, ui: { notify() {} } };
	return {
		messages,
		execute: async (args: string) => {
			await handlers.get("workflow")!(args, ctx);
		},
	};
}

test("slash dependency defaults to status and prints every operation's report", async () => {
	const harness = slashHarness();
	for (const suffix of ["", " status", " doctor", " recover"]) await harness.execute(`dependency${suffix}`);
	assert.deepEqual(
		harness.messages.map((message) => JSON.parse(message)),
		["status", "status", "doctor", "recover"].map((operation) => ({ operation, fixture: "dependency-report" })),
	);
});

test("slash dependency rejects unsupported or extra arguments without recovery", async () => {
	const harness = slashHarness();
	for (const args of ["dependency reset", "dependency recover extra"]) {
		await assert.rejects(harness.execute(args), /Usage: \/workflow dependency/);
	}
	assert.equal(backend.inspect.mock.calls.length, 0);
});

test("dependency schema and completions advertise only status doctor and recover", () => {
	const runtime = createExtensionRuntime();
	assert.equal(workflowArgumentCompletionsNeedWorkflowResources("dependency "), false);
	assert.deepEqual(
		workflowArgumentCompletions("dependency ", runtime)?.map((item) => item.value),
		["dependency status ", "dependency doctor ", "dependency recover "],
	);
	assert.equal(workflowArgumentCompletions("dependency recover ", runtime), null);
	const schema = JSON.stringify(WorkflowParametersSchema);
	assert.match(schema, /"const":"dependency"/);
	assert.deepEqual(
		WorkflowParametersSchema.properties.operation.anyOf.map((item) => item.const),
		["status", "doctor", "recover"],
	);
});
