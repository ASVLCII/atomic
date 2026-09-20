import type { Model } from "@bastani/pi-ai";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { createInMemoryTestBackend, setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { run } from "../../packages/workflows/src/runs/foreground/executor.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { makeMockSession } from "../unit/stage-runner-helpers.js";

/** Controlled SDK adapter shared by the #3110 regression and interactive terminal scenario. */
export async function startFallbackWidgetScenario() {
	setDurableBackend(createInMemoryTestBackend());
	const store = createStore();
	const ready = Promise.withResolvers<void>();
	const finish = Promise.withResolvers<void>();
	const primary: Model<"openai-completions"> = {
		id: "model-a",
		name: "Model A",
		provider: "openai",
		api: "openai-completions",
		baseUrl: "https://fixture.invalid",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 10000,
		maxTokens: 1000,
	};
	let activeModel = primary;
	let activeThinking = "high";
	const prompts: string[] = [];
	const creations: string[] = [];
	const prompt = async (text: string) => {
		prompts.push(text);
		if (prompts.length === 2) ready.resolve();
		await finish.promise;
		return undefined;
	};
	const affected = makeMockSession({ prompt });
	Object.defineProperties(affected.session, {
		model: { get: () => activeModel },
		thinkingLevel: { get: () => activeThinking },
	});
	const sibling = makeMockSession({ model: { ...primary, id: "unchanged" }, thinkingLevel: "low", prompt });
	const execution = run(
		workflow({
			name: "fallback-widget",
			description: "",
			outputs: {},
			async run(ctx) {
				await Promise.all([
					ctx.stage("affected", { model: "openai/model-a:high" }).prompt("  affected input  "),
					ctx.stage("sibling", { model: "openai/unchanged:low" }).prompt("sibling input"),
				]);
				return {};
			},
		}),
		{},
		{
			store,
			adapters: {
				agentSession: {
					async create(_options, meta) {
						creations.push(meta!.stageName);
						return meta?.stageName === "affected" ? affected.session : sibling.session;
					},
				},
			},
		},
	);
	await ready.promise;
	return {
		store,
		runId: store.runs()[0]!.id,
		prompts,
		creations,
		announce(id: string) {
			affected.emit({
				type: "model_fallback_start",
				from: `openai/${activeModel.id}`,
				to: `openai/${id}`,
				reason: "quota",
				attempt: 1,
			});
		},
		apply(id: string, thinking: string) {
			const previousModel = activeModel;
			activeModel = { ...primary, id };
			activeThinking = thinking;
			// Match AgentSession's ordering: model and effort change before this event.
			affected.emit({ type: "model_changed", model: activeModel, previousModel, source: "fallback" });
		},
		async finish() {
			finish.resolve();
			return execution;
		},
	};
}
