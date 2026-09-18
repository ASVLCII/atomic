import { Type } from "typebox";

/** Run-budget declaration accepted by config, authored workflows, and tool runs. */
export const WorkflowBudgetSchema = Type.Object(
	{
		maxDurationMs: Type.Optional(
			Type.Integer({ minimum: 0, description: "Maximum run duration in milliseconds; 0 disables it." }),
		),
		maxTokens: Type.Optional(Type.Integer({ minimum: 0, description: "Maximum charged tokens; 0 disables it." })),
		maxCost: Type.Optional(Type.Number({ minimum: 0, description: "Maximum cost in USD; 0 disables it." })),
		warnAtPercent: Type.Optional(
			Type.Number({ minimum: 0, description: "Usage percentage at which to warn; 0 disables it." }),
		),
	},
	{ additionalProperties: false, description: "Optional workflow run budget." },
);
