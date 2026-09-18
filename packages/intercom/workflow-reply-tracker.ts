import type { ExtensionContext } from "@bastani/atomic";
import { ReplyTracker } from "./reply-tracker.js";

const WORKFLOW_REPLY_TRACKER_STATE = "intercom.reply-tracker";

/** Reuses one reply-correlation ledger across workflow model-fallback sessions. */
export function bindWorkflowReplyTracker(ctx: ExtensionContext, current: ReplyTracker): ReplyTracker {
  // Children inherit stage routing context, not the stage conversation's ledger.
  if (ctx.subagentPolicy?.executionEnded) return current;
  const state = ctx.orchestrationContext?.messageAdmission?.extensionState;
  if (!state) return current;
  const shared = state.get(WORKFLOW_REPLY_TRACKER_STATE);
  if (shared instanceof ReplyTracker) return shared;
  state.set(WORKFLOW_REPLY_TRACKER_STATE, current);
  return current;
}

/** A retiring fallback session must not clear the still-open generation ledger. */
export function preserveWorkflowReplyTracker(ctx: ExtensionContext | null): boolean {
  if (ctx?.subagentPolicy?.executionEnded) return false;
  return ctx?.orchestrationContext?.messageAdmission?.isOpen() === true;
}
