import type { RouterModelSelectionOptions, StructuredOutputModel } from "./types.js";

/** Decision-only registration: deliberately not a pi-ai chat Provider or Model. */
export const JEV_STRUCTURED_OUTPUT_PROVIDER = Object.freeze({
	id: "typesafe-ai",
	name: "TypeSafe",
	model: "jev-latest",
	fullId: "typesafe-ai/jev-latest",
	wireModel: "jev-latest",
	endpoint: "https://api.typesafe.ai/v1/systemone",
	apiKeyEnv: "TYPESAFE_API_KEY",
	capabilities: Object.freeze({
		structuredDecisions: true,
		choice: true,
		maxChoiceOptions: 255,
		chat: false,
		toolCalling: false,
		jsonSchemaGeneration: false,
	}),
} as const);

const OPENROUTER_JEV_STRUCTURED_OUTPUT_PROVIDER = Object.freeze({
	...JEV_STRUCTURED_OUTPUT_PROVIDER,
	id: "openrouter",
	name: "OpenRouter",
	model: "~typesafe/jev-latest",
	fullId: "openrouter/~typesafe/jev-latest",
	wireModel: "~typesafe/jev-latest",
	endpoint: "https://openrouter.ai/api/alpha/decisions",
	apiKeyEnv: "OPENROUTER_API_KEY",
} as const);

/** Dedicated provider catalog; these registrations must not enter the chat model picker. */
export function getStructuredOutputProviders(): readonly (
	| typeof JEV_STRUCTURED_OUTPUT_PROVIDER
	| typeof OPENROUTER_JEV_STRUCTURED_OUTPUT_PROVIDER
)[] {
	return [JEV_STRUCTURED_OUTPUT_PROVIDER, OPENROUTER_JEV_STRUCTURED_OUTPUT_PROVIDER];
}

export function resolveRouterModel(options: RouterModelSelectionOptions): StructuredOutputModel {
	const explicit = options.settings.getRouterModel();
	if (typeof explicit !== "string" || explicit.trim() !== explicit || explicit === "auto") {
		throw new Error("Invalid routerModel: use an exact provider/model ID or an empty string, not auto.");
	}
	const provider = getStructuredOutputProviders().find((candidate) => candidate.fullId === explicit);
	if (provider) return { kind: "jev", fullId: provider.fullId };
	if (
		!explicit &&
		(options.modelRegistry.getProviderAuthStatus?.(JEV_STRUCTURED_OUTPUT_PROVIDER.id).configured ||
			Boolean(process.env.TYPESAFE_API_KEY?.trim()))
	) {
		return { kind: "jev", fullId: JEV_STRUCTURED_OUTPUT_PROVIDER.fullId };
	}
	const model = explicit
		? options.modelRegistry.getAll().find((candidate) => `${candidate.provider}/${candidate.id}` === explicit)
		: options.currentModel;
	if (!model || model.id === "auto" || model.provider === "typesafe-ai") {
		throw new Error(
			explicit
				? "Invalid routerModel: the exact model is not in the current chat catalog. Check settings.json."
				: "Router inference needs a selected chat model, configured Jev credentials, or an explicit routerModel.",
		);
	}
	return { kind: "chat", fullId: `${model.provider}/${model.id}`, model };
}
