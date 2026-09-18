import { type CreateAgentSessionOptions, routeExecutionModel } from "@bastani/atomic";
import type { WorkflowModelCatalogPort, WorkflowModelInfo } from "../shared/types.js";
import type { PiModelContext } from "./public-types.js";

export function workflowModelCatalogFromContext(
	ctx?: PiModelContext & { getRouterModel?: () => string },
): WorkflowModelCatalogPort | undefined {
	if (ctx?.modelRegistry === undefined && ctx?.model === undefined) return undefined;
	return {
		routeModel: async (input) => {
			const registry = ctx.modelRegistry;
			if (
				!ctx.getRouterModel ||
				!registry?.getAll ||
				!registry.streamSimple ||
				!registry.containsConfiguredCredential
			) {
				throw new Error("Workflow stage auto routing requires host routing and credential screening support.");
			}
			return routeExecutionModel({
				ctx: {
					model: ctx.model,
					getRouterModel: () => ctx.getRouterModel!(),
					modelRegistry: {
						getAvailable: () => registry.getAvailable(),
						getAll: () => registry.getAll!(),
						streamSimple: (...args) => registry.streamSimple!(...args),
						containsConfiguredCredential: (text) => registry.containsConfiguredCredential!(text),
						...(registry.getProviderAuth ? { getProviderAuth: registry.getProviderAuth.bind(registry) } : {}),
						...(registry.getProviderAuthStatus
							? { getProviderAuthStatus: registry.getProviderAuthStatus.bind(registry) }
							: {}),
					},
				},
				task: input.task,
				agent: { name: input.stageName, description: "Workflow stage", instructions: input.instructions ?? "" },
				constraints: input.constraints,
				signal: input.signal,
				selection: input.selection,
			});
		},
		listModels: async (): Promise<readonly WorkflowModelInfo[]> => {
			const available = ctx.modelRegistry?.getAvailable() ?? (ctx.model === undefined ? [] : [ctx.model]);
			return available.map((model) => ({
				provider: String(model.provider),
				id: model.id,
				fullId: `${String(model.provider)}/${model.id}`,
				model: model as NonNullable<CreateAgentSessionOptions["model"]>,
			}));
		},
		...(ctx.model !== undefined
			? {
					currentModel: ctx.model as NonNullable<CreateAgentSessionOptions["model"]>,
					preferredProvider: String(ctx.model.provider),
				}
			: {}),
	};
}
