// #3090: real shared inference with mocked provider transports, never live API calls.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@bastani/atomic";
import { type Api, createAssistantMessageEventStream, type Model } from "@bastani/pi-ai";
import { Value } from "typebox/value";
import { afterEach, beforeEach, test, vi } from "vitest";
import { loadAgentsFromDirWithDiagnostics } from "../../packages/subagents/src/agents/agent-loaders.js";
import { applyAgentConfig } from "../../packages/subagents/src/agents/agent-management-helpers.js";
import { serializeAgent } from "../../packages/subagents/src/agents/agent-serializer.js";
import type { AgentConfig } from "../../packages/subagents/src/agents/agents.js";
import { parseFrontmatter } from "../../packages/subagents/src/agents/frontmatter.js";
import { routeSubagentModel } from "../../packages/subagents/src/runs/shared/model-router.js";
import { parseModelConstraints } from "../../packages/subagents/src/shared/model-constraints.js";
import { type JevFixtureRequest, jevFixtureResponse } from "../helpers/jev-tournament.js";
import {
	decisionMessage,
	decisionModel,
	messageStream,
	registeredDecisionRuntime,
} from "../helpers/structured-output.js";

vi.mock("node:fs/promises", { spy: true });

beforeEach(() => vi.stubEnv("TYPESAFE_AI_API_KEY", ""));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});
const agent: AgentConfig = {
	name: "worker",
	description: "Implement approved work",
	systemPrompt: "Implement only approved changes",
	systemPromptMode: "replace",
	inheritProjectContext: false,
	inheritSkills: false,
	source: "user",
	filePath: "",
	model: "auto",
};
async function fixture() {
	const infer = vi.fn<Parameters<typeof registeredDecisionRuntime>[0]>(() =>
		messageStream(decisionMessage({ model: "decision-test/chat", effort: null })),
	);
	const { registry } = await registeredDecisionRuntime(infer);
	const ctx = {
		model: decisionModel,
		modelRegistry: registry,
		getRouterModel: () => "decision-test/chat",
	} as ExtensionContext;
	return { ctx, infer, route: (task = "Fix the approved defect") => routeSubagentModel({ ctx, agent, task }) };
}
test("task and actual shipped docs reach one inference; nonreasoning selection uses null", async () => {
	const f = await fixture();
	const selected = await f.route();
	assert.deepEqual(selected.routerSelection, { model: "decision-test/chat", effort: null });
	assert.equal(selected.modelOverride, "decision-test/chat");
	assert.ok(Object.isFrozen(selected.routerSelection));
	assert.equal(f.infer.mock.calls.length, 1);
	const [, context, options] = f.infer.mock.calls[0]!;
	const state = JSON.parse(context.messages[0]!.content as string).state;
	assert.equal(state.task, "Fix the approved defect");
	assert.equal(state.agent.instructions, agent.systemPrompt);
	assert.equal(state.documents.length, 2);
	assert.ok(state.documents.every((doc: { content: string }) => doc.content.length > 1000));
	assert.equal(options?.maxRetries, 0);
});
test("hard constraints preserve exact input and nullable effort choices", () => {
	const constraints = {
		requiredInputs: ["text", "image"],
		allowedEfforts: ["off", "minimal", "low", "medium", "high", "xhigh", "max", null],
	};
	assert.deepEqual(parseModelConstraints(constraints), constraints);
	assert.deepEqual(parseModelConstraints({ requiredInputs: [], allowedEfforts: [] }), {
		requiredInputs: [],
		allowedEfforts: [],
	});
	for (const input of ["audio", "", null, 1]) {
		assert.throws(() => parseModelConstraints({ requiredInputs: [input] }), /Invalid modelConstraints/);
	}
	for (const effort of ["bogus", "", "null", 1, false]) {
		assert.throws(() => parseModelConstraints({ allowedEfforts: [effort] }), /Invalid modelConstraints/);
	}
});
for (const invalid of [
	{ unknown: true },
	{ maxInputCost: -1 },
	{ maxOutputCost: Infinity },
	{ minContextWindow: NaN },
	{ allowedEfforts: ["bogus"] },
]) {
	test(`invalid hard constraints fail: ${JSON.stringify(invalid)}`, () =>
		assert.throws(() => parseModelConstraints(invalid), /Invalid modelConstraints/));
}
test("call allowlist cannot widen an agent restriction", async () => {
	const f = await fixture();
	await assert.rejects(
		routeSubagentModel({
			ctx: f.ctx,
			agent: { ...agent, modelConstraints: { allowedModels: ["other/model"] } },
			modelConstraints: { allowedModels: ["decision-test/chat"] },
		}),
		/no eligible/,
	);
	assert.equal(f.infer.mock.calls.length, 0);
});
for (const answer of [
	{ model: "auto", effort: null },
	{ model: "decision-test/chat", effort: "off" },
	{ model: "decision-test/chat", effort: null, extra: true },
]) {
	test(`invalid pair rejected: ${JSON.stringify(answer)}`, async () => {
		const f = await fixture();
		f.infer.mockImplementation(() => messageStream(decisionMessage(answer)));
		await assert.rejects(f.route(), /Invalid structured output/);
	});
}

const reasoningModel: Model<Api> = {
	...decisionModel,
	provider: "second-provider",
	id: "reasoner",
	reasoning: true,
	input: ["text", "image"],
	contextWindow: 100000,
	cost: { input: 2, output: 8, cacheRead: 0, cacheWrite: 0 },
	thinkingLevelMap: { off: "off", minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: null },
};
test("full provider catalog preserves supported off, independent task decisions and fallback effort", async () => {
	const f = await fixture();
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([decisionModel, reasoningModel]);
	f.infer.mockImplementation((_model, context) => {
		const state = JSON.parse(context.messages[0]!.content as string).state;
		assert.deepEqual(
			state.catalog.map((m: { model: string }) => m.model),
			["decision-test/chat", "second-provider/reasoner"],
		);
		assert.deepEqual(state.catalog[1].efforts, ["off", "low", "high"]);
		return messageStream(
			decisionMessage(
				state.task.includes("proof")
					? { model: "second-provider/reasoner", effort: "high" }
					: { model: "second-provider/reasoner", effort: "off" },
			),
		);
	});
	const [proof, edit] = await Promise.all([f.route("Check a mathematical proof"), f.route("Edit a short heading")]);
	assert.equal(proof.modelOverride, "second-provider/reasoner:high");
	assert.equal(edit.modelOverride, "second-provider/reasoner:off");
	assert.equal(proof.allowsCandidate("second-provider/reasoner:low"), true);
	assert.equal(proof.allowsCandidate("second-provider/reasoner"), true);
	assert.equal(proof.allowsCandidate("second-provider/reasoner:max"), false);
});

test("cost, context, capability and effort constraints are enforced before inference and on fallback", async () => {
	const f = await fixture();
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([decisionModel, reasoningModel]);
	f.infer.mockImplementation(() =>
		messageStream(decisionMessage({ model: "second-provider/reasoner", effort: "low" })),
	);
	const route = await routeSubagentModel({
		ctx: f.ctx,
		agent,
		task: "Inspect the attached screenshot",
		modelConstraints: {
			maxInputCost: 2,
			maxOutputCost: 8,
			minContextWindow: 80000,
			requiredInputs: ["image"],
			allowedEfforts: ["low"],
		},
	});
	assert.equal(route.allowsCandidate("decision-test/chat"), false);
	assert.equal(route.allowsCandidate("second-provider/reasoner:high"), false);
	assert.equal(route.allowsCandidate("second-provider/reasoner:low"), true);
	assert.equal(route.allowsCandidate("second-provider/reasoner", "high"), false);
	await assert.rejects(
		routeSubagentModel({ ctx: f.ctx, agent, modelConstraints: { maxInputCost: 1, requiredInputs: ["image"] } }),
		/no eligible/,
	);
});

test("pricing tiers cannot evade a maximum token rate", async () => {
	const f = await fixture();
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([
		{
			...reasoningModel,
			cost: {
				...reasoningModel.cost,
				tiers: [{ inputTokensAbove: 1000, input: 6, output: 15, cacheRead: 0, cacheWrite: 0 }],
			},
		},
	]);
	await assert.rejects(
		routeSubagentModel({ ctx: f.ctx, agent, modelConstraints: { maxInputCost: 3 } }),
		/no eligible/,
	);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("authored and management-created constraints round trip without widening", () => {
	const updated = { ...agent };
	const constraints = {
		allowedModels: ["second-provider/reasoner"],
		maxInputCost: 2,
		allowedEfforts: ["off", null],
		requiredInputs: ["image"],
	};
	assert.equal(applyAgentConfig(updated, { modelConstraints: constraints }), undefined);
	const parsed = parseFrontmatter(serializeAgent(updated));
	assert.deepEqual(parsed.modelConstraints, constraints);
	assert.equal(parsed.parseError, undefined);
	assert.match(
		parseFrontmatter("---\nname: worker\ndescription: test\nmodelConstraints:\n  latency: 1\n---\nWork").parseError ??
			"",
		/Invalid modelConstraints/,
	);
	const dir = mkdtempSync(join(tmpdir(), "atomic-auto-constraints-"));
	try {
		writeFileSync(join(dir, "worker.md"), serializeAgent(updated));
		const loaded = loadAgentsFromDirWithDiagnostics(dir, "project");
		assert.deepEqual(loaded.diagnostics, []);
		assert.equal(loaded.agents[0]?.model, "auto");
		assert.deepEqual(loaded.agents[0]?.modelConstraints, constraints);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("catalog availability is revalidated after inference and immediately before admission", async () => {
	const f = await fixture();
	const available = vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([decisionModel]);
	const selected = await f.route();
	available.mockReturnValue([]);
	assert.throws(selected.assertCurrent, /no longer eligible/);
	available.mockReturnValue([decisionModel]);
	f.infer.mockImplementation(() => {
		available.mockReturnValue([]);
		return messageStream(decisionMessage({ model: "decision-test/chat", effort: null }));
	});
	await assert.rejects(f.route(), /no longer eligible/);
});

test("missing/empty shipped docs and empty catalogs fail without inference", async () => {
	const f = await fixture();
	const read = vi.spyOn(fs, "readFile").mockRejectedValue(new Error("missing"));
	await assert.rejects(f.route(), /shipped.*documentation/);
	read.mockResolvedValue("");
	await assert.rejects(f.route(), /shipped.*documentation/);
	read.mockRestore();
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([]);
	await assert.rejects(f.route(), /no eligible/);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("provider failure, cancellation and late responses never become selections", async () => {
	const f = await fixture();
	f.infer.mockImplementation(() => {
		throw new Error("mock provider failure");
	});
	await assert.rejects(f.route(), /inference ended with error/);
	const stream = createAssistantMessageEventStream();
	const entered = Promise.withResolvers<void>();
	f.infer.mockImplementation(() => {
		entered.resolve();
		return stream;
	});
	const controller = new AbortController();
	const pending = routeSubagentModel({ ctx: f.ctx, agent, signal: controller.signal });
	await entered.promise;
	controller.abort();
	stream.push({
		type: "done",
		reason: "toolUse",
		message: decisionMessage({ model: "decision-test/chat", effort: null }),
	});
	await assert.rejects(pending, /cancelled|abort/i);
});

test("routing timeout is bounded with no semantic retry", async () => {
	const f = await fixture();
	vi.useFakeTimers();
	const entered = Promise.withResolvers<void>();
	f.infer.mockImplementation(() => {
		entered.resolve();
		return createAssistantMessageEventStream();
	});
	const rejected = assert.rejects(f.route(), /timed out/);
	await entered.promise;
	await vi.advanceTimersByTimeAsync(30001);
	await rejected;
	assert.equal(f.infer.mock.calls.length, 1);
});

test("Jev uses one Choice over complete pairs and deterministically maps the selected key", async () => {
	const f = await fixture();
	vi.stubEnv("TYPESAFE_AI_API_KEY", "synthetic-jev-key");
	f.ctx.getRouterModel = () => "";
	const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
		const body = JSON.parse(init?.body as string);
		assert.equal(body.model, "jev-latest");
		return Response.json({
			model: "jev-latest",
			answers: { pair: { type: "choice", choice: "pair_0", probabilities: { pair_0: 1 }, confidence: 1 } },
			usage: { input_tokens: 1, output_tokens: 1 },
		});
	});
	vi.stubGlobal("fetch", fetch);
	assert.deepEqual((await f.route()).routerSelection, { model: "decision-test/chat", effort: null });
	assert.equal(fetch.mock.calls.length, 1);
	assert.equal(f.infer.mock.calls.length, 0);
	fetch.mockImplementation(async () =>
		Response.json({
			answers: { pair: { type: "choice", choice: "bogus", probabilities: { bogus: 1 }, confidence: 1 } },
		}),
	);
	await assert.rejects(f.route(), /choice|invalid|malformed/i);
});

test("Jev covers 1997 pairs without filtering; ordinary router retains full catalog", async () => {
	const f = await fixture();
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue(
		Array.from({ length: 1997 }, (_, index) => ({ ...decisionModel, id: `m${index}` })),
	);
	vi.stubEnv("TYPESAFE_AI_API_KEY", "synthetic-jev-key");
	f.ctx.getRouterModel = () => "";
	const seen = new Set<string>();
	const fetch = vi.fn(async (_url: string, init: RequestInit) => {
		const request = JSON.parse(String(init.body)) as JevFixtureRequest;
		for (const q of Object.values(request.questions)) {
			assert.ok(Object.keys(q.criteria).length <= 255);
			for (const key of Object.keys(q.criteria)) seen.add(key);
		}
		return Response.json(jevFixtureResponse(request));
	});
	vi.stubGlobal("fetch", fetch);
	assert.equal((await f.route()).routerSelection.model, "decision-test/m0");
	assert.equal(seen.size, 1997);
	assert.ok(fetch.mock.calls.length > 1);
	f.ctx.getRouterModel = () => "decision-test/chat";
	f.infer.mockImplementation(() => messageStream(decisionMessage({ model: "decision-test/m255", effort: null })));
	assert.equal((await f.route()).routerSelection.model, "decision-test/m255");
	assert.equal(f.infer.mock.calls.length, 1);
	const context = f.infer.mock.calls[0]![1];
	assert.equal(JSON.parse(context.messages[0]!.content as string).state.catalog.length, 1997);
	assert.ok(context.tools?.[0]);
	for (let index = 0; index < 1997; index++)
		assert.equal(Value.Check(context.tools[0].parameters, { model: `decision-test/m${index}`, effort: null }), true);
});

test("configured credential text is rejected before inference", async () => {
	const f = await fixture();
	await assert.rejects(f.route("Task contains mock-chat-secret"), /credential/);
	assert.equal(f.infer.mock.calls.length, 0);
});

test("default reasoning catalog does not invent extended effort support", async () => {
	const f = await fixture();
	vi.spyOn(f.ctx.modelRegistry, "getAvailable").mockReturnValue([{ ...reasoningModel, thinkingLevelMap: undefined }]);
	f.infer.mockImplementation(() =>
		messageStream(decisionMessage({ model: "second-provider/reasoner", effort: "max" })),
	);
	await assert.rejects(f.route(), /Invalid structured output/);
});

test("router model precedence preserves chat fallback and rejects recursive or invalid explicit configuration", async () => {
	const f = await fixture();
	f.ctx.getRouterModel = () => "";
	await f.route();
	assert.equal(f.infer.mock.calls[0]![0].id, decisionModel.id);
	f.ctx.getRouterModel = () => "auto";
	await assert.rejects(f.route(), /auto|concrete/i);
	f.ctx.getRouterModel = () => "missing/model";
	await assert.rejects(f.route(), /Invalid routerModel/);
	assert.equal(f.infer.mock.calls.length, 1);
	assert.equal(f.ctx.model, decisionModel);
});

for (const failure of ["stale", "provider"] as const) {
	test(`overflow subagent ${failure} fails before returning a route`, async () => {
		const f = await fixture();
		const catalog = vi
			.spyOn(f.ctx.modelRegistry, "getAvailable")
			.mockReturnValue(Array.from({ length: 256 }, (_, i) => ({ ...decisionModel, id: `m${i}` })));
		vi.stubEnv("TYPESAFE_AI_API_KEY", "synthetic-jev-key");
		f.ctx.getRouterModel = () => "";
		const fetch = vi.fn(async (_url: string, init: RequestInit) => {
			const request = JSON.parse(String(init.body)) as JevFixtureRequest;
			if (request.questions.pair) {
				if (failure === "provider") return new Response("private", { status: 422 });
				catalog.mockReturnValue([]);
			}
			return Response.json(jevFixtureResponse(request));
		});
		vi.stubGlobal("fetch", fetch);
		await assert.rejects(f.route(), failure === "stale" ? /no longer eligible/ : /HTTP 422/);
		assert.ok(fetch.mock.calls.length > 1);
		assert.equal(f.infer.mock.calls.length, 0);
	});
}
