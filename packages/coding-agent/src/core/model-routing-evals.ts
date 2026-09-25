import { jsonBytes, truncateToBytes } from "./model-routing-task.js";

/** Bounds the evaluation evidence sent with one routing request. */
export const MODEL_SELECTION_EVALS_JSON_BYTES = 14_200;

const VENDOR_OR_REGION_PREFIX = /^(?:[a-z][a-z-]*\.)+/u;
const SNAPSHOT_TOKEN = /^\d{4}$/u;
const DEPLOYMENT_TOKENS = new Set([
	"fast",
	"highspeed",
	"ultraspeed",
	"lightning",
	"beta",
	"exp",
	"free",
	"it",
	"instruct",
	"contributor",
]);
const ROW_EDITION_TOKENS = new Set(["preview", "instruct", "it"]);
const VARIANT_TOKENS = new Set([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
	"adaptive",
	"thinking",
	"reasoning",
	"non",
	"effort",
	"preview",
]);
const CLAUDE_FAMILIES = new Set(["opus", "sonnet", "haiku", "fable"]);

/** Artificial Analysis names older Claude models `claude-4-5-sonnet`; catalogs use `claude-sonnet-4-5`. */
function canonicalClaudeOrder(tokens: string[]): string[] {
	if (tokens[0] !== "claude" || !CLAUDE_FAMILIES.has(tokens[1] ?? "")) return tokens;
	const versionEnd = tokens.findIndex((token, index) => index > 1 && !/^\d+$/u.test(token));
	const end = versionEnd < 0 ? tokens.length : versionEnd;
	if (end === 2) return tokens;
	return ["claude", ...tokens.slice(2, end), tokens[1]!, ...tokens.slice(end)];
}

/** Provider-independent model tokens: `us.anthropic.claude-opus-4-6-v1` and `anthropic/claude-opus-4.6` agree. */
export function modelEvidenceTokens(id: string): string[] {
	const normalized = id.trim().toLowerCase();
	const model = normalized
		.slice(normalized.lastIndexOf("/") + 1)
		.replace(/^~/u, "")
		.replace(VENDOR_OR_REGION_PREFIX, "")
		.replace(/(?<=[a-z])-\d+:\d+$/u, "")
		.replace(/:[a-z0-9]+$/u, "")
		.replace(/-v\d+$/u, "")
		.replace(/-\d{8}$/u, "");
	const tokens = model
		.split(/[-._]/u)
		.filter(Boolean)
		.map((token) => (token === "thinking" ? "reasoning" : token));
	return canonicalClaudeOrder(tokens);
}

/** True when `slug` is the candidate model or one of its effort, edition or snapshot variants. */
function slugMatchesCandidate(slug: readonly string[], candidate: readonly string[]): boolean {
	if (slug.length < candidate.length || candidate.some((token, index) => slug[index] !== token)) return false;
	return slug
		.slice(candidate.length)
		.every((token) => VARIANT_TOKENS.has(token) || ROW_EDITION_TOKENS.has(token) || SNAPSHOT_TOKEN.test(token));
}

/**
 * The candidate's own tokens first, then the same model without trailing
 * deployment, reasoning-mode or snapshot suffixes (`gpt-5.4-fast`,
 * `grok-4.20-reasoning`, `qwen3.8-max-0902`). A fallback applies only when the
 * more specific form matched no row, so a model that is itself named `-fast`
 * keeps its own evidence.
 */
function candidateForms(tokens: readonly string[]): string[][] {
	const forms = [[...tokens]];
	let current = [...tokens];
	while (current.length > 1) {
		const last = current[current.length - 1]!;
		if (!DEPLOYMENT_TOKENS.has(last) && !VARIANT_TOKENS.has(last) && !SNAPSHOT_TOKEN.test(last)) break;
		current = current.slice(0, -1);
		forms.push(current);
	}
	return forms;
}

/**
 * Keep the catalog preamble and only the table rows that describe an eligible
 * candidate model, bounded to the routing evidence budget.
 */
export function filterModelSelectionEvals(evals: string, candidates: readonly string[]): string {
	const lines = evals.split("\n");
	const headerIndex = lines.findIndex((line) => /^\|\s*slug\s*\|/u.test(line));
	if (headerIndex < 0) return truncateToBytes(evals, MODEL_SELECTION_EVALS_JSON_BYTES);
	const rows = lines
		.slice(headerIndex + 2)
		.map((line, order) => {
			const slug = line.startsWith("|") ? line.split("|")[1]?.trim() : undefined;
			return { line, order, tokens: slug ? modelEvidenceTokens(slug) : undefined };
		})
		.filter((row): row is { line: string; order: number; tokens: string[] } => row.tokens !== undefined);
	const selected = new Set<number>();
	for (const candidate of new Set(candidates)) {
		for (const form of candidateForms(modelEvidenceTokens(candidate))) {
			const matches = rows.filter((row) => slugMatchesCandidate(row.tokens, form));
			if (matches.length === 0) continue;
			for (const row of matches) selected.add(row.order);
			break;
		}
	}
	const kept = rows.filter((row) => selected.has(row.order)).map((row) => row.line);
	const filtered = [...lines.slice(0, headerIndex + 2), ...kept].join("\n");
	return jsonBytes(filtered) <= MODEL_SELECTION_EVALS_JSON_BYTES
		? filtered
		: truncateToBytes(filtered, MODEL_SELECTION_EVALS_JSON_BYTES);
}
