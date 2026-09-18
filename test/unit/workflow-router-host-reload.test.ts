// #3089: the real SDK /reload transaction must replace the router's live workflow catalog.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createAssistantMessageEventStream } from "@bastani/pi-ai";
import { test, vi } from "vitest";
import { DefaultResourceLoader } from "../../packages/coding-agent/src/core/resource-loader.js";
import { createAgentSession } from "../../packages/coding-agent/src/core/sdk.js";
import { SessionManager } from "../../packages/coding-agent/src/core/session-manager.js";
import { SettingsManager } from "../../packages/coding-agent/src/core/settings-manager.js";
import { InMemoryDurableBackend } from "../../packages/workflows/src/durable/backend.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import workflowExtension from "../../packages/workflows/src/extension/index.js";
import type { ExtensionAPI, WorkflowToolArgs } from "../../packages/workflows/src/extension/public-types.js";
import type { WorkflowRegisteredToolResult } from "../../packages/workflows/src/extension/render-result.js";
import {
	decisionMessage,
	decisionModel,
	messageStream,
	registeredDecisionRuntime,
} from "../helpers/structured-output.js";
import { workflowRouterState } from "../helpers/workflow-router.js";

// Real resource-loader and host-session replacement, not a registry helper invocation.
const HOST_WORKFLOW_RELOAD_TIMEOUT_MS = 120_000;
type CatalogEntry = { name: string; description: string; inputs: Record<string, { type: string }> };
type CapturedState = { workflows: CatalogEntry[] };

async function writeDefinition(path: string, name: string, description: string, input = "task") {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		`import { workflow } from "@bastani/workflows";
import { Type } from "typebox";
export default workflow({ name: ${JSON.stringify(name)}, description: ${JSON.stringify(description)},
inputs: { ${JSON.stringify(input)}: Type.String() }, outputs: {}, run: async (ctx) => ctx.tool("work", {}, async () => ({})) });`,
	);
}

test(
	"real host reload refreshes added, renamed, removed and same-name router contracts and rejects old-host approval",
	async () => {
		const cwd = process.cwd();
		const root = await mkdtemp(join(tmpdir(), "atomic-router-host-reload-"));
		const project = join(root, "project");
		const agentDir = join(root, "home/.atomic/agent");
		await mkdir(project, { recursive: true });
		await mkdir(agentDir, { recursive: true });
		process.chdir(project);
		vi.stubEnv("HOME", join(root, "home"));
		vi.stubEnv("USERPROFILE", join(root, "home"));
		vi.stubEnv("ATOMIC_CODING_AGENT_DIR", agentDir);
		vi.stubEnv("PI_CODING_AGENT_DIR", agentDir);
		vi.stubEnv("TYPESAFE_AI_API_KEY", "");
		const backend = new InMemoryDurableBackend();
		setDurableBackend(backend);
		const admissions = vi.spyOn(backend, "registerWorkflow");
		const captures: CapturedState[] = [];
		let held: ReturnType<typeof createAssistantMessageEventStream> | undefined;
		let entered: (() => void) | undefined;
		const { runtime: modelRuntime } = await registeredDecisionRuntime((_model, context) => {
			const snapshot = JSON.parse(context.messages[0]!.content as string).state as CapturedState;
			const schema = context.tools![0]!.parameters as {
				properties: { workflowType: { anyOf: Array<{ const: string }> } };
			};
			assert.deepEqual(
				schema.properties.workflowType.anyOf.map((entry) => entry.const),
				["none", ...snapshot.workflows.map((entry) => entry.name)],
			);
			captures.push(snapshot);
			if (held) {
				entered?.();
				return held;
			}
			return messageStream(decisionMessage({ estimatedDuration: "unknown", workflowType: "none", maxBudget: {} }));
		});
		const settingsManager = SettingsManager.inMemory({
			routerModel: "decision-test/chat",
			compaction: { enabled: false },
			sessionSummary: { enabled: false },
		});
		const loader = new DefaultResourceLoader({
			cwd: project,
			agentDir,
			settingsManager,
			builtinPackagePaths: [],
			noExtensions: true,
			extensionFactories: [(pi) => workflowExtension(pi as unknown as ExtensionAPI)],
		});
		const changed = join(project, ".atomic/workflows/changed.ts");
		const removed = join(project, ".atomic/workflows/removed.ts");
		const renamed = join(project, ".atomic/workflows/renamed.ts");
		await writeDefinition(changed, "host-changed", "Original contract");
		await writeDefinition(removed, "host-removed", "Removed contract");
		await writeDefinition(renamed, "host-old-name", "Old identity");
		await loader.reload();
		const { session } = await createAgentSession({
			cwd: project,
			agentDir,
			modelRuntime,
			model: decisionModel,
			settingsManager,
			resourceLoader: loader,
			sessionManager: SessionManager.inMemory(project),
		});
		try {
			await session.bindExtensions({});
			const tool = () => {
				const registered = session.agent.state.tools.find((entry) => entry.name === "workflow");
				assert.ok(registered, "workflow must be installed on the real host");
				return registered;
			};
			const args: WorkflowToolArgs = {
				workflow: "host-changed",
				inputs: { task: "Approved work" },
				state: workflowRouterState(),
			};
			const first = await tool().execute("before", args);
			assert.equal((first.details as WorkflowRegisteredToolResult).action, "run");
			assert.ok(captures[0]!.workflows.some((entry) => entry.name === "host-removed"));
			held = createAssistantMessageEventStream();
			const began = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const oldTool = tool();
			const pending = oldTool.execute("held-before-reload", args);
			await began;
			assert.equal(admissions.mock.calls.length, 0);
			await writeDefinition(changed, "host-changed", "Replacement contract", "replacement");
			await writeDefinition(join(project, ".atomic/workflows/added.ts"), "host-added", "Added contract");
			await writeDefinition(renamed, "host-new-name", "Renamed contract");
			await unlink(removed);
			const oldRunner = session.extensionRunner;
			await session.reload({ reason: "reload", failOnExtensionErrors: true });
			assert.notEqual(session.extensionRunner, oldRunner, "the SDK transaction replaced the runner");
			held.push({
				type: "done",
				reason: "toolUse",
				message: decisionMessage({ estimatedDuration: "unknown", workflowType: "host-changed", maxBudget: {} }),
			});
			held = undefined;
			// Real host lifetime guards reject the captured tool before it can publish any result.
			await assert.rejects(pending, /stale after session replacement or reload/);
			assert.equal(admissions.mock.calls.length, 0);
			const fresh = await tool().execute("after", { ...args, inputs: { replacement: "Fresh inputs" } });
			const freshDetails = fresh.details as WorkflowRegisteredToolResult;
			assert.ok("routerDecision" in freshDetails);
			assert.deepEqual(freshDetails.routerDecision, {
				estimatedDuration: "unknown",
				workflowType: "none",
				maxBudget: {},
			});
			const catalog = captures.at(-1)!.workflows;
			assert.ok(catalog.some((entry) => entry.name === "host-added"));
			assert.ok(catalog.some((entry) => entry.name === "host-new-name"));
			assert.equal(
				catalog.some((entry) => entry.name === "host-old-name" || entry.name === "host-removed"),
				false,
			);
			const replacement = catalog.find((entry) => entry.name === "host-changed")!;
			assert.equal(replacement.description, "Replacement contract");
			assert.deepEqual(Object.keys(replacement.inputs), ["replacement"]);
			assert.equal(
				captures.length,
				3,
				"each invocation made exactly one inference, including the rejected old host",
			);
			assert.equal(admissions.mock.calls.length, 0);
		} finally {
			session.dispose();
			setDurableBackend(undefined);
			vi.restoreAllMocks();
			vi.unstubAllEnvs();
			process.chdir(cwd);
			await rm(root, { recursive: true, force: true });
		}
	},
	HOST_WORKFLOW_RELOAD_TIMEOUT_MS,
);
