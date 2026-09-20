import type { WorkflowInputValues, WorkflowOutputValues, WorkflowRunContext } from "../src/shared/types.js";
import { withSteeringPropagationContext } from "./steering-context.js";

/** Builtin-only defaults; custom workflows keep their existing model inheritance. */
export function withBuiltinContext<
	TInputs extends WorkflowInputValues,
	TOutputs extends WorkflowOutputValues,
>(ctx: WorkflowRunContext<TInputs, TOutputs>): WorkflowRunContext<TInputs, TOutputs> {
	const wrapped = withSteeringPropagationContext(ctx);
	const task = wrapped.task;
	const chain = wrapped.chain;
	const parallel = wrapped.parallel;
	wrapped.task = (name, options) => task(name, { ...options, model: options.model ?? "auto" });
	wrapped.chain = (steps, options) => chain(
		steps.map((step) => ({ ...step, model: step.model ?? options?.model ?? "auto" })), options,
	);
	wrapped.parallel = (steps, options) => parallel(
		steps.map((step) => ({ ...step, model: step.model ?? options?.model ?? "auto" })), options,
	);
	return wrapped;
}
