// Dated, compact extracts of docs/models/evals.md, not a live leaderboard or a
// provider entitlement claim. The parity test checks these rows against that guide.
export const MODEL_ROUTING_POLICY = {
	effort: {
		trivial: "Use the least reasoning sufficient for a literal response or mechanical task.",
		implementation: "Usually low or medium; validate with tools.",
		review: "Usually high or xhigh for review, test design, failure analysis and approval.",
		planning: "Usually high for demanding mapping, planning and reconciliation; medium for routine synthesis.",
		reporting: "Usually medium. Max needs task-specific justification or an explicit request.",
	},
	evidence:
		"Measurements apply only to the named model, effort and harness. Do not transfer scores to another effort, version, fast variant or provider. Missing evidence is unknown, not zero. Rounded leads are not significance. External benchmarks do not establish security-review reliability. Prefer task fit and proportionate cost over aggregate rank.",
};

// model, measured effort, pass@1 %, displayed interval ±, USD/task, output ktokens, steps
const deepSweRows: readonly (readonly [string, string, number, number, number, number, number])[] = [
	["gpt-6-astra", "xhigh", 74, 3, 6.52, 30, 29],
	["gemini-3.8-flash", "high", 74, 1, 2.36, 143, 166],
	["claude-opus-5", "max", 74, 4, 11.84, 118, 99],
	["gpt-5.6-sol", "max", 73, 3, 6.46, 60, 61],
	["claude-fable-5", "xhigh", 70, 3, 13.41, 80, 68],
	["glm-5.3", "max", 69, 3, 3.99, 80, 124],
	["kimi-k3", "max", 69, 5, 4.65, 81, 98],
	["grok-4.6", "medium", 67, 2, 3.45, 50, 70],
	["gpt-5.6-luna", "max", 67, 4, 0.61, 73, 102],
	["gpt-5.5", "xhigh", 67, 6, 7.23, 46, 82],
	["gemini-3.7-flash", "medium", 65, 3, 2.03, 94, 117],
	["glm-5.3-flash", "max", 63, 4, 0.24, 73, 123],
	["deepseek-v4-pro", "max", 63, 6, 1.67, 106, 155],
	["claude-opus-4.8", "max", 59, 2, 13.22, 135, 120],
	["qwen3.8-max", "xhigh", 57, 3, 3.73, 95, 111],
	["muse-spark-1.2", "xhigh", 55, 2, 3.7, 99, 101],
	["claude-sonnet-5", "max", 54, 4, 26.4, 214, 268],
	["deepseek-v4-flash", "max", 53, 4, 0.46, 108, 153],
	["gemini-3.6-flash", "high", 47, 4, 2.21, 96, 117],
	["glm-5.2", "max", 44, 2, 3.92, 78, 129],
	["gemini-3.5-flash", "high", 36, 4, 3.45, 76, 105],
];

// Exact source label keeps measurement settings (including fallback) explicit.
// model, label, Briefcase, GDPval, Automation, Terminal, SciCode, HLE, CritPt,
// GDP.pdf, Omniscience accuracy, Omniscience non-hallucination, LCR (all percent).
const aaRows: readonly (readonly [string, string, ...number[]])[] = [
	["claude-fable-5-1", "Claude Fable 5.1 (max with fallback)", 58, 63, 59, 52, 63, 59, 30, 26, 67, 27, 85],
	["claude-fable-5-1", "Claude Fable 5.1 (xhigh with fallback)", 58, 62, 58, 55, 61, 59, 31, 26, 66, 29, 83],
	["claude-fable-5-1", "Claude Fable 5.1 (high with fallback)", 54, 57, 55, 52, 59, 56, 30, 27, 65, 31, 84],
	["claude-fable-5-1", "Claude Fable 5.1 (medium with fallback)", 52, 54, 55, 45, 56, 54, 29, 27, 63, 31, 85],
	["claude-fable-5-1", "Claude Fable 5.1 (low with fallback)", 49, 50, 52, 40, 57, 49, 28, 28, 60, 34, 82],
	["claude-opus-5", "Claude Opus 5 (max)", 57, 62, 57, 49, 56, 55, 29, 22, 61, 39, 79],
	["claude-opus-5", "Claude Opus 5 (xhigh)", 56, 60, 53, 46, 56, 54, 28, 21, 60, 40, 80],
	["claude-opus-5", "Claude Opus 5 (high)", 53, 56, 54, 46, 55, 53, 28, 20, 59, 39, 79],
	["claude-fable-5", "Claude Fable 5 (with fallback)", 51, 57, 54, 42, 61, 55, 29, 24, 65, 36, 82],
	["gpt-6-astra", "GPT-6 Astra (max)", 53, 54, 68, 59, 56, 55, 32, 31, 63, 49, 81],
	["gpt-6-astra", "GPT-6 Astra (xhigh)", 52, 53, 67, 60, 56, 55, 31, 32, 62, 52, 80],
	["gpt-6-astra", "GPT-6 Astra (high)", 50, 51, 67, 54, 55, 53, 29, 31, 61, 55, 80],
	["gpt-6-astra", "GPT-6 Astra (medium)", 48, 50, 65, 49, 54, 53, 29, 30, 61, 53, 80],
	["gpt-6-astra", "GPT-6 Astra (low)", 38, 46, 59, 42, 54, 49, 26, 30, 60, 53, 80],
	["gpt-6-astra", "GPT-6 Astra (Non-reasoning)", 49, 52, 62, 51, 53, 37, 20, 27, 56, 35, 71],
	["gpt-5.6-sol", "GPT-5.6 Sol (max)", 49, 56, 60, 40, 57, 49, 32, 27, 59, 8, 84],
	["gpt-5.6-sol", "GPT-5.6 Sol (xhigh)", 47, 54, 55, 25, 57, 47, 29, 28, 59, 8, 82],
	["gpt-5.6-sol", "GPT-5.6 Sol (high)", 43, 51, 55, 21, 58, 46, 26, 28, 58, 9, 82],
	["gpt-5.6-terra", "GPT-5.6 Terra (max)", 42, 49, 60, 35, 55, 43, 30, 24, 47, 12, 83],
	["gpt-5.6-luna", "GPT-5.6 Luna (max)", 42, 49, 50, 12, 54, 39, 21, 24, 43, 7, 84],
	["muse-spark-1.3", "Muse Spark 1.3 (max)", 54, 60, 58, 33, 59, 49, 25, 27, 44, 67, 83],
	["muse-spark-1.3", "Muse Spark 1.3 (xhigh)", 49, 58, 57, 17, 60, 47, 26, 24, 42, 69, 83],
	["grok-4.6", "Grok 4.6 (high)", 52, 57, 67, 21, 56, 43, 17, 17, 48, 66, 80],
	["kimi-k3", "Kimi K3 (max)", 50, 54, 58, 13, 59, 47, 23, 22, 48, 47, 89],
	["glm-5.3", "GLM-5.3 (max)", 51, 59, 62, 42, 59, 42, 19, 11, 34, 70, 80],
	["glm-5.3-flash", "GLM-5.3-Flash", 48, 58, 60, 33, 52, 40, 15, 15, 28, 72, 80],
	["gemini-3.8-flash", "Gemini 3.8 Flash (high)", 35, 48, 60, 20, 57, 48, 18, 21, 55, 45, 81],
	["gemini-3.7-flash", "Gemini 3.7 Flash (high)", 31, 47, 62, 14, 57, 48, 14, 24, 55, 35, 82],
	["claude-sonnet-5", "Claude Sonnet 5 (max)", 43, 50, 37, 14, 54, 41, 17, 13, 40, 61, 82],
	["deepseek-v4-pro-0813", "DeepSeek V4 Pro 0813 (max)", 38, 50, 57, 14, 51, 41, 18, 11, 49, 5, 80],
	["deepseek-v4-flash-0731", "DeepSeek V4 Flash 0731 (max)", 38, 48, 54, 12, 50, 39, 17, 11, 40, 8, 80],
];

export function benchmarkEvidence() {
	return [
		{
			benchmark: "DeepSWE v1.1, Best view",
			source: "https://deepswe.datacurve.ai/",
			date: "2026-09-03",
			dateKind: "benchmark snapshot",
			retrieved: "2026-09-05",
			columns: ["model", "measured effort", "pass@1 %", "interval ±", "USD/task", "output ktokens", "steps"],
			caveats:
				"mini-swe-agent, 113 tasks. Astra costs use expected launch pricing, not billed rates. Sol promotional pricing; DeepSeek peak rates. Not Atomic or AA agent results.",
			rows: deepSweRows.map((row) => [...row]),
		},
		{
			benchmark: "Artificial Analysis Intelligence Index v4.3 components",
			source: "https://artificialanalysis.ai/leaderboards/models",
			date: "2026-09-07",
			dateKind: "index revision, not per-measurement publication",
			retrieved: "2026-09-08",
			columns: [
				"model",
				"measured configuration",
				"AA-Briefcase normalized Elo %",
				"GDPval-AA v2 normalized Elo %",
				"AutomationBench-AA %",
				"Terminal-Bench v4.0 %",
				"SciCode %",
				"Humanity's Last Exam %",
				"CritPt %",
				"GDP.pdf All-pass %",
				"AA-Omniscience accuracy %",
				"AA-Omniscience non-hallucination %",
				"AA-LCR v1.1 %",
			],
			caveats:
				"Source has no per-measurement date. Fable includes default fallback, not arbitrary no-fallback configurations. Normalized Elo is not pass rate. Non-hallucination counts partial/unattempted among non-correct answers, not all answers. Missing effort labels remain unspecified. Not Coding Agent Index or Datacurve results.",
			rows: aaRows.map((row) => [...row]),
		},
	];
}

export function routingEvidence(fullIds: readonly string[]) {
	// The recorded snapshots identify models but not serving providers. Keep them
	// for source parity; do not attribute them to a provider by guessing from a
	// model name. Only explicitly provider-qualified measurement identities may
	// enter routing. Until provenance is recorded, missing evidence stays unknown.
	const ids = new Set(fullIds.filter((id) => id.includes("/")));
	return benchmarkEvidence()
		.map((dataset) => ({ ...dataset, rows: dataset.rows.filter(([id]) => typeof id === "string" && ids.has(id)) }))
		.filter((dataset) => dataset.rows.length > 0);
}
