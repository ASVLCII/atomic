import {
	type ModelRoute as ExecutionModelRoute,
	type ExtensionContext,
	parseModelConstraints,
	routeExecutionModel,
} from "@bastani/atomic";
import type { AgentConfig } from "../../agents/agents.js";
import type { ModelConstraints } from "../../shared/model-constraints.js";
import { splitKnownThinkingSuffix, toModelInfo } from "../../shared/model-info.js";
import { resolveModelCandidate } from "./model-fallback.js";

export interface ModelRoute extends ExecutionModelRoute {
	allowsCandidate(candidate: string, defaultEffort?: string): boolean;
}

export async function routeSubagentModel(input: {
	ctx: ExtensionContext;
	agent: AgentConfig;
	task?: string;
	modelConstraints?: ModelConstraints;
	signal?: AbortSignal;
}): Promise<ModelRoute> {
	const { ctx, agent } = input;
	const route = await routeExecutionModel({
		ctx,
		task: input.task?.trim() ? input.task : agent.systemPrompt,
		agent: { name: agent.name, description: agent.description },
		constraints: [
			parseModelConstraints(agent.modelConstraints),
			parseModelConstraints(input.modelConstraints),
		].filter((c): c is ModelConstraints => c !== undefined),
		signal: input.signal,
	});
	return {
		...route,
		allowsCandidate: (candidate, defaultEffort) => {
			const normalized = resolveModelCandidate(
				candidate,
				ctx.modelRegistry.getAvailable().map(toModelInfo),
				ctx.model?.provider,
			)!;
			const { baseModel, thinkingSuffix } = splitKnownThinkingSuffix(normalized);
			const model = ctx.modelRegistry.getAvailable().find((m) => `${m.provider}/${m.id}` === baseModel);
			return model !== undefined && route.allowsModel(model, thinkingSuffix.slice(1) || defaultEffort);
		},
	};
}
