import { jsonBytes, truncateToBytes } from "./model-routing-task.js";

/** Bounds the evaluation evidence sent with one routing request. */
export const MODEL_SELECTION_EVALS_JSON_BYTES = 14_200;

const BEDROCK_PREFIX =
	/^(?:(?:global|us|us-gov|eu|au|jp|apac|ca)\.)?(?:anthropic|amazon|meta|mistral|cohere|ai21|deepseek|openai|qwen|writer|moonshotai|zai)\./u;
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
		.replace(BEDROCK_PREFIX, "")
		.replace(/:[a-z0-9]+$/u, "")
		.replace(/-v\d+$/u, "")
		.replace(/-\d{8}$/u, "");
	return canonicalClaudeOrder(model.split(/[-._]/u).filter(Boolean));
}

/** True when `slug` is the candidate model or one of its effort/reasoning variants. */
function slugMatchesCandidate(slug: readonly string[], candidate: readonly string[]): boolean {
	if (slug.length < candidate.length || candidate.some((token, index) => slug[index] !== token)) return false;
	return slug.slice(candidate.length).every((token) => VARIANT_TOKENS.has(token));
}

/**
 * Keep the catalog preamble and only the table rows that describe an eligible
 * candidate model, bounded to the routing evidence budget.
 */
export function filterModelSelectionEvals(evals: string, candidates: readonly string[]): string {
	const wanted = [...new Set(candidates)].map(modelEvidenceTokens);
	const lines = evals.split("\n");
	const headerIndex = lines.findIndex((line) => /^\|\s*slug\s*\|/u.test(line));
	if (headerIndex < 0) return truncateToBytes(evals, MODEL_SELECTION_EVALS_JSON_BYTES);
	const rows = lines.slice(headerIndex + 2).filter((line) => {
		const slug = line.startsWith("|") ? line.split("|")[1]?.trim() : undefined;
		if (!slug) return false;
		const tokens = modelEvidenceTokens(slug);
		return wanted.some((candidate) => slugMatchesCandidate(tokens, candidate));
	});
	const filtered = [...lines.slice(0, headerIndex + 2), ...rows].join("\n");
	return jsonBytes(filtered) <= MODEL_SELECTION_EVALS_JSON_BYTES
		? filtered
		: truncateToBytes(filtered, MODEL_SELECTION_EVALS_JSON_BYTES);
}
