import { type Static, Type } from "typebox";
import { WorkflowBudgetSchema } from "./workflow-budget-schema.js";

/** Caller-owned task context. Registry identities and inherited budgets are supplied by the runtime. */
export const WorkflowRouterStateSchema = Type.Object(
	{
		literalRequest: Type.String({
			minLength: 1,
			description: "Literal authorized user request, with secrets removed.",
		}),
		intent: Type.String({ minLength: 1 }),
		conversation: Type.Array(
			Type.Object(
				{ role: Type.String({ minLength: 1 }), text: Type.String({ minLength: 1 }) },
				{ additionalProperties: false },
			),
			{ minItems: 1, description: "Relevant conversation text, not session paths." },
		),
		constraints: Type.Array(Type.String({ minLength: 1 })),
		executionPreference: Type.Union([Type.Literal("inline"), Type.Literal("workflow"), Type.Literal("unspecified")]),
		documents: Type.Array(
			Type.Object(
				{ source: Type.String({ minLength: 1 }), content: Type.String({ minLength: 1 }) },
				{ additionalProperties: false },
			),
			{
				minItems: 1,
				description:
					"Relevant documentation content. Include task-specific operating guidance, not just paths or URLs.",
			},
		),
		userBudget: Type.Optional(
			Type.Object(
				{
					limits: WorkflowBudgetSchema,
					provenance: Type.String({ minLength: 1, description: "Quote the user's exact budget instruction." }),
				},
				{ additionalProperties: false },
			),
		),
	},
	{ additionalProperties: false },
);
export type WorkflowRouterState = Static<typeof WorkflowRouterStateSchema>;
