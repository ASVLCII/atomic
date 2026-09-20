import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { test } from "vitest";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { createInMemoryTestBackend, setDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { run } from "../../packages/workflows/src/runs/foreground/executor.js";
import { createStore } from "../../packages/workflows/src/shared/store.js";
import { deriveGraphTheme } from "../../packages/workflows/src/tui/graph-theme.js";
import { GraphView } from "../../packages/workflows/src/tui/graph-view.js";
import { startFallbackWidgetScenario } from "../helpers/workflow-fallback-widget.js";
import { makeMockSession } from "./stage-runner-helpers.js";

// #3110: SDK-internal fallback must reach the already-mounted graph before the prompt settles.
test("applied session fallbacks update the running node card without refreshing or changing its sibling", async () => {
	const scenario = await startFallbackWidgetScenario();
	const { store, runId } = scenario;
	const view = new GraphView({ mode: "overlay", runId, store, graphTheme: deriveGraphTheme({}) });
	const render = () => stripVTControlCharacters(view.render(140).join("\n"));
	const sibling = () => store.runs()[0]!.stages.find((stage) => stage.name === "sibling")!;
	const originalSibling = { ...sibling() };
	try {
		assert.match(render(), /model-a · high/);
		let previous = "model-a";
		for (const [id, thinking] of [
			["model-b-fast", "medium"],
			["model-b-fast", "low"],
			["model-c", "off"],
		] as const) {
			scenario.announce(id);
			assert.match(render(), new RegExp(previous));
			scenario.apply(id, thinking);
			const text = render();
			assert.match(text, new RegExp(thinking === "off" ? id : `${id} · ${thinking}`));
			if (id !== previous) assert.doesNotMatch(text, new RegExp(previous));
			assert.match(text, /unchanged · low/);
			assert.deepEqual(sibling(), originalSibling);
			const stage = store.runs()[0]!.stages.find((stage) => stage.name === "affected")!;
			assert.equal(stage.model, `openai/${id}`);
			assert.equal(stage.thinkingLevel, thinking);
			assert.equal(stage.status, "running");
			assert.deepEqual(scenario.creations, ["affected", "sibling"]);
			assert.deepEqual(scenario.prompts, ["  affected input  ", "sibling input"]);
			previous = id;
		}
	} finally {
		view.dispose();
		const result = await scenario.finish();
		assert.equal(result.status, "completed");
		assert.deepEqual(
			result.stages.map((stage) => stage.result),
			["ok", "ok"],
		);
	}
});

// #3110: the runner-owned replacement path must retain explicit candidate identity too.
test("workflow fallback replacements keep explicit model and effort labels through each attempt", async () => {
	setDurableBackend(createInMemoryTestBackend());
	const store = createStore();
	const attempts: string[] = [];
	const frames: string[] = [];
	let view: GraphView | undefined;
	try {
		const result = await run(
			workflow({
				name: "candidate-widget",
				description: "",
				outputs: {},
				async run(ctx) {
					await ctx
						.stage("affected", {
							model: "openai/model-a:high",
							fallbackModels: ["other/model-b-fast:medium", "openai/model-c:off"],
						})
						.prompt("input");
					return {};
				},
			}),
			{},
			{
				store,
				adapters: {
					agentSession: {
						async create(options) {
							assert.equal(typeof options.model, "string");
							const model = String(options.model);
							attempts.push(model);
							const { session } = makeMockSession({
								thinkingLevel: options.thinkingLevel,
								async prompt() {
									view ??= new GraphView({
										mode: "overlay",
										runId: store.runs()[0]!.id,
										store,
										graphTheme: deriveGraphTheme({}),
									});
									frames.push(stripVTControlCharacters(view.render(140).join("\n")));
									if (model !== "openai/model-c") throw new Error("401 invalid API key");
									return undefined;
								},
							});
							return session;
						},
					},
				},
			},
		);
		assert.equal(result.status, "completed", result.error);
		assert.deepEqual(attempts, ["openai/model-a", "other/model-b-fast", "openai/model-c"]);
		assert.match(frames[0]!, /model-a · high/);
		assert.match(frames[1]!, /model-b-fast · medium/);
		assert.doesNotMatch(frames[1]!, /model-a/);
		assert.match(frames[2]!, /model-c/);
		assert.doesNotMatch(frames[2]!, /model-b-fast/);
		assert.equal(result.stages[0]!.model, "openai/model-c");
		assert.equal(result.stages[0]!.thinkingLevel, "off");
	} finally {
		view?.dispose();
	}
});
