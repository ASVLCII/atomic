export interface JevFixtureRequest {
	state: Record<string, unknown>;
	questions: Record<string, { instructions: string; criteria: Record<string, string> }>;
}

export function jevFixtureResponse(
	request: JevFixtureRequest,
	select: (keys: string[], id: string) => string = (keys) => keys[0]!,
) {
	return {
		model: "jev-fixture",
		usage: { input_tokens: 20, output_tokens: 10 },
		answers: Object.fromEntries(
			Object.entries(request.questions).map(([id, question]) => {
				const keys = Object.keys(question.criteria);
				const choice = select(keys, id);
				return [
					id,
					{
						type: "choice",
						choice,
						confidence: 1,
						probabilities: Object.fromEntries(keys.map((key) => [key, key === choice ? 1 : 0])),
					},
				];
			}),
		),
	};
}
