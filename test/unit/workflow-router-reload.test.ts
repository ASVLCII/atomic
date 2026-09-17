// #3089: live discovery/reload must publish routing candidates and contracts as one generation.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createAssistantMessageEventStream } from "@bastani/pi-ai";
import { afterEach, test, vi } from "vitest";
import { InMemoryDurableBackend } from "../../packages/workflows/src/durable/backend.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { createWorkflowExtensionRuntimeState } from "../../packages/workflows/src/extension/extension-runtime-state.js";
import factory from "../../packages/workflows/src/extension/index.js";
import type {
	PiCommandOptions,
	PiToolOpts,
	WorkflowResourceInfo,
	WorkflowToolArgs,
} from "../../packages/workflows/src/extension/public-types.js";
import type { WorkflowRegisteredToolResult } from "../../packages/workflows/src/extension/render-result.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import { store } from "../../packages/workflows/src/shared/store.js";
import { decisionMessage, messageStream } from "../helpers/structured-output.js";
import { workflowRouterContext, workflowRouterState } from "../helpers/workflow-router.js";

const originalCwd = process.cwd();
const roots: string[] = [];
afterEach(async () => {
	process.chdir(originalCwd);
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	store.clear();
	setDurableBackend(undefined);
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function definition(path: string, name: string, description: string, input = "task"): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		`import { workflow } from "@bastani/workflows";
import { Type } from "typebox";
export default workflow({ name: ${JSON.stringify(name)}, description: ${JSON.stringify(description)},
inputs: { ${JSON.stringify(input)}: Type.String() }, outputs: {}, run: async () => ({}) });`,
		"utf8",
	);
}

async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "atomic-router-reload-"));
	roots.push(root);
	const project = join(root, "project");
	const home = join(root, "home");
	const user = join(home, ".atomic", "agent");
	await mkdir(project, { recursive: true });
	await mkdir(user, { recursive: true });
	process.chdir(project);
	vi.stubEnv("HOME", home);
	vi.stubEnv("USERPROFILE", home);
	vi.stubEnv("ATOMIC_CODING_AGENT_DIR", "");
	vi.stubEnv("PI_CODING_AGENT_DIR", "");
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	let resources: readonly WorkflowResourceInfo[] = [];
	let failRefresh = false;
	const backend = new InMemoryDurableBackend();
	setDurableBackend(backend);
	const admissions = vi.spyOn(backend, "registerWorkflow");
	const state = createWorkflowExtensionRuntimeState(
		{
			disableAsyncDiscovery: true,
			refreshWorkflowResources: async () => {
				if (failRefresh) throw new Error("fixture refresh failed");
				return resources;
			},
		},
		{},
	);
	const execute = makeExecuteWorkflowTool(
		(ctx) => state.runtimeForContext(ctx),
		state.reloadWorkflowResources,
		state.ensureWorkflowResourcesLoaded,
	);
	return {
		root,
		project,
		user,
		state,
		execute,
		admissions,
		setResources: (next: readonly WorkflowResourceInfo[]) => {
			resources = next;
		},
		fail: (value: boolean) => {
			failRefresh = value;
		},
		noAdmission: () => {
			assert.equal(admissions.mock.calls.length, 0);
			assert.equal(store.runs().length, 0);
		},
	};
}

type CapturedWorkflow = { name: string; description: string; inputs: Record<string, { type: string }> };
type CapturedState = {
	workflows: CapturedWorkflow[];
	proposed: { workflow: string };
	task: { documents: { content: string }[] };
};
type CapturedRequest = { state: CapturedState; questions: Record<string, { criteria: Record<string, string> }> };

async function inspectRoutes(f: Awaited<ReturnType<typeof fixture>>, proposed: string) {
	const ctx = workflowRouterContext("none");
	let ordinaryState: CapturedState | undefined;
	let choices: string[] = [];
	ctx.modelRegistry!.streamSimple = (_model, context) => {
		ordinaryState = JSON.parse(context.messages[0]!.content as string).state;
		const schema = context.tools![0]!.parameters as { properties: { workflowType: { anyOf: { const: string }[] } } };
		choices = schema.properties.workflowType.anyOf.map((option) => option.const);
		return messageStream(decisionMessage({ workflowType: "none", maxBudget: {} }));
	};
	const args = { workflow: proposed, state: workflowRouterState(), inputs: { task: "Approved task" } };
	const ordinary = await f.execute(args, ctx);
	assert.equal(ordinary.action, "run");
	assert.equal(ordinary.status, "not_launched", ordinary.error);
	assert.ok(ordinaryState);
	const expected = ["none", ...f.state.runtimeProxy.registry.names()];
	assert.deepEqual(choices, expected);
	assert.deepEqual(
		ordinaryState.workflows.map((item) => item.name),
		expected.slice(1),
	);
	assert.match(ordinaryState.task.documents[0]!.content, /Implement the change/);
	let jev: CapturedRequest | undefined;
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-jev-key");
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init: RequestInit) => {
			jev = JSON.parse(init.body as string) as CapturedRequest;
			const answers = Object.fromEntries(
				Object.entries(jev.questions).map(([id, question]) => {
					const keys = Object.keys(question.criteria);
					const selected = id === "workflow" ? "none" : keys[0]!;
					return [
						id,
						{
							type: "choice",
							choice: selected,
							confidence: 1,
							probabilities: Object.fromEntries(keys.map((key) => [key, key === selected ? 1 : 0])),
						},
					];
				}),
			);
			return new Response(
				JSON.stringify({ model: "jev-latest", answers, usage: { input_tokens: 10, output_tokens: 2 } }),
			);
		}),
	);
	ctx.getRouterModel = () => "typesafe-ai/jev";
	const jevResult = await f.execute(args, ctx);
	assert.equal(jevResult.action, "run");
	assert.equal(jevResult.status, "not_launched", jevResult.error);
	assert.ok(jev);
	assert.deepEqual(Object.keys(jev.questions.workflow!.criteria), expected);
	assert.deepEqual(jev.state.workflows, ordinaryState.workflows);
	f.noAdmission();
	return ordinaryState;
}

test("effective builtin, project, user and package overrides have identical schema, context and Jev candidates", async () => {
	const f = await fixture();
	const builtin = f.state.runtimeProxy.registry.names()[0]!;
	assert.ok(builtin);
	const projectPath = join(f.project, ".atomic/workflows/project.ts");
	const userPath = join(f.user, "workflows/user.ts");
	const packagePath = join(f.root, "extension/package.ts");
	await definition(projectPath, "project-route", "Project contract wins");
	await definition(userPath, "user-route", "User contract");
	await definition(packagePath, "package-route", "Package contract");
	await definition(join(f.user, "workflows/overridden.ts"), "project-route", "Shadowed user contract");
	await definition(
		join(f.project, ".atomic/workflows/builtin-override.ts"),
		builtin,
		"Project replacement for builtin",
	);
	f.setResources([{ path: packagePath, enabled: true }]);
	const reload = await f.execute({ action: "reload" }, {});
	assert.equal(reload.action, "reload");
	assert.equal(reload.outcome, "applied");
	const kinds = new Set<string>(f.state.discoveryRef.current!.sources.map((source) => source.kind));
	for (const kind of ["project-local", "user-global", "package", "bundled"]) assert.ok(kinds.has(kind), kind);
	const captured = await inspectRoutes(f, "project-route");
	assert.equal(captured.workflows.filter((item) => item.name === "project-route").length, 1);
	assert.equal(captured.workflows.find((item) => item.name === "project-route")!.description, "Project contract wins");
	assert.equal(
		captured.workflows.find((item) => item.name === builtin)!.description,
		"Project replacement for builtin",
	);
	for (const name of ["project-route", "user-route", "package-route"])
		assert.ok(captured.workflows.some((item) => item.name === name));
});

test("file authoring, removal, rename and same-name edits refresh actual choices and input contracts together", async () => {
	const f = await fixture();
	const path = join(f.project, ".atomic/workflows/authored.ts");
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	assert.equal(f.state.runtimeProxy.registry.has("authored-route"), false);
	await definition(path, "authored-route", "Initial authored contract");
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	await inspectRoutes(f, "authored-route");
	await definition(path, "authored-route", "Changed same-name contract", "replacement");
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	const changed = await inspectRoutes(f, "authored-route");
	const current = changed.workflows.find((item) => item.name === "authored-route")!;
	assert.equal(current.description, "Changed same-name contract");
	assert.deepEqual(Object.keys(current.inputs), ["replacement"]);
	await definition(path, "renamed-route", "Renamed contract");
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	const renamed = await inspectRoutes(f, "renamed-route");
	assert.equal(
		renamed.workflows.some((item) => item.name === "authored-route"),
		false,
	);
	await unlink(path);
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	const afterRemoval = await inspectRoutes(f, f.state.runtimeProxy.registry.names()[0]!);
	assert.equal(
		afterRemoval.workflows.some((item) => item.name === "renamed-route"),
		false,
	);
});

test("failed resource reload retains the previous registry generation and complete routing contracts", async () => {
	const f = await fixture();
	const path = join(f.project, ".atomic/workflows/retained.ts");
	await definition(path, "retained-route", "Retained contract");
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	const registry = f.state.runtimeProxy.registry;
	const generation = f.state.runtimeProxy.routingGeneration;
	const before = await inspectRoutes(f, "retained-route");
	await definition(path, "retained-route", "Not published");
	f.fail(true);
	const failed = await f.execute({ action: "reload" }, {});
	assert.equal(failed.action, "reload");
	assert.equal(failed.outcome, "failed");
	assert.equal(f.state.runtimeProxy.registry, registry);
	assert.equal(f.state.runtimeProxy.routingGeneration, generation);
	const after = await inspectRoutes(f, "retained-route");
	assert.deepEqual(after.workflows, before.workflows);
});

test("overlapping in-flight decisions cannot launch a removed or same-name changed definition after real reload", async () => {
	const f = await fixture();
	const changedPath = join(f.project, ".atomic/workflows/changed.ts");
	const removedPath = join(f.project, ".atomic/workflows/removed.ts");
	await definition(changedPath, "changed-route", "Old changed contract");
	await definition(removedPath, "removed-route", "Old removed contract");
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	const streams = [createAssistantMessageEventStream(), createAssistantMessageEventStream()];
	const entered = Promise.withResolvers<void>();
	const captured: CapturedState[] = [];
	const ctx = workflowRouterContext("none");
	ctx.modelRegistry!.streamSimple = (_model, context) => {
		captured.push(JSON.parse(context.messages[0]!.content as string).state as CapturedState);
		if (captured.length === 2) entered.resolve();
		return streams[captured.length - 1]!;
	};
	const pending = ["changed-route", "removed-route"].map((name) =>
		f.execute({ workflow: name, state: workflowRouterState(), inputs: { task: "Approved work" } }, ctx),
	);
	await entered.promise;
	f.noAdmission();
	await definition(changedPath, "changed-route", "New changed contract", "newInput");
	await unlink(removedPath);
	assert.equal((await f.state.reloadWorkflowResources()).outcome, "applied");
	streams.forEach((stream, index) => {
		stream.push({
			type: "done",
			reason: "toolUse",
			message: decisionMessage({ workflowType: index === 0 ? "changed-route" : "removed-route", maxBudget: {} }),
		});
	});
	for (const result of await Promise.all(pending)) {
		assert.equal(result.action, "run");
		assert.equal(result.status, "failed");
		assert.match(result.error ?? "", /registry changed/);
		assert.equal(result.routerDecision, undefined);
	}
	assert.equal(captured.length, 2, "no automatic second inference");
	assert.deepEqual(
		captured[0]!.workflows,
		captured[1]!.workflows,
		"both requests use their own coherent old generation",
	);
	assert.equal(
		captured[0]!.workflows.find((item) => item.name === "changed-route")!.description,
		"Old changed contract",
	);
	const current = await inspectRoutes(f, "changed-route");
	assert.equal(current.workflows.find((item) => item.name === "changed-route")!.description, "New changed contract");
	assert.equal(
		current.workflows.some((item) => item.name === "removed-route"),
		false,
	);
	f.noAdmission();
});

test("user /workflow reload publishes newly authored choices to the registered model tool", async () => {
	const f = await fixture();
	const commands = new Map<string, PiCommandOptions>();
	let tool: PiToolOpts<WorkflowToolArgs, WorkflowRegisteredToolResult> | undefined;
	factory({
		disableAsyncDiscovery: true,
		registerCommand: (name, options) => {
			commands.set(name, options);
		},
		registerTool: (options) => {
			tool = options as unknown as PiToolOpts<WorkflowToolArgs, WorkflowRegisteredToolResult>;
		},
		on: () => {},
		ui: { setWidget: () => {} },
	});
	assert.ok(tool);
	const command = commands.get("workflow");
	assert.ok(command);
	await definition(
		join(f.project, ".atomic/workflows/slash-authored.ts"),
		"slash-authored-route",
		"Slash reload contract",
	);
	await command.handler("reload", { hasUI: false, ui: { notify: () => {} } });
	const ctx = workflowRouterContext("none");
	let seen = false;
	ctx.modelRegistry!.streamSimple = (_model, context) => {
		const state = JSON.parse(context.messages[0]!.content as string).state as CapturedState;
		assert.ok(
			state.workflows.some(
				(item) => item.name === "slash-authored-route" && item.description === "Slash reload contract",
			),
		);
		seen = true;
		return messageStream(decisionMessage({ workflowType: "none", maxBudget: {} }));
	};
	const result = await tool.execute(
		"slash-reload-route",
		{ workflow: "slash-authored-route", inputs: { task: "approved" }, state: workflowRouterState() },
		undefined,
		undefined,
		ctx,
	);
	assert.equal(result.details.action, "run");
	assert.ok("routerDecision" in result.details);
	assert.deepEqual(result.details.routerDecision, { workflowType: "none", maxBudget: {} });
	assert.equal(seen, true);
	f.noAdmission();
});
