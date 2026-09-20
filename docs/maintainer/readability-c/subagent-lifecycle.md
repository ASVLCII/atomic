# Subagent admission and delivery maintenance

Relocated from `packages/coding-agent/docs/subagents.md` and `subagents/reference.md`: task observation, single-child handoff, foreground control, group policy, child boundaries, fallback classification, and owner projection. Public tool calls, agent authoring, and host-binding APIs remain in those guides.

## Admission and coordination

Child sessions are live in-process `AgentSession` instances with normal extension lifecycle. With the Intercom bridge active, the parent may connect to issue a child capability; the child connection remains tool-driven. A claimed single-child parent request is intercepted before send/waiter admission and returns ordered attachments and a dynamic `[TASK_CONTEXT]` handoff. Parallel coordination instead retains the same execution and correlated reply waiter.

Typed admission issues the supervisor capability and binds the child registration to its issuing supervisor. Foreground paths use exact child scopes. The lightweight wrapper lazy-loads the authorization provider. Provider failure aborts launch; a host with no provider omits supervisor metadata rather than advertising a broken channel.

The executor refuses child launch/kill before a run starts. The Rust admission door independently refuses depth beyond one. Depth belongs to typed admission state, never process environment. Normal resource discovery may register `subagent` in a child, but registration is not fanout authority. The bundled subagents skill is parent-only and stripped even from fanout-authorized child prompts. Context filtering removes prior orchestration artifacts and control traffic.

## Observation and completion

Intercom yield releases observation, not execution or queued sibling slots. Terminal completion is a separate `task-completion` custom message, with structured receipt details. Failed delivery retries the same persisted completion identity. Owner task IDs resolve through the launch/wait owner; legacy run IDs use the live registry and status watch. Unbound callers retain legacy results and artifacts.

Stage closure drains admitted completion messages through the owning `AgentSession` before publishing terminal state. It cancels remaining stage-owned children and suppresses late child findings, not previously submitted broker sends. A transport receipt is not proof of parent-chat display.

Cancellation persists `interrupted` with abort cause while visible receipts say cancelled. It is non-retryable and keeps prior fallback metadata. Partial recovery prefers modified run-scoped progress, then the last assistant text, then artifact references. Thinking-only final messages are skipped; paths are cited only if they exist at receipt construction. Shared parallel progress belongs to the first progress-enabled child, and mixed kill/parent-cancel runs preserve the cancellation summary.

Live transcript views subscribe to session events, preserve earlier-page anchors, and unsubscribe on exit without affecting execution. Model/reasoning completion metadata persists with the notification for history replay.

## Model and owner projection internals

Fallback uses structured provider and attempt causes, not numeric process exits or timeout-regex classification. Quiet providers have no idle watchdog or child wall-clock kill cap.

Native task snapshots retain `wasBackground` after a designated observation yields. Trusted hosts recover authentic command settlement receipts independently of the bounded event journal. Neither path registers another wait or restarts work. Owner views reconcile snapshots/cursors and notify already-mounted chats after lazy producer binding; disposing a view does not cancel its owner.

Bundled agent bodies were reduced to outcome-first role, goal, criteria, constraints, tool routes, output, and stop rules while keeping routing/model frontmatter. This prompt organization is a maintenance convention, not an additional tool permission.

The independent Rust turn limiter caps running turns at four per parent, separate from the configured subagent concurrency and expanded-task cap.
