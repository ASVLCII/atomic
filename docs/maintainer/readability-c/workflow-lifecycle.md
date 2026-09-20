# Workflow lifecycle maintenance

Relocated from `packages/coding-agent/docs/workflows/api-reference.md`, `authoring.md`, and `operations.md`. Topics: heartbeat scheduling, notice recovery, stage traffic, exit arbitration, output capture, graph projections, and extension reload. Public signatures, runnable examples, lifecycle outcomes, and operator controls remain in their guides.

## Heartbeat scheduling

Consumption releases only the typed `workflows:workflow-heartbeat` identity `runId + scheduledAt`; copying text into another message cannot release its slot. A session-wide queue serializes sends, with a two-minute sending watchdog. An unanswered send is abandoned, its slot released, and its next future boundary rearmed. Late settlement cannot restart retries or affect another send. Outright failures retain backoff; admitted-card consumption has no deadline. See [#2557](https://github.com/bastani-inc/atomic/issues/2557).

Durable resume records a new start time, so an early reserved durable anchor preserves the prior cadence. Scheduling uses the earlier anchor/current start and the launch interval stored in that anchor. Disabled-heartbeat launches write no anchor and may adopt the current definition cadence in a new process. Order is `scheduledAt`, then run ID, and retries retain position. Submillisecond intervals use the finest representable instant. Above roughly 3 × 10^303 minutes, timestamp overflow prevents the first boundary and anchor; `ATOMIC_WORKFLOW_DEBUG=1` reports it.

Check terminal state before queueing, processing, and every retry. One idempotent terminal cleanup removes wake-up, boundary, outstanding slot, queued heartbeat, retry timer, cadence, and anchor memos. Startup/store invalidation removes stale state without replaying or rewriting terminal anchors. Active recovery selects the next future boundary. See [#1975](https://github.com/bastani-inc/atomic/issues/1975).

Recoverable provider blocks remain stored running and retain cadence and admitted cards. Before model consumption, an admitted heartbeat must still match a current nonterminal run's pending identity. Ended, unknown, or superseded boundaries are excluded from model context, while the visible card remains historical.

## Lifecycle notice persistence and reconciliation

The former streaming `persistWhenStreaming` path appended only a display card, without queueing native steer/follow-up or another model step. An earlier provider snapshot could finish with a stale running claim.

The replacement separates one visible `display: true`, `excludeFromContext: true` lifecycle entry from hidden `display: false` reconciliation text at the native steer boundary. The card's durable append atomically carries the recovery marker before send admission resolves. This preserves assistant tool call → running tool result → lifecycle reconciliation ordering. Final-text streaming finishes without lifecycle-induced abort; the hidden update supplies a later correction.

Idle delivery appends the card then starts a native prompt. Busy delivery queues hidden steering. A pending workflow tool result waits for preceding writes before the card and lets reconciliation follow that result. Each occurrence preserves raw notice text, custom type, details including absent optional fields, and exactly one visible persisted card.

Persist the hidden completion only after core consumes it. Startup requeues unresolved markers once; repeated binding skips queued intent and completed markers suppress future restores. Register protection before public listeners run. Replacement/shutdown fail closed while hidden input waits behind a tool result; host invalidation must not run after failed teardown. Persistence retries must not requeue model input or duplicate cards. Partial JSONL append failure restores the prior file length. Flush consumed recovery state again before disposal; failure keeps the session recoverable.

`clearQueue()` restores only references actually removed, not references already in core-local flight. Stage transfer moves protection with transferred queued references, leaving in-flight ownership at its source. Rejecting card append retains the original payload for capped-backoff retry while the invoking chat remains active, even if the run/config changes. Replacement cancels those attempts rather than waking unrelated chat. Awaiting-input states participate in restore/dedupe without main-chat wakeup.

## Stage admission and retained sessions

Queue projections use complete `queue_update` snapshots, replacing rather than appending lists. Read optional getters once on attachment to recover pre-listener queues transferred during fallback or post-mortem reopen.

For busy-stage Intercom, reserve generation admission synchronously before the exact foreground owner's asynchronous probe/commit detach handshake. Delivery and cancellation wait inside that reservation. Claimed parallel detach releases aggregate supervision without surrendering execution/eventual-result ownership. The reservation prevents close from overtaking delivery and prevents a blocking child request from waiting behind aggregate supervision.

Close drains admitted traffic, including after schema capture, then cancels remaining stage-owned children. It does not wait for arbitrary producers. Late ordinary non-child traffic retains the single main-chat route. A completed-stage blocking ask may instead claim one serialized retained-session post-mortem turn. Later listeners preserve that claim regardless of extension registration order. Failed admission returns a correlated error.

Host replacement invalidates pending lazy reopen handles; a late-created session is disposed before its submitted prompt executes. Internal workflow/subagent session headers require exact `internal: true` and complete ownership metadata. Fork creation installs that header immediately; malformed legacy markers and ordinary forks remain in ordinary history.

## Exit and output arbitration

`ctx.exit` snapshots outputs synchronously before `finally`/cleanup mutation. Preserve invalid values and undeclared keys for later validation. Throwing option accessors or snapshot enumeration select exit, attempt cleanup, and produce non-resumable authoring failure unless external control wins.

Exit is a level-triggered gate across task, chain, parallel, stage, workflow, graph prompts, and retained stage operations. Stop dequeuing even with `failFast: false`; active nodes become skipped for `workflow-exit`. Replayed stages, completions, prompts, and child boundaries recheck after their replay microtask before publishing completion. An unfinished-tool frontier must be consumed before successful completion, even if author code catches the exit signal. New worktree preparation waits for live admission.

The store arbitrates terminal writes. External destructive cancellation during exit cleanup can win `recordRunEnd`; SDK results, callbacks, store, and persistence then all report canonical `killed`, without a second terminal record. Control-signal probing treats inaccessible/throwing marker, aggregate `errors`, `cause`, `reason`, or `scope` accessors as no signal for that branch rather than escaping failure finalization.

Parent exit passes a typed parent-exit reason to the child executor. The child owns cleanup, writes each skipped stage once before its cancelled non-resumable run end, and the parent waits before its own run end. Clear skipped boundary child links before publication so restore does not resurrect child topology.

Output capture lives outside compactable session context. Failed-attempt provisional answers are discarded on fallback but earlier successful answers remain. Branch navigation restores context without importing historical answers. Generation close drains admitted work before stopping capture. Schema artifacts bind ordinary text and structured arguments to the exact successful tool-call ID, not merely its name. Empty text falls back to the earlier assistant message without a structured call. The old nonempty-artifact regex classifier produced false alarms and was removed; receipts now report facts, not deliverable quality.

## Store projection and reload

`graphSnapshot()` returns a deeply frozen, bounded projection with stable identity per store version. Graph-visible changes must bump the version. `subscribeInvalidation()` is synchronous without full projection; legacy `subscribe(snapshot)` clones the full snapshot. `statusFile: true` still traverses that payload; default false avoids it. Authored stage results are omitted. Failed author-exit output may retain a bounded JSON object; oversize data falls back to bounded strings without synthetic keys.

Workflow reload builds a complete replacement registry, serializes/coalesces requests, and rejects stale discovery. Fatal refresh keeps the prior registry. Top-level `/reload` adopts the session's store and control owners before remounting UI. If an older generation displaced a live store into an auxiliary scope, reclaim stage/job/cancellation/tool/prompt owners and merge retained terminal history. New sessions never inherit unrelated scopes.

Separate installed jiti module copies canonicalize `pi.events` through a process-shared session-bus map. Live callbacks retain their old module graph and may settle after reload. Captured transcript persistence is advisory only for stale-extension-context errors; other errors fail the run. Hydration invalidation mounts or updates the panel even when a node arrives after UI installation. These are same-process guarantees, not crash recovery.

Session creation shares one gate for `ctx.__ensureSession()`, eager attachment, and the first prompt. Retryable creation faults use the candidate retry policy; unrepairable faults advance the chain. Exhausted creation is not cached. Pause objectives survive creation and continuation without counting as provider failures.

Adapter admission retains logical idle-turn ownership after serialized admission releases, so asynchronous `isStreaming` publication does not start a second prompt. Correlated generations prevent old end/settlement from clearing newer ownership. Synchronous streaming is also detected; bundled sessions retain their internal handshake. Public adapters still owe timely start/end events and stable IDs for delayed replay ends.

Lifecycle dedupe uses run ID and occurrence timestamp. Restore/replay/reload seeds existing started, paused, and quit states as delivered. Resume never emits a new start; quit suppresses its intermediate pause notice.
