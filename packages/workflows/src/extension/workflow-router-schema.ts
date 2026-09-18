import { type Static, Type } from "typebox";
import { WorkflowBudgetSchema } from "./workflow-budget-schema.js";

/** Caller-owned task context. Registry identities and inherited budgets are supplied by the runtime. */
export const WorkflowRouterStateSchema = Type.Object(
	{
		literalRequest: Type.String({
			minLength: 1,
			description: "Literal authorized user request, with secrets removed.",
		}),
		intent: Type.String({
			minLength: 1,
			description:
				"Faithful task intent, including uncertainty. Do not invent an objective or advocate an assistant-selected workflow.",
		}),
		conversation: Type.Array(
			Type.Object(
				{ role: Type.String({ minLength: 1 }), text: Type.String({ minLength: 1 }) },
				{ additionalProperties: false },
			),
			{
				description:
					"Relevant conversation text with actual roles, not session paths. Preserve explicit named-workflow or inline preferences as user provenance.",
			},
		),
		constraints: Type.Array(Type.String({ minLength: 1 })),
		executionPreference: Type.Union([Type.Literal("inline"), Type.Literal("workflow"), Type.Literal("unspecified")]),
		documents: Type.Array(
			Type.Object(
				{ source: Type.String({ minLength: 1 }), content: Type.String({ minLength: 1 }) },
				{ additionalProperties: false },
			),
			{
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
