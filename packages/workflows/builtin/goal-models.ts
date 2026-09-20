import { reviewDecisionSchema } from "./goal-schemas.js";

export const orchestratorModelConfig = {
    model: "auto",
    excludedTools: ["ask_user_question"],
};

export const reviewerModelConfig = {
    model: "auto",
    excludedTools: ["ask_user_question"],
    schema: reviewDecisionSchema,
};
