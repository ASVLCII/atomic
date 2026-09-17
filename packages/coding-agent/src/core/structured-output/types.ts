import type { Api, Model } from "@bastani/pi-ai";
import type { Static, TSchema } from "typebox";
import type { ModelRegistry } from "../model-registry.js";
import type { SettingsManager } from "../settings-manager.js";
import type { JsonObject } from "../tools/structured-output.js";

/** A semantic judgment, not an execution instruction. IDs are only correlation keys. */
export interface StructuredChoiceQuestion {
	readonly instructions: string;
	readonly criteria: Readonly<Record<string, string>>;
}

export interface StructuredOutputSelectionOptions {
	readonly settings: Pick<SettingsManager, "getStructuredOutputModel">;
	readonly modelRegistry: Pick<ModelRegistry, "getAll" | "streamSimple">;
	/** Read the active chat model at invocation time; never change it to perform a decision. */
	readonly currentModel?: Model<Api>;
}

export type StructuredOutputModel =
	| { readonly kind: "chat"; readonly fullId: string; readonly model: Model<Api> }
	| { readonly kind: "jev"; readonly fullId: "typesafe-ai/jev" };

export interface StructuredOutputRequest<T extends TSchema> extends StructuredOutputSelectionOptions {
	/** Supply actual task, facts, constraints and reference text. Never supply credentials. */
	readonly state: JsonObject;
	readonly instructions: string;
	/** The normalized result contract. Use additionalProperties: false on closed objects. */
	readonly schema: T;
	readonly jev: {
		/** All judgments run together. Conditional questions must describe their speculative premise. */
		readonly questions: Readonly<Record<string, StructuredChoiceQuestion>>;
		/** Pure exact lookup/composition only. No inference, execution or authorization here. */
		readonly decode: (choices: Readonly<Record<string, string>>) => Static<T>;
	};
	readonly signal?: AbortSignal;
	/** Positive integer milliseconds, default 30 seconds. Covers auth, transport and body reading. */
	readonly timeoutMs?: number;
	/** Ordinary-provider output bound, default 4096 tokens. */
	readonly maxTokens?: number;
}

export interface StructuredOutputResult<T> {
	readonly value: T;
	readonly model: string;
	readonly responseModel: string;
	readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}
