import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@bastani/pi-ai";
import { convertResponsesTools } from "@bastani/pi-ai/api/openai-responses-shared";
import { Compile } from "typebox/compile";
import { afterEach, test, vi } from "vitest";
import { InMemoryDurableBackend } from "../../packages/workflows/src/durable/backend.js";
import { decodeToCheckpoint, encodeCheckpoint } from "../../packages/workflows/src/durable/dbos-envelope.js";
import { setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import {
	createDurableStagePrimitive,
	recordStageSessionCheckpoint,
} from "../../packages/workflows/src/durable/stage-primitive.js";
import { workflowModelCatalogFromContext } from "../../packages/workflows/src/extension/workflow-model-catalog.js";
import { createStageControlRegistry } from "../../packages/workflows/src/runs/foreground/stage-control-registry.js";
import { type JevFixtureRequest, jevFixtureResponse } from "../helpers/jev-tournament.js";
import {
	decisionMessage,
	decisionModel,
	messageStream,
	registeredDecisionRuntime,
} from "../helpers/structured-output.js";
import { createStore, run, Type, workflow } from "./executor-shared.js";
import { createStageContext, makeMockSession, makeOpts } from "./stage-runner-helpers.js";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	setDurableBackend(undefined);
});
async function fixture() {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "");
	const infer = vi.fn<Parameters<typeof registeredDecisionRuntime>[0]>(() =>
		messageStream(decisionMessage({ model: "decision-test/chat", effort: null })),
	);
	const { registry, runtime: decisionRuntime } = await registeredDecisionRuntime(infer);
	const models = workflowModelCatalogFromContext({
		model: decisionModel,
		modelRegistry: registry,
		getRouterModel: () => "decision-test/chat",
	});
	const admissions: string[] = [];
	const store = createStore();
	const adapters = {
		agentSession: {
			async create(options: import("./stage-runner-helpers.js").StageSessionCreateOptions) {
				admissions.push(
					typeof options.model === "string" ? options.model : `${options.model?.provider}/${options.model?.id}`,
				);
				return makeMockSession({
					model: options.model,
					async prompt() {
						return "done";
					},
					getLastAssistantText: () => "done",
				}).session;
			},
		},
	};
	return { infer, modelRegistry: registry, decisionRuntime, models, admissions, store, adapters };
}

test("public stage auto decides from actual prompt and shipped guides before admission", async () => {
	const f = await fixture();
	const def = workflow({
		name: "auto",
		description: "",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			const stage = ctx.stage("not the task", { model: "auto" });
			assert.equal(f.admissions.length, 0);
			await stage.prompt("  Solve this actual task verbatim.  ");
			return {};
		},
	});
	const result = await run(def, {}, f);
	assert.equal(result.status, "completed", result.error);
	assert.deepEqual(f.admissions, ["decision-test/chat"]);
	assert.equal(f.infer.mock.calls.length, 1);
	assert.deepEqual(f.store.runs()[0]?.stages[0]?.routerSelection, { model: "decision-test/chat", effort: null });
	assert.equal(f.store.runs()[0]?.stages[0]?.model, "decision-test/chat");
	const state = JSON.parse(f.infer.mock.calls[0]![1].messages[0]!.content as string).state;
	assert.equal(state.task, "  Solve this actual task verbatim.  ");
	assert.deepEqual(
		state.documents.map((doc: { source: string }) => doc.source),
		["model-selection.md", "evals.md"],
	);
	assert.ok(state.documents.every((doc: { content: string }) => doc.content.length > 1000));
});

test("malformed stage decision admits no execution session", async () => {
	const f = await fixture();
	f.infer.mockImplementation(() => messageStream(decisionMessage({ model: "decision-test/chat", effort: "high" })));
	const def = workflow({
		name: "invalid-auto",
		description: "",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.stage("task", { model: "auto" }).prompt("Solve task");
			return {};
		},
	});
	const result = await run(def, {}, f);
	assert.equal(result.status, "failed");
	assert.equal(f.admissions.length, 0);
	assert.equal(f.infer.mock.calls.length, 4);
});

test("chain and parallel inherit auto and route expanded previous context", async () => {
	const f = await fixture();
	const def = workflow({
		name: "composed-auto",
		description: "",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			const results = await ctx.chain(
				[
					{ name: "first", prompt: "First task" },
					{ name: "second", prompt: "Use {previous}" },
				],
				{ model: "auto" },
			);
			assert.deepEqual(
				results.map((r) => r.routerSelection),
				[
					{ model: "decision-test/chat", effort: null },
					{ model: "decision-test/chat", effort: null },
				],
			);
			await ctx.parallel(
				[
					{ name: "third", prompt: "Third task", previous: "Provided context" },
					{ name: "fourth", prompt: "Fourth task" },
				],
				{ model: "auto", concurrency: 2 },
			);
			return {};
		},
	});
	const result = await run(def, {}, f);
	assert.equal(result.status, "completed", result.error);
	const tasks = f.infer.mock.calls.map((call) => JSON.parse(call[1].messages[0]!.content as string).state.task);
	assert.deepEqual(tasks.slice(0, 2), ["First task", "Use done"]);
	assert.deepEqual(tasks.slice(2).sort(), ["Third task\n\n---\nContext:\nProvided context", "Fourth task"].sort());
	assert.equal(f.admissions.length, 4);
});

test("caller constraints cannot widen inherited parallel restrictions", async () => {
	const f = await fixture();
	const def = workflow({
		name: "constraints-auto",
		description: "",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.parallel(
				[{ name: "task", prompt: "Task", modelConstraints: { allowedModels: ["decision-test/chat"] } }],
				{ model: "auto", modelConstraints: { allowedModels: [] } },
			);
			return {};
		},
	});
	assert.equal((await run(def, {}, f)).status, "failed");
	assert.equal(f.infer.mock.calls.length, 0);
	assert.equal(f.admissions.length, 0);
});

for (const model of [undefined, "decision-test/chat"] as const) {
	test(`non-auto stage ${model} keeps ordinary admission without routing`, async () => {
		const f = await fixture();
		const def = workflow({
			name: "concrete",
			description: "",
			inputs: {},
			outputs: {},
			run: async (ctx) => {
				await ctx.stage("task", { model }).prompt("Task");
				return {};
			},
		});
		assert.equal((await run(def, {}, f)).status, "completed");
		assert.equal(f.infer.mock.calls.length, 0);
		assert.equal(f.admissions.length, 1);
	});
}

test("auto stage cancellation during decision admits no child", async () => {
	const f = await fixture();
	const controller = new AbortController();
	f.infer.mockImplementation((_model, _context, options) => {
		assert.ok(options?.signal);
		controller.abort();
		return messageStream(decisionMessage({ model: "decision-test/chat", effort: null }));
	});
	const def = workflow({
		name: "cancel-auto",
		description: "",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.stage("task", { model: "auto" }).prompt("Task");
			return {};
		},
	});
	assert.notEqual((await run(def, {}, { ...f, signal: controller.signal })).status, "completed");
	assert.equal(f.admissions.length, 0);
});

test("stale catalog and explicit unsupported effort fail before admission", async () => {
	for (const stale of [false, true]) {
		const f = await fixture();
		if (stale)
			f.infer.mockImplementation(() => {
				vi.spyOn(f.modelRegistry, "getAvailable").mockReturnValue([]);
				return messageStream(decisionMessage({ model: "decision-test/chat", effort: null }));
			});
		const def = workflow({
			name: "stale-auto",
			description: "",
			inputs: {},
			outputs: {},
			run: async (ctx) => {
				await ctx
					.stage("task", { model: "auto", ...(stale ? {} : { thinkingLevel: "high" as const }) })
					.prompt("Task");
				return {};
			},
		});
		assert.equal((await run(def, {}, f)).status, "failed");
		assert.equal(f.admissions.length, 0);
		assert.equal(f.infer.mock.calls.length, stale ? 1 : 0);
	}
});

test("reusing an auto stage session makes only one decision and retains selected metadata", async () => {
	const f = await fixture();
	const ctx = createStageContext(
		makeOpts({ adapters: f.adapters, models: f.models, stageOptions: { model: "auto" } }),
	);
	await ctx.__ensureSession();
	assert.equal(f.admissions.length, 0);
	await ctx.prompt("Actual task");
	await ctx.prompt("Next prompt");
	assert.equal(f.infer.mock.calls.length, 1);
	assert.deepEqual(ctx.__modelFallbackMeta().routerSelection, { model: "decision-test/chat", effort: null });
	await ctx.__dispose();
});

test("restored verified selection revalidates without inference; stale restored selection never reroutes", async () => {
	for (const model of ["decision-test/chat", "missing/model"]) {
		const f = await fixture();
		const ctx = createStageContext(
			makeOpts({
				adapters: f.adapters,
				models: f.models,
				stageOptions: { model: "auto", routerSelection: { model, effort: null } },
			}),
		);
		if (model === "decision-test/chat") await ctx.prompt("Resume");
		else await assert.rejects(ctx.prompt("Resume"), /no longer eligible/);
		assert.equal(f.infer.mock.calls.length, 0);
		assert.equal(f.admissions.length, model === "decision-test/chat" ? 1 : 0);
		await ctx.__dispose();
	}
});

test("model-dependent pre-prompt operations do not fabricate auto tasks; setModel is deliberate", async () => {
	const f = await fixture();
	const ctx = createStageContext(
		makeOpts({ adapters: f.adapters, models: f.models, stageOptions: { model: "auto" } }),
	);
	await assert.rejects(ctx.compact(), /requires prompt text/);
	await ctx.setModel(decisionModel);
	assert.equal(f.admissions.length, 1);
	assert.equal(f.infer.mock.calls.length, 0);
	await ctx.__dispose();
});

test("credential-bearing task is rejected before deciding inference without leaking the task", async () => {
	const f = await fixture();
	const secret = "sk-123456789012345678901234567890";
	const ctx = createStageContext(
		makeOpts({ adapters: f.adapters, models: f.models, stageOptions: { model: "auto" } }),
	);
	await assert.rejects(
		ctx.prompt(`Use ${secret}`),
		(error: Error) => !error.message.includes(secret) && /credential material/.test(error.message),
	);
	assert.equal(f.infer.mock.calls.length, 0);
	assert.equal(f.admissions.length, 0);
	await ctx.__dispose();
});

test("stage decisions survive the actual strict Responses schema conversion", async () => {
	const f = await fixture();
	const ctx = createStageContext(
		makeOpts({ adapters: f.adapters, models: f.models, stageOptions: { model: "auto" } }),
	);
	await ctx.prompt("Actual task");
	const tool = f.infer.mock.calls[0]![1].tools![0]!;
	const converted = convertResponsesTools([tool], { strict: true })[0]!;
	assert.equal(converted.type, "function");
	if (converted.type !== "function") throw new Error("Expected function");
	for (const validator of [Compile(tool.parameters), Compile(converted.parameters as typeof tool.parameters)]) {
		assert.equal(validator.Check({ model: "decision-test/chat", effort: null }), true);
		for (const invalid of [
			{ model: "decision-test/chat" },
			{ model: "decision-test/chat", effort: "off" },
			{ model: "decision-test/chat", effort: null, extra: 1 },
		])
			assert.equal(validator.Check(invalid), false);
	}
	assert.equal(f.infer.mock.calls.length, 1);
	await ctx.__dispose();
});

test("reasoning fallback preserves explicit and inherited efforts and immutable selection", async () => {
	for (const suffix of ["", ":low"]) {
		const f = await fixture();
		const primary = {
			...decisionModel,
			id: "primary",
			reasoning: true,
			thinkingLevelMap: { high: "high", low: "low", off: null, minimal: null, medium: null, xhigh: null, max: null },
		};
		const fallback = { ...primary, id: "fallback" };
		vi.spyOn(f.modelRegistry, "getAvailable").mockReturnValue([decisionModel, primary, fallback]);
		f.infer.mockImplementation(() =>
			messageStream(decisionMessage({ model: "decision-test/primary", effort: "high" })),
		);
		const efforts: string[] = [];
		const ctx = createStageContext(
			makeOpts({
				models: f.models,
				stageOptions: {
					model: "auto",
					fallbackModels: [`decision-test/fallback${suffix}`],
					modelConstraints: { allowedEfforts: ["high", "low"] },
				},
				adapters: {
					agentSession: {
						async create(options) {
							efforts.push(options.thinkingLevel!);
							assert.equal(options.isFallbackModelAllowed?.(fallback, "off"), false);
							assert.equal(options.isFallbackModelAllowed?.(fallback, "high"), true);
							return makeMockSession({
								model: options.model,
								thinkingLevel: options.thinkingLevel!,
								async prompt() {
									if (options.model?.id === "primary") throw new Error("429 rate limit");
									return "done";
								},
								getLastAssistantText: () => "done",
							}).session;
						},
					},
				},
			}),
		);
		await ctx.prompt("Prove correctness");
		assert.deepEqual(efforts, ["high", suffix ? "low" : "high"]);
		assert.deepEqual(ctx.__modelFallbackMeta().routerSelection, { model: "decision-test/primary", effort: "high" });
		assert.equal(ctx.__modelFallbackMeta().model, "decision-test/fallback");
		assert.equal(f.infer.mock.calls.length, 1);
		await ctx.__dispose();
	}
});

for (const auth of ["stored", "env"] as const) {
	test(`stage auto selects Jev through normal ${auth} auth without Jev execution`, async () => {
		const f = await fixture();
		const key = "synthetic-stage-jev-key";
		if (auth === "env") vi.stubEnv("TYPESAFE_AI_API_KEY", key);
		else {
			await f.decisionRuntime.saveCredential("typesafe-ai", { type: "api_key", key });
		}
		const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${key}`);
			const body = JSON.parse(String(init?.body)) as JevFixtureRequest;
			assert.equal(JSON.stringify(body).includes(key), false);
			return Response.json(jevFixtureResponse(body));
		});
		vi.stubGlobal("fetch", fetch);
		const models = workflowModelCatalogFromContext({
			model: decisionModel,
			modelRegistry: f.modelRegistry,
			getRouterModel: () => "",
		});
		const ctx = createStageContext(makeOpts({ adapters: f.adapters, models, stageOptions: { model: "auto" } }));
		await ctx.prompt("Actual task");
		assert.deepEqual(f.admissions, ["decision-test/chat"]);
		assert.equal(f.infer.mock.calls.length, 0);
		assert.equal(fetch.mock.calls.length, 1);
		await ctx.__dispose();
	});
}

test("durable session checkpoint roundtrip restores selection without another inference", async () => {
	const f = await fixture();
	const backend = new InMemoryDurableBackend();
	backend.registerWorkflow({ workflowId: "auto", name: "auto", inputs: {}, createdAt: 1, status: "running" });
	const selection = { model: "decision-test/chat", effort: null };
	await recordStageSessionCheckpoint(
		{ backend, workflowId: "auto", nextCheckpointId: () => "cp", nextReplayKey: () => "stage:test" },
		{
			id: "s",
			name: "task",
			status: "running",
			parentIds: [],
			toolEvents: [],
			replayKey: "stage:test",
			sessionFile: "/synthetic/session.jsonl",
			routerSelection: selection,
			model: "different/actual",
		},
	);
	const checkpoint = backend.listCheckpoints("auto")[0]!;
	const encoded = encodeCheckpoint(checkpoint);
	const decoded = decodeToCheckpoint("auto", checkpoint.checkpointId, encoded);
	assert.ok(decoded?.kind === "stage");
	assert.deepEqual(decoded.routerSelection, selection);
	assert.equal(decoded.model, "different/actual");
	for (const invalid of [
		{ model: "decision-test/chat" },
		{ ...selection, extra: 1 },
		{ ...selection, effort: "unknown" },
	])
		assert.equal(
			decodeToCheckpoint("auto", checkpoint.checkpointId, { ...encoded, routerSelection: invalid }),
			undefined,
		);
	const restored = new InMemoryDurableBackend();
	restored.registerWorkflow({ workflowId: "auto", name: "auto", inputs: {}, createdAt: 1, status: "running" });
	restored.recordCheckpoint(decoded);
	assert.deepEqual(restored.getStageSession("auto", "stage:test")?.routerSelection, selection);
	const stage = createDurableStagePrimitive({
		workflowId: "auto",
		backend: restored,
		nextReplayKey: () => "stage:test",
		stage: (_name, options) => {
			assert.deepEqual(options?.routerSelection, selection);
			// Test selection readmission independently of opening the synthetic file.
			return createStageContext(
				makeOpts({
					models: f.models,
					adapters: f.adapters,
					stageOptions: { model: "auto", routerSelection: options?.routerSelection },
				}),
			);
		},
	})("task", { model: "auto" });
	await stage.prompt("Original prompt");
	assert.equal(f.infer.mock.calls.length, 0);
	assert.equal(f.admissions.length, 1);
	restored.recordCheckpoint({
		...decoded,
		checkpointId: "completed",
		output: "Saved result",
		result: "Saved result",
		topology: { ...decoded.topology!, status: "completed" },
	});
	const cached = createDurableStagePrimitive({
		workflowId: "auto",
		backend: restored,
		nextReplayKey: () => "stage:test",
		stage: () => {
			throw new Error("Replay must not construct a live stage");
		},
	})("task", { model: "auto" });
	assert.equal(await cached.prompt("Ignored on replay"), "Saved result");
	assert.equal(f.infer.mock.calls.length, 0);
});

test("parallel failure cancels no-longer-needed sibling routing before any child admission", async () => {
	const f = await fixture();
	const failure = createAssistantMessageEventStream();
	let siblingSignal: AbortSignal | undefined;
	f.infer.mockImplementation((_model, context, options) => {
		const task = JSON.parse(context.messages[0]!.content as string).state.task;
		if (task === "Fail") return failure;
		siblingSignal = options?.signal;
		failure.push({ type: "done", reason: "toolUse", message: decisionMessage({ model: "missing", effort: null }) });
		return createAssistantMessageEventStream();
	});
	const def = workflow({
		name: "parallel-cancel-auto",
		description: "",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.parallel(
				[
					{ name: "fail", prompt: "Fail" },
					{ name: "pending", prompt: "Pending" },
				],
				{ model: "auto", concurrency: 2 },
			);
			return {};
		},
	});
	assert.equal((await run(def, {}, f)).status, "failed");
	assert.ok(siblingSignal?.aborted);
	assert.equal(f.admissions.length, 0);
});

test("stage routing receives interpolated workflow inputs, not the template or stage name", async () => {
	const f = await fixture();
	const def = workflow({
		name: "input-auto",
		description: "",
		inputs: { objective: Type.String() },
		outputs: {},
		run: async (ctx) => {
			await ctx
				.stage("Analyze", { model: "auto" })
				.prompt(`Analyze ${ctx.inputs.objective} with the supplied context.`);
			return {};
		},
	});
	assert.equal((await run(def, { objective: "literal objective" }, f)).status, "completed");
	assert.equal(
		JSON.parse(f.infer.mock.calls[0]![1].messages[0]!.content as string).state.task,
		"Analyze literal objective with the supplied context.",
	);
});

test("catalog changes during route authority wait prevent child admission", async () => {
	const f = await fixture();
	const ctx = createStageContext(
		makeOpts({
			models: f.models,
			adapters: f.adapters,
			stageOptions: { model: "auto" },
			routeAuthorityReady: () => ({
				completion: Promise.resolve().then(() => {
					vi.spyOn(f.modelRegistry, "getAvailable").mockReturnValue([]);
				}),
				assertCurrent() {},
			}),
		}),
	);
	await assert.rejects(ctx.prompt("Task"), /no longer eligible/);
	assert.equal(f.admissions.length, 0);
	await ctx.__dispose();
});

test("prompt and complete adapters receive a concrete routed model rather than auto", async () => {
	for (const method of ["prompt", "complete"] as const) {
		const f = await fixture();
		let selected: string | undefined;
		const ctx = createStageContext(
			makeOpts({
				models: f.models,
				stageOptions: { model: "auto" },
				adapters:
					method === "prompt"
						? {
								prompt: {
									async prompt(_text, meta) {
										selected = String(meta?.stageOptions?.model);
										return "done";
									},
								},
							}
						: {
								complete: {
									async complete(_text, _options, meta) {
										selected = String(meta?.stageOptions?.model);
										return "done";
									},
								},
							},
			}),
		);
		assert.equal(await ctx[method]("Actual adapter task"), "done");
		assert.equal(selected, "decision-test/chat");
		assert.equal(f.infer.mock.calls.length, 1);
		await ctx.__dispose();
	}
});

for (const method of ["prompt", "complete"] as const) {
	for (const model of [undefined, "decision-test/chat"]) {
		test(`non-auto ${method} adapter preserves immediate execution for ${model ?? "default"}`, async () => {
			const f = await fixture();
			const execute = vi.fn(async () => "done");
			const ctx = createStageContext(
				makeOpts({
					models: f.models,
					stageOptions: model === undefined ? {} : { model },
					adapters: method === "prompt" ? { prompt: { prompt: execute } } : { complete: { complete: execute } },
				}),
			);
			try {
				const pending = ctx[method]("Task");
				assert.equal(execute.mock.calls.length, 1);
				assert.equal(f.infer.mock.calls.length, 0);
				assert.equal(await pending, "done");
			} finally {
				await ctx.__dispose();
			}
		});
	}
	test(`auto ${method} adapter rejects cancellation after selection before execution`, async () => {
		const f = await fixture();
		const abort = new AbortController();
		const execute = vi.fn(async () => "done");
		const ctx = createStageContext(
			makeOpts({
				models: f.models,
				signal: abort.signal,
				stageOptions: { model: "auto" },
				onModelFallbackMetaChange: () => abort.abort(),
				adapters: method === "prompt" ? { prompt: { prompt: execute } } : { complete: { complete: execute } },
			}),
		);
		try {
			await assert.rejects(ctx[method]("Task"));
			assert.equal(execute.mock.calls.length, 0);
			assert.equal(f.infer.mock.calls.length, 1);
		} finally {
			await ctx.__dispose();
		}
	});
	test(`auto ${method} adapter revalidates catalog before each execution without rerouting`, async () => {
		const f = await fixture();
		const execute = vi.fn(async () => "done");
		const ctx = createStageContext(
			makeOpts({
				models: f.models,
				stageOptions: { model: "auto" },
				adapters: method === "prompt" ? { prompt: { prompt: execute } } : { complete: { complete: execute } },
			}),
		);
		try {
			assert.equal(await ctx[method]("Task"), "done");
			vi.spyOn(f.modelRegistry, "getAvailable").mockReturnValue([]);
			await assert.rejects(ctx[method]("Next task"));
			assert.equal(execute.mock.calls.length, 1);
			assert.equal(f.infer.mock.calls.length, 1);
		} finally {
			await ctx.__dispose();
		}
	});
}

for (const change of ["empty catalog", "price exceeds maxInputCost", "still eligible"] as const) {
	test(`public live auto resume with ${change} retains one selection and session`, async () => {
		setDurableBackend(new InMemoryDurableBackend());
		const f = await fixture();
		const controls = createStageControlRegistry();
		const started = Promise.withResolvers<void>();
		let runId = "";
		let rejectPrompt: (error: Error) => void = () => {};
		const prompts: string[] = [];
		let sessions = 0;
		const definition = workflow({
			name: "public-auto-pause",
			description: "",
			inputs: {},
			outputs: {},
			run: async (ctx) => {
				assert.ok(ctx.runId);
				runId = ctx.runId;
				await ctx.stage("work", { model: "auto", modelConstraints: { maxInputCost: 1 } }).prompt("Original task");
				return {};
			},
		});
		const running = run(
			definition,
			{},
			{
				...f,
				stageControlRegistry: controls,
				adapters: {
					agentSession: {
						async create(options) {
							sessions++;
							return makeMockSession({
								model: options.model,
								async prompt(text) {
									prompts.push(text);
									if (prompts.length === 1) {
										started.resolve();
										return new Promise<string>((_, reject) => {
											rejectPrompt = reject;
										});
									}
									return "done";
								},
								async abort() {
									rejectPrompt(new Error("paused"));
								},
							}).session;
						},
					},
				},
			},
		);
		await started.promise;
		const handle = controls.forRun(runId)[0];
		assert.ok(handle);
		await handle.pause();
		if (change === "empty catalog") vi.spyOn(f.modelRegistry, "getAvailable").mockReturnValue([]);
		if (change === "price exceeds maxInputCost") {
			vi.spyOn(f.modelRegistry, "getAvailable").mockReturnValue([
				{ ...decisionModel, cost: { ...decisionModel.cost, input: 2 } },
			]);
		}
		await handle.resume("Authorized resumed task");
		const result = await running;
		assert.deepEqual(
			prompts,
			change === "still eligible" ? ["Original task", "Authorized resumed task"] : ["Original task"],
		);
		assert.equal(result.status, change === "still eligible" ? "completed" : "failed");
		assert.equal(sessions, 1);
		assert.equal(f.infer.mock.calls.length, 1);
	});
}
