import assert from "node:assert/strict";
import type { ExtensionContext } from "@bastani/atomic";
import { test, vi } from "vitest";
import type { AgentConfig } from "../../packages/subagents/src/agents/agent-types.ts";
import { runSingleInProcess } from "../../packages/subagents/src/runs/foreground/inprocess-run-sync.ts";
import type { ChildSpec } from "../../packages/subagents/src/runs/inprocess/runner.ts";
import { routeSubagentModel } from "../../packages/subagents/src/runs/shared/model-router.ts";
import { toModelInfo } from "../../packages/subagents/src/shared/model-info.ts";
import { createCandidateModelResolver } from "../../packages/subagents/src/shared/model-resolution.ts";
import { decisionMessage, decisionModel, messageStream } from "../helpers/structured-output.ts";

const capture = vi.hoisted(() => ({ spec: undefined as ChildSpec | undefined }));
vi.mock("../../packages/subagents/src/runs/inprocess/control-registry.ts", () => ({
	getOrCreateSubagentControl: () => ({
		registerAgents: () => {},
		admitChildSession: (spec: ChildSpec) => {
			capture.spec = spec;
			return { refusal: { reason: "dispatch boundary captured; no child execution" } };
		},
	}),
}));

async function dispatch(
	effort: "low" | "off" | null,
	overrides: Partial<AgentConfig> = {},
	routed = true,
): Promise<ChildSpec> {
	const primary = { ...decisionModel, id: "primary", reasoning: effort !== null };
	const models = [
		primary,
		{ ...primary, id: "fallback", reasoning: true },
		{ ...primary, id: "parent", reasoning: true },
	];
	const registry = {
		getAvailable: () => models,
		getAll: () => models,
		find: (provider: string, id: string) => models.find((model) => model.provider === provider && model.id === id),
		hasConfiguredAuth: () => true,
		containsConfiguredCredential: async () => false,
		streamSimple: () => messageStream(decisionMessage({ model: "decision-test/primary", effort })),
	};
	const agent: AgentConfig = {
		name: "worker",
		description: "worker",
		systemPrompt: "Inspect the synthetic task",
		systemPromptMode: "replace",
		inheritProjectContext: false,
		inheritSkills: false,
		source: "user",
		filePath: "",
		model: "auto",
		thinking: "high",
		fallbackModels: ["decision-test/fallback"],
		...overrides,
	};
	const route = routed
		? await routeSubagentModel({
				ctx: {
					model: primary,
					modelRegistry: registry,
					getRouterModel: () => "decision-test/primary",
				} as unknown as ExtensionContext,
				agent,
				task: "Inspect synthetic data",
				modelConstraints: { allowedEfforts: effort === null ? [null, "off"] : [effort] },
			})
		: undefined;
	capture.spec = undefined;
	await runSingleInProcess(process.cwd(), agent, "Inspect synthetic data", {
		runId: "fallback-effort-regression",
		availableModels: models.map(toModelInfo),
		knownModelProviders: ["decision-test"],
		currentModel: "decision-test/parent",
		currentThinkingLevel: "high",
		modelOverride: route?.modelOverride ?? "decision-test/primary",
		modelRoute: route,
		resolveCandidateModel: createCandidateModelResolver(registry, "decision-test"),
	});
	assert.ok(capture.spec);
	return capture.spec;
}

test("unsuffixed routed fallback uses the selected low effort, not agent high", async () => {
	const spec = await dispatch("low");
	assert.equal(spec.thinkingLevel, "low");
	assert.deepEqual(spec.fallbackModels, ["decision-test/fallback"]);
});

for (const effort of ["off", null] as const) {
	test(`unsuffixed reasoning fallback inherits effective off from routed ${effort}`, async () => {
		const spec = await dispatch(effort);
		assert.equal(spec.thinkingLevel, "off");
		assert.deepEqual(spec.fallbackModels, ["decision-test/fallback"]);
	});
}

test("explicit fallback suffix outranks fallbackThinkingLevels and routed default", async () => {
	const spec = await dispatch("low", {
		fallbackModels: ["decision-test/fallback:high"],
		fallbackThinkingLevels: ["low"],
	});
	assert.deepEqual(spec.fallbackModels, []);
	const allowed = await dispatch("low", {
		fallbackModels: ["decision-test/fallback:low"],
		fallbackThinkingLevels: ["high"],
	});
	assert.deepEqual(allowed.fallbackModels, ["decision-test/fallback:low"]);
});

test("fallbackThinkingLevels continues to control an unsuffixed fallback", async () => {
	assert.deepEqual((await dispatch("low", { fallbackThinkingLevels: ["high"] })).fallbackModels, []);
	assert.deepEqual((await dispatch("low", { fallbackThinkingLevels: ["low"] })).fallbackModels, [
		"decision-test/fallback:low",
	]);
});

test("ordinary dispatch retains agent effort and the unfiltered parent fallback", async () => {
	const spec = await dispatch("low", {}, false);
	assert.equal(spec.thinkingLevel, "high");
	assert.deepEqual(spec.fallbackModels, ["decision-test/fallback", "decision-test/parent"]);
});
