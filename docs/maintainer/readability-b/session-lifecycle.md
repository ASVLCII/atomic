# Session lifecycle, rollback, and context reconstruction

Relocated from `packages/coding-agent/docs/sdk.md` under “Finishing admitted work”, “Reload failures and resource ownership”, “Session replacement and deferred cleanup”, and “Compaction and tree navigation”; related material came from `sdk/reference.md` under “Extensions”, `rpc/protocol.md` under “compact”, and the session guides. Public lifecycle methods, failure handling, examples, and persisted format contracts remain in their guides.

## Admission and drain coverage

Closing seals new work immediately. Drain coverage includes initial extension binding, `new AgentSession(...)` followed by `bindExtensions()`, prompt/steering/follow-up/compaction hooks, compaction providers, reload preparation, and admitted `pi.refreshWorkflowResources()`. Late callbacks cannot append retired queue items or compaction results, start provider turns, or publish reload candidates.

Asynchronous notifications, event-bus handlers, shortcuts, and workflow activity observers settle before shutdown hooks. This includes notifications emitted by synchronous `setThinkingLevel()` and `setSessionName()` without changing their return types. Tracked `pi.exec()` calls launched during cleanup remain part of shutdown/rollback even if the handler returns first. Captured APIs refuse fresh work while cleanup drains, including failed and omitted factories.

Queued completion events and completed messages still deliver and persist in order during close. Running tools retain results, details, and `tool_result` hooks. Session-summary requests must settle, including superseded requests that ignored cancellation; cancelled summaries cannot persist stale output. Generation cleanup releases remaining subscriptions/publishers, reporting release failures and removing retained callback data.

Ownership belongs to a session, not a borrowed loader, settings manager, event bus, or `SessionManager`. Subclasses and forwarding loaders retain their resource policies and raw prompt text. Sharing persisted identity must not share live task or shell ownership.

## Acquisition rollback

Candidate acquisitions unwind even when discovery fails before a runner exists, when `getExtensions()` itself throws, or when context transforms/resource setup fail before the session constructor completes. Capture cleanup handles at acquisition; never depend on rereading discovery. Preserve the primary cause and append cleanup failures in `ShutdownFailed`.

Strict transactional reload restores surviving-generation admission after rejection. Ordinary reload unwinds candidate resources but does not restore its retired generation. Both leave borrowed discovery alone. Retiring dialog functions close immediately and stay closed after rollback; only the survivor's current `ctx.ui` can accept new questions.

Copied/edited `extensionsOverride` registrations need not retain private metadata. Callbacks bind to the invoking session and caller edits remain effective. Omitted SDK-owned factories receive shutdown before creation returns, even when selection is empty. They retire captured APIs and release their own subscriptions without removing selected extensions' subscriptions. The same applies on reload.

Failed/omitted factories drain admitted callbacks, including post-await acquisitions, before shutdown. Once rollback starts all closing factories refuse new work, even while another cleanup is suspended. Selected callbacks must not block omitted-factory cleanup. Register cleanup before acquisition or asynchronous work.

## Replacement and deferred generations

Runtime disposal drains admitted new/resume/fork/import preflight, factories, startup, and candidate cleanup; it cannot publish a late successor. Command-initiated replacement seals the old generation and drains unrelated work before handoff. The invoking continuation can finish afterward; old shutdown and both session/runtime disposal join it. Awaiting disposal inside that continuation deadlocks.

Concurrent command replacements register handoff before awaiting publication so retirement does not mutually block. Final disposal joins every continuation and reports deferred failures. Captured old APIs cannot mutate successors, obtain task hosts, or acquire new resources. Old shutdown can inspect cleanup context and release captured handles; its events are not delivered to successors.

External replacement finishes outgoing shutdown before creating a successor. Failed shutdown prevents creation and still attempts retained workflow cleanup. Repeated disposal retains failure. Overlapping factories may complete out of order; coordinate retirement, publication, and rebinding, close displaced successors, and never let failed candidates close a surviving successor's retained workflows. If all fail, retained workflow cleanup still runs.

Reload rollback covers settings commit, resource activation, and resource commit as well as preparation/startup. Even after commit, custom runtime reconstruction may fail. Retiring shutdown/invalidation must still run, installed candidates remain owned for final disposal, and combined reconstruction/cleanup causes remain visible. Reload also releases unused preparation-factory acquisitions when factories are re-instantiated. Failed candidate startup seals and drains callbacks before shutdown. Self-reload retains the old generation until its invoking continuation settles.

Session-attributed settings write failures reject disposal without draining caller-owned `SettingsManager.drainErrors()` or blaming an idle borrower. `flush()` keeps its resolving/error-channel behavior. Successful repeat persistence before close repairs the fault. `executeBash()` correlation IDs are not unique operation IDs; duplicate IDs are preserved and `abortBash(id)` cancels all matches.

## Compaction reconstruction

The range planner receives the active numbered transcript except exactly the newest `preserve_recent` context-visible messages, default two, with no user-turn alignment. RPC documentation specifies bare `start,end` deletion records. Earlier SDK prose instead said JSON ranges; that pre-existing discrepancy requires runtime reconciliation, not an editorial protocol change. Validate deletions and reconstruct retained lines with `(filtered N lines)` markers; the model does not author replacement context.

Persist a `compaction` entry only as active when `details.strategy` is `verbatim-lines`. During context rebuild select the latest active boundary on the root-to-leaf branch, replaying model, thinking, and context-window changes. Emit one visible custom message with `customType: "compaction"`: durable `summary`, followed by the serialized kept tail from string `firstKeptEntryId` up to the boundary. Do not separately emit tail entries, which may begin/end mid-turn and form invalid provider block order. Keep full tool-result text and attach retained images as image blocks. A null first-kept ID means summary alone. A missing non-null ID in a corrupt/foreign boundary must not resurrect older context; emit boundary plus subsequent messages.

Post-boundary messages stay real messages. Resume does not rerun planning or derive omissions. `convertToLlm()` maps synthesized boundaries to provider user messages. Historical `compactionSummary`, `context_compaction`, and non-verbatim compaction records are inert. Old logical deletions may therefore reveal previously hidden context until a new verbatim boundary is created. The user session-format reference retains archival schemas because third-party parsers need them.

## Resume picker scheduling

Relocated from `sessions.md`, “Session summaries”. Paint header, search, and loading state before discovery. Scan directories in cooperative batches and parse large transcripts in yielding chunks off the terminal UI loop. Closing cancels scans and discards stale results. This prevents one large transcript or a late scan from blocking or overwriting an unrelated picker view.
