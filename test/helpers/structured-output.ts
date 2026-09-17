import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions } from "@bastani/pi-ai";
import { createAssistantMessageEventStream } from "@bastani/pi-ai";
import { Type } from "typebox";
import { AuthStorage } from "../../packages/coding-agent/src/core/auth-storage.js";
import { ModelRegistry } from "../../packages/coding-agent/src/core/model-registry.js";
import { ModelRuntime } from "../../packages/coding-agent/src/core/model-runtime.js";
import { SettingsManager } from "../../packages/coding-agent/src/core/settings-manager.js";
import type { StructuredOutputRequest } from "../../packages/coding-agent/src/core/structured-output/index.js";

export const decisionModel: Model<Api> = {
	provider: "decision-test",
	id: "chat",
	name: "Test chat",
	api: "openai-completions",
	baseUrl: "https://example.invalid",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 32000,
	maxTokens: 4096,
};
export const decisionSchema = Type.Object(
	{
		route: Type.Union([Type.Literal("none"), Type.Literal("review")]),
		limit: Type.Optional(Type.Number({ minimum: 0 })),
	},
	{ additionalProperties: false },
);
export function decisionRequest(): StructuredOutputRequest<typeof decisionSchema> {
	return {
		settings: SettingsManager.inMemory({ structuredOutputModel: "decision-test/chat" }),
		modelRegistry: {
			getAll: () => [decisionModel],
			streamSimple: () => {
				throw new Error("Unexpected chat inference");
			},
		},
		currentModel: decisionModel,
		state: {
			task: "Review the patch",
			conversation: [{ role: "user", text: "Review only; do not execute." }],
			constraints: { authorization: "decision only", maxCost: 1.23456789 },
			docs: { source: "reference.md", text: "Review compares the patch to requirements." },
			candidates: [
				{ name: "none", description: "No match" },
				{ name: "review", description: "Review without implementing" },
			],
		},
		instructions: "Select a matching route or none. Preserve the exact cost limit if selecting review.",
		schema: decisionSchema,
		jev: {
			questions: {
				route: {
					instructions: "Which route matches the actual task? Choose none when no route fits.",
					criteria: { none: "No route fits", review: "Review the patch without implementing" },
				},
				budget: {
					instructions:
						"Assuming review is selected, choose the exact applicable cost limit or inherit existing limits.",
					criteria: { inherit: "Inherit configured limit", exact: "Preserve explicit cost limit of 1.23456789" },
				},
			},
			decode: (choices) => ({
				route: choices.route as "none" | "review",
				...(choices.budget === "exact" ? { limit: 1.23456789 } : {}),
			}),
		},
	};
}
export function decisionMessage(
	args: Record<string, unknown> = { route: "review", limit: 1.23456789 },
): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id: "result", name: "structured_output", arguments: args }],
		api: decisionModel.api,
		provider: decisionModel.provider,
		model: decisionModel.id,
		stopReason: "toolUse",
		timestamp: Date.now(),
		usage: {
			input: 20,
			output: 10,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 30,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
	};
}
export function messageStream(message: AssistantMessage) {
	const stream = createAssistantMessageEventStream();
	stream.push(
		message.stopReason === "error" || message.stopReason === "aborted"
			? { type: "error", reason: message.stopReason, error: message }
			: { type: "done", reason: message.stopReason as "toolUse" | "stop" | "length", message },
	);
	return stream;
}
export function jevResponse() {
	return {
		model: "jev-2026-09",
		answers: {
			route: { type: "choice", choice: "review", probabilities: { none: 0.49, review: 0.51 }, confidence: 0.001 },
			budget: { type: "choice", choice: "exact", probabilities: { inherit: 0, exact: 1 }, confidence: 1 },
		},
		usage: { input_tokens: 20, output_tokens: 10 },
	};
}
export async function registeredDecisionRuntime(
	streamSimple: (
		model: Model<Api>,
		context: Context,
		options?: SimpleStreamOptions,
	) => ReturnType<typeof createAssistantMessageEventStream>,
) {
	const runtime = await ModelRuntime.create({
		modelsPath: null,
		credentials: AuthStorage.inMemory(),
		refreshOnCreate: false,
	});
	runtime.registerProvider(decisionModel.provider, {
		api: decisionModel.api,
		baseUrl: decisionModel.baseUrl,
		apiKey: "mock-chat-secret",
		models: [decisionModel],
		streamSimple,
	});
	return { runtime, registry: new ModelRegistry(runtime) };
}
