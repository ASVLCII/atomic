/** Internal marker for invalid provider output, never transport/auth/input failures. */
export class InvalidDecisionOutputError extends Error {
	usage?: { inputTokens: number; outputTokens: number };
}
