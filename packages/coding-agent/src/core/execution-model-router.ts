import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Api, containsKnownEnvCredential, getSupportedThinkingLevels, type Model } from "@bastani/pi-ai";
import { Type } from "typebox";
import { getDocsPath } from "../config.js";
import type { ModelRegistry } from "./model-registry.ts";
import {
	eligiblePair,
	type ModelConstraints,
	type ModelRouterOutput,
	parseModelConstraints,
} from "./model-routing-constraints.js";
import { modelRoutingTask } from "./model-routing-task.js";
import { inferRouterDecision, resolveRouterModel } from "./structured-output/index.js";

export interface ModelRoutingContext {
	readonly modelRegistry: Pick<
		ModelRegistry,
		"getAll" | "getAvailable" | "streamSimple" | "containsConfiguredCredential"
	> &
		Partial<Pick<ModelRegistry, "getProviderAuthStatus" | "getProviderAuth">>;
	readonly model?: Model<Api>;
	getRouterModel(): string;
}
export interface ModelRoute {
	readonly routerSelection: ModelRouterOutput;
	readonly modelOverride: string;
	readonly fallbackModels?: readonly string[];
	assertCurrent(): void;
	allowsModel(model: Model<Api>, effort?: string): boolean;
}
const instructions =
	"Select one eligible model/effort pair for `task` and `agent` from the supplied Choice criteria, using `evals` as evidence and `model_selection_guide` as policy. Match the agent role to the guide's model cost tier and thinking level first, then consider task fit, measured effort, dates, caveats and cost. Evals cannot add candidates or bypass constraints. Return exactly model and effort; null means no configurable reasoning.";

/** Static selection policy sent with every auto-routing request alongside the dated `evals` evidence. */
export const MODEL_SELECTION_GUIDE = `## Benchmarks are evidence, not policy

Benchmark results are measurements under named harnesses, dates, models, efforts, agents, tools, prompts, prices, and scoring rules. Treat a bracketed effort level as the measurement configuration for that row, not a command to run every task at that effort. Compare only records whose measured setup resembles the decision at hand, and keep unmeasured work under ordinary validation rather than inheriting a score.

Missing evidence is unknown, not zero. A rounded lead is not proof of significance. A result for one provider, model version, effort, agent, fallback setting, or benchmark harness does not transfer to another identity.

## Role-based thinking effort

Use these starting defaults unless the user requests a level. Higher effort can improve hard reasoning, but it also costs more and can be slower. \`max\` is an exception, not a default.

Price is per task. Candidate cost is USD per million tokens, and roles differ in token volume and in what a mistake costs. High-volume, tool-checked roles such as exploration and routine implementation default to cheaper, faster models; roles where a missed defect is expensive, such as review, verification, and final approval, justify frontier models at high effort. Pick the tier first, then the effort within it; do not compensate for a cheap model with \`max\` or for an expensive one with \`minimal\`.

| Stage role | Default thinking level | Model cost tier | Why |
| --- | --- | --- | --- |
| Codebase exploration: locating files, reading code, tracing call sites | \`minimal\` or \`low\` | Cheap, fast | Tool-driven lookups need speed, not deliberation; escalate to mapping or analysis only when the question becomes a design judgement. |
| Coding, implementation, routine fixes | \`low\` or \`medium\` | Cheap or mid-priced | Runs many times per task and is validated by tools and review afterwards. |
| Code review, test design, failure analysis, security, identity, adversarial challenge, final approval | \`high\` or \`xhigh\` | Frontier | A missed defect is the expensive outcome; spend the strongest model and reasoning here. |
| Codebase mapping, lifecycle analysis, compatibility, planning, synthesis, triage | \`high\` | Frontier or mid-priced | Resolve ambiguity before downstream work depends on it. |
| Orchestration, delegation, and multi-stage coordination | \`medium\` or \`high\` | Mid-priced | Judge scope, sequence work, and integrate results without re-deriving what delegated stages already verified. |
| User-impact review and final reporting | \`medium\` | Mid-priced | Preserve evidence and communicate clearly without unnecessary reasoning. |
| Deterministic checks | No model call | — | Run tests, typechecks, probes, and scripts directly. |

An explicit user request wins over these defaults, but the requested level must exist for the selected catalog entry. Do not invent unsupported suffixes. If \`xhigh\` is unavailable, use \`high\` rather than automatically promoting to \`max\`; choose another catalog model or leave the stage unpinned if neither fits.
`;

export const MODEL_SELECTION_EVALS_JSON_BYTES = 16_000;
const EVALS_BUDGET_ERROR = `Auto routing requires a nonempty evals.md document within ${MODEL_SELECTION_EVALS_JSON_BYTES.toLocaleString("en-US")} JSON-encoded bytes. Repair the Atomic installation or select a concrete execution model.`;
function jsonBytes(value: string): number {
	return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function modelToken(id: string): string {
	return (id.split("/").pop() ?? id).toLowerCase().replace(/[._]/g, "-");
}

function rowMatches(line: string, tokens: readonly string[]): boolean {
	const cells = line.split("|").map((cell) => cell.trim().toLowerCase());
	const slug = (cells[1] ?? "").replace(/[._]/g, "-");
	const name = (cells[2] ?? "").replace(/[._]/g, " ").replace(/-/g, " ");
	return tokens.some((token) => {
		const spaced = token.replace(/-/g, " ");
		return slug === token || slug.startsWith(`${token}-`) || name === spaced || name.startsWith(`${spaced} `);
	});
}

/** Keep the factual legend and rows for the eligible models inside the routing byte budget. */
export function selectRoutingEvals(document: string, modelIds: readonly string[]): string {
	if (!document.trim()) throw new Error(EVALS_BUDGET_ERROR);
	if (jsonBytes(document) <= MODEL_SELECTION_EVALS_JSON_BYTES) return document;
	const tokens = [...new Set(modelIds.map(modelToken))].filter((token) => token.length >= 4);
	const lines = document.split("\n");
	const kept: string[] = [];
	let header: string[] = [];
	let matched: string[] = [];
	let sample: string[] = [];
	let inTable = false;
	const flush = () => {
		if (!inTable) return;
		const rows = matched.length > 0 ? matched : sample;
		kept.push(...header, ...rows);
		header = [];
		matched = [];
		sample = [];
		inTable = false;
	};
	for (const line of lines) {
		if (line.startsWith("|")) {
			if (!inTable) inTable = true;
			if (header.length < 2) header.push(line);
			else if (rowMatches(line, tokens)) matched.push(line);
			else if (sample.length < 8) sample.push(line);
			continue;
		}
		flush();
		kept.push(line);
	}
	flush();
	const assemble = (limit: number) => {
		const compact: string[] = [];
		let tableHeader: string[] = [];
		let tableRows: string[] = [];
		let tableOpen = false;
		const flushTable = () => {
			if (!tableOpen) return;
			compact.push(...tableHeader, ...tableRows.slice(0, limit));
			tableHeader = [];
			tableRows = [];
			tableOpen = false;
		};
		for (const line of kept) {
			if (line.startsWith("|")) {
				tableOpen = true;
				if (tableHeader.length < 2) tableHeader.push(line);
				else tableRows.push(line);
				continue;
			}
			flushTable();
			compact.push(line);
		}
		flushTable();
		return `${compact.join("\n").trim()}\n`;
	};
	for (const limit of [Number.POSITIVE_INFINITY, 8, 4, 1]) {
		const text = assemble(limit);
		if (jsonBytes(text) <= MODEL_SELECTION_EVALS_JSON_BYTES) return text;
	}
	throw new Error(EVALS_BUDGET_ERROR);
}

async function readModelSelectionEvals(signal?: AbortSignal): Promise<string> {
	try {
		return await readFile(join(getDocsPath(), "models", "evals.md"), { encoding: "utf8", signal });
	} catch (error) {
		signal?.throwIfAborted();
		if (error instanceof Error && error.message === EVALS_BUDGET_ERROR) throw error;
		throw new Error(EVALS_BUDGET_ERROR);
	}
}

export async function routeExecutionModel(input: {
	ctx: ModelRoutingContext;
	task: string;
	agent: { name: string; description: string };
	constraints?: readonly ModelConstraints[];
	signal?: AbortSignal;
	/** Restore a recorded decision without another inference call. */
	selection?: ModelRouterOutput;
}): Promise<ModelRoute> {
	const { ctx, signal } = input;
	signal?.throwIfAborted();
	const constraints = structuredClone((input.constraints ?? []).map((c) => parseModelConstraints(c)!));
	const catalog = () =>
		ctx.modelRegistry
			.getAvailable()
			.filter((model) => model.provider !== "typesafe-ai")
			.map((model) => ({
				model,
				pairs: (model.reasoning ? getSupportedThinkingLevels(model) : [null])
					.map((effort) => ({ model: `${model.provider}/${model.id}`, effort }))
					.filter((pair) => eligiblePair(model, pair, constraints)),
			}))
			.filter((entry) => entry.pairs.length > 0);
	const available = catalog();
	const pairs = available.flatMap((entry) => entry.pairs);
	if (!pairs.length)
		throw new Error(
			"Auto routing has no eligible model/effort pairs. Check configured providers and modelConstraints.",
		);
	let selection = input.selection;
	if (selection === undefined) {
		const settings = { getRouterModel: () => ctx.getRouterModel() };
		resolveRouterModel({ settings, currentModel: ctx.model, modelRegistry: ctx.modelRegistry });
		const candidates = available.flatMap(({ model, pairs }) =>
			pairs.map((pair) => ({
				...pair,
				input: model.input,
				contextWindow: model.contextWindow,
				cost: { ...model.cost, tiers: (model.cost.tiers ?? []).map((tier) => ({ ...tier })) },
			})),
		);
		const allCriteria = Object.fromEntries(
			candidates.map((candidate, index) => [`pair_${index}`, JSON.stringify(candidate)]),
		);
		const state = {
			task: input.task,
			agent: { name: input.agent.name, description: input.agent.description },
			evals: selectRoutingEvals(
				await readModelSelectionEvals(signal),
				candidates.map((candidate) => candidate.model),
			),
			model_selection_guide: MODEL_SELECTION_GUIDE,
		};
		if (!state.task.trim()) throw new Error("Auto routing requires task instructions.");
		const serialized = JSON.stringify({ state, criteria: allCriteria, constraints });
		let configuredCredential: boolean;
		try {
			configuredCredential = await ctx.modelRegistry.containsConfiguredCredential(serialized);
		} catch {
			throw new Error("Auto routing could not screen configured credentials. No inference was performed.");
		}
		if (
			containsKnownEnvCredential(serialized) ||
			configuredCredential ||
			/\bBearer\s+[A-Za-z0-9._~+/-]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|ghp|github_pat)[-_][A-Za-z0-9_-]{16,}/i.test(
				serialized,
			)
		)
			throw new Error("Auto routing context contains credential material. Remove secrets before retrying.");
		// Screen the full task first, even credentials in text the router will omit.
		// Shortening only affects the routing request, never the execution prompt,
		// so it is not surfaced to the user.
		state.task = modelRoutingTask(state.task);
		const ranked: ModelRouterOutput[] = [];
		// Rank by repeated bounded choices, excluding all efforts of earlier models.
		// Probabilities from separate tournament batches are not comparable.
		while (ranked.length < Math.min(3, available.length)) {
			const remaining = pairs.filter((pair) => !ranked.some((selected) => selected.model === pair.model));
			if (!remaining.length) break;
			const criteria = Object.fromEntries(
				remaining.map((pair) => {
					const key = `pair_${pairs.indexOf(pair)}`;
					return [key, allCriteria[key]];
				}),
			);
			// Strict Responses providers reject object unions. Enumerate scalar values
			// on the wire, then verify the exact model/effort relation before admission.
			const schema = Type.Unsafe<ModelRouterOutput>({
				type: "object",
				properties: {
					model: Type.String({ enum: [...new Set(remaining.map((pair) => pair.model))] }),
					effort: { type: ["string", "null"], enum: [...new Set(remaining.map((pair) => pair.effort))] },
				},
				required: ["model", "effort"],
				additionalProperties: false,
			});
			const result = await inferRouterDecision(
				{
					settings,
					modelRegistry: ctx.modelRegistry,
					currentModel: ctx.model,
					state,
					instructions,
					schema,
					jev: {
						questions: {
							pair: {
								instructions:
									"Which eligible model and reasoning effort best suit this task and agent role, considering the model_selection_guide role tiers, evals, and candidate capabilities and prices? Prefer cheaper candidates for exploration and routine implementation and stronger ones for review and verification. Candidate cost is USD per million tokens, not benchmark task cost.",
								criteria,
							},
						},
						decode: (choices) => {
							const pair = pairs[Number(choices.pair?.replace(/^pair_/, ""))];
							if (!pair || choices.pair !== `pair_${pairs.indexOf(pair)}`)
								throw new Error("Invalid execution model Choice.");
							return { ...pair };
						},
					},
					signal,
				},
				(value) => remaining.some((pair) => pair.model === value.model && pair.effort === value.effort),
			);
			ranked.push(result.value);
		}
		selection = { ...ranked[0]!, ...(ranked.length > 1 ? { fallbacks: ranked.slice(1) } : {}) };
	}
	const fallbacks = selection.fallbacks?.map((pair) => Object.freeze({ model: pair.model, effort: pair.effort }));
	if (
		fallbacks &&
		(fallbacks.length > 2 ||
			new Set([selection.model, ...fallbacks.map((pair) => pair.model)]).size !== fallbacks.length + 1)
	)
		throw new Error("Invalid ranked auto selection: expected up to three distinct models.");
	const routerSelection = Object.freeze({
		model: selection.model,
		effort: selection.effort,
		...(fallbacks?.length ? { fallbacks: Object.freeze(fallbacks) } : {}),
	});
	const hasPair = (pair: ModelRouterOutput) =>
		catalog().some((entry) => entry.pairs.some((p) => p.model === pair.model && p.effort === pair.effort));
	const allowsModel = (model: Model<Api>, effort?: string): boolean => {
		const levels = model.reasoning ? getSupportedThinkingLevels(model) : [null];
		return levels.some((level) => {
			if (model.reasoning && effort !== undefined && level !== effort) return false;
			const pair = { model: `${model.provider}/${model.id}`, effort: level };
			return eligiblePair(model, pair, constraints) && hasPair(pair);
		});
	};
	const assertCurrent = () => {
		signal?.throwIfAborted();
		if (![routerSelection, ...(routerSelection.fallbacks ?? [])].every(hasPair))
			throw new Error("Auto selection is no longer eligible. Retry explicitly with the current catalog.");
	};
	assertCurrent();
	return {
		routerSelection,
		modelOverride: routerSelection.model + (routerSelection.effort === null ? "" : `:${routerSelection.effort}`),
		fallbackModels: Object.freeze(
			(routerSelection.fallbacks ?? []).map((pair) => pair.model + (pair.effort === null ? "" : `:${pair.effort}`)),
		),
		assertCurrent,
		allowsModel,
	};
}
