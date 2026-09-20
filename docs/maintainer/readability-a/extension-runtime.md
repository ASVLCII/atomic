# Extension runtime and terminal isolation

Relocated from `packages/coding-agent/docs/extensions.md` (startup and callback isolation), `extensions/authoring.md` (loader mechanics), `extensions/events.md` (prompt delivery and workflow projection), and `extensions/ui.md` (overlay composition). Public APIs and examples remain in their source guides.

## Lazy initialization and reload

Lightweight command/tool wrappers register before expensive server connections, workflow module evaluation, result watchers, cleanup scans, and browser/provider loading. Workflow restore reads lightweight config during `session_start` without evaluating modules. Readiness-critical operations wait for discovery; paused live resume and pickers bypass full workflow discovery.

Web-access and Intercom share first-use initialization plus latest lifecycle replay. Failed attempts remain retryable. Session leases retire candidates synchronously on shutdown, reject calls spanning teardown, and require fresh initialization after restart. Shutdown awaits retired initializer/replay cleanup. Intercom serializes replay with live lifecycle forwarding so stale replay cannot overtake matching ends or newer model selections.

One web caller's abort does not cancel shared initialization. Host abort after provider/curator work preserves its exact reason; explicit curator cancellation remains result-shaped. Nonempty batches with no successes become tool errors with stage diagnostics; partial success retains completed items.

MCP startup, proxy/direct calls, and readiness-critical commands share a generation-scoped initializer and exact session lease. Background failure is retryable and single-flight. Stale contexts cannot reuse initialized state; commands retain initialized state across lazy imports. Operations revalidate ownership after lifecycle-spanning waits and before metadata/SDK effects. Caller cancellation races readiness, connection, manager-close, and UI-start waits with the exact reason, closes late-produced UI, and does not cancel shared producers. Restart/shutdown retires OAuth ownership immediately; bounded observed cleanup prevents non-abortable SDK work blocking replacement while fencing late completion. SDK calls receive the signal, though remote protocol cancellation is advisory. MCP Apps preserves terminal cancellation ordering and mutually exclusive success events. Per-server `timeoutMs` composes with host abort as an inactivity limit, reset by progress; omission keeps the SDK default.

Editable extensions/workflows use jiti with content-hash invalidation across the import graph. Unchanged graphs may reuse evaluated factories; direct or transitive edits re-evaluate modules. Host core classes/state remain shared, including the `@earendil-works/pi-coding-agent` compatibility alias. In Bun single-file builds, only exact installed entries of identity-verified Atomic builtin packages use the native precompiled path. The live host-module bridge is installed before one-time imports of workflows, subagents, MCP, web access, and Intercom. Reusing factories avoids source reads, transforms, hashing, and graph manifests. Their module state is not re-evaluated by `/reload`.

## Engine watchdog and recovery

Interactive extensions, hooks, tools, workflows, and extension render components run in the supervised engine child. The terminal host owns stdin and cached rendering. Heartbeats run every 50 ms; a 250 ms gap identifies the active callback and one second marks unresponsiveness. Escape cooperatively aborts with no deadline and never replaces the child.

Physical Escape/Ctrl+C matching is independent of `app.clear`; release events do not act. Ctrl+C closes undeclared remote custom UI on first press. Declared `handlesCtrlC` receives one press, then a repeat closes that still-mounted component. Unresponsive-engine recovery takes precedence: watchdog failure, abort/readiness older than one second, or failed replacement permits termination/replacement. A fresh replacement is protected from stray repeats; a failed replacement keeps recovery armed without automatic retry.

On generation death, remote mounts close newest-first and their promises settle. Dialogs cancel without answering the replacement. Widgets release only keys not taken by newer generations, terminal modes reset, inline depth returns to zero, and editor focus returns unless a native modal survives. Buffered frames are discarded. Death after ready but before attachment also recovers. The host makes one automatic replacement attempt and includes exit code/signal in a bounded cause summary, never child stderr. Death during replacement does not cause an automatic retry loop.

Unaccepted drafts restore exact whitespace and expanded paste content, before text typed meanwhile with a blank-line separator. Queued drafts return in order and retain per-submission identity. No redundant red transport error accompanies a restored draft.

Ownership is announced and flushed before any request effect, including hooks, queue changes, compaction, and shells. No announcement on transport failure means work never started; after announcement it may have effects. Output is not an admission boundary: `!touch marker && sleep 400` changes files silently. Classification covers `EPIPE`, `ERR_STREAM_DESTROYED`, `ERR_STREAM_WRITE_AFTER_END`, explicit stop, and missing child. Original error identity, `code`, `errno`, and `syscall` survive through non-enumerable markers. Post-write timeout, RPC response errors, provider/model errors, and anything after `agent_start` never restore drafts.

The ownership announcement requires interactive-engine protocol version `2`; mismatched host/child versions refuse binding. After death the host briefly drains ownership frames only, classifies each request once with its terminal error, then replaces the engine. A bounded settling window prevents descendants holding stdout open from blocking recovery. Disposal stops the child, cancels and awaits replacement, and prevents host initialization outliving the session.

Inactive-session reconstruction derives unavailable-result errors for persisted tool calls lacking results. It does not append repairs to JSONL and never claims effects were undone.

## Bootstrap confidentiality

Engine-only role, host PID, guardian path, and `--api-key` values travel through an owner-only bootstrap file named in a private CLI argument, not environment variables. The child reads once, freezes values, and unlinks only that file. Recursive directory cleanup belongs to the creating host. Bun can inherit launch-time environment even after `process.env` deletion, so omission at launch prevents leaks through `Bun.spawn`, `Bun.spawnSync`, and `node:child_process`.

## Prompt notification delivery

Trust startup binds permitted user/global, builtin, and authorized CLI extensions to a real session before asking. Approval completes the same session without rerunning safe factories or `session_start`; newly authorized code gets no historical prompt events. Resume uses outgoing context; validation and switch cancellation precede trust preparation, and project resources load after shutdown only when replacement continues.

Host `/trust` start/end notifications are retained in order until engine binding, even if the selector closes first. Separate completed dialogs stay separate; retirement discards pending notifications. Nested/overlapping prompts share one outer span whose initial reason/kind/title survives until all participants settle. Rebinding ends the old span first. Replacement does not replay notifications for an exited engine.

Notification handlers run best-effort in microtasks without delaying display or answers. Start/end dispatch independently and invoke observers in order without awaiting peers. Each observer's own async start/end may overlap. Replacement waits at most 1,000 ms for a snapshot of pending deliveries, then warns and proceeds; observer context may expire.

## Workflow activity projection

The internal pure projector combines stored snapshots with runtime ownership of stages/tools, retries, stopping runs, and acknowledged failures. Nested runs fold into root summaries. Historical `running` alone never counts as execution. Runnable handoffs stay working; prompts contribute attention. Independent execution plus attention remains `working` with `needsAttention: true`. Without progress, waits/unresolved failures are blocked; paused roots are idle/paused and completed or intentionally stopped roots idle/quiescent.

Live executor ownership yields `automatic_continuation` between settled nodes and the next author-code admission only when stages are completed/skipped, tools completed, and no prompt/block/stop remains. It adds no execution count. Historical, paused, and parked snapshots do not qualify.

Child stop suppresses only its subtree's handoffs. A paused stage keeps the root idle/paused after independent execution ends; its retained prompt requests no attention until resume. Stopping ownership follows `parentRunId` then root identity even if ancestor snapshots are missing. `stopping` applies only when all execution drains under stop with no unaffected retry/handoff. Independent work keeps its normal reason. History removal does not release execution/stop ownership, and projection never changes stored outcomes.

`workflowActivityNodeKey(runId, nodeId)` forms `${runId}:${nodeId}` for `executingStageIds`, `executingToolNodeIds`, and `retryingStageIds`. Split at the first colon; node IDs may contain colons. Bare IDs cannot distinguish identical tool hashes across runs. `stoppingRunIds` and `acknowledgedFailureRunIds` use run IDs. Neither projector nor helper is a supported SDK export; consumers use `ctx.observeWorkflowActivity`.

## Overlay composition

`reserveTranscriptRows` bounds bottom overlays to retain at least six transcript rows. `row` and nonzero `offsetY` violate the intersection model. Margins constrain the wrapper before pi-tui composition; numeric/percentage `maxHeight` resolves before active-row windowing and is removed before passing options to pi-tui, preventing double fixed-head cropping.

Each frame computes visible overlays' real transcript intersection and reserves the connected covered suffix once. Mount/resize height changes request one settling repaint. Hidden overlays contribute nothing; removal releases the exact registration, retaining shared reserve until the last overlay leaves. Reserving overlays release vertical wheel and fullscreen transcript actions even during nested input focus.

`OVERLAY_ACTIVE_ROW_MARKER` is a zero-width APC sequence terminated by ST under ECMA-48. `visibleWidth` treats it as zero. The final composited-screen transform strips it everywhere, including overlays, inline mounts, widgets, and workflow chats. The first marked line anchors cropping, even at max height one; mid-line markers work. Focused pi-tui cursor markers also anchor cropping. The questionnaire marks options, Next, Submit, Cancel, and inline sentinels.

The default one-cell `∀` indicator cycles dark/accent/bright-bold/accent/dark every 88 ms. Missing theme tones derive from selected-surface, accent, and text. `NO_COLOR` retains regular/bold activity; reduced motion uses a static regular accent glyph without a timer.
