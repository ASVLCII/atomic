import { INTERACTIVE_WORKFLOW_POLICY, type WorkflowExecutionPolicy } from "../shared/types.js";

export const WORKFLOW_NON_INTERACTIVE_MESSAGE =
	"Headless workflows run without input pickers; required durable human input remains pending until an authorized host or answer arrives.";

const HEADLESS_WORKFLOW_POLICY: WorkflowExecutionPolicy = Object.freeze({
	...INTERACTIVE_WORKFLOW_POLICY,
	allowInputPicker: false,
});

export function workflowPolicyFromContext(ctx?: {
	readonly hasUI?: boolean;
	readonly hasHumanInput?: boolean;
}): WorkflowExecutionPolicy {
	// Presentation availability is not execution permission. Explicit policies
	// supplied to the runtime/dispatcher still enforce their own restrictions.
	return ctx?.hasUI === false ? HEADLESS_WORKFLOW_POLICY : INTERACTIVE_WORKFLOW_POLICY;
}
