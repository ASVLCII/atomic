# Task supervision and native ownership

Maintainer reference relocated from `packages/coding-agent/docs/sdk/reference.md`, sections “Owner-bound task supervisor (S1)”, “Supervised command SDK”, and “Task transcript references”. The user reference retains the exported `AgentTaskHost` contract and shell-tool integration guidance. Raw supervisor operations below are trusted-host internals, not package-root SDK exports. These notes preserve implementation constraints from the source, not a new API or a claim of fresh runtime verification.

## Admission and workflow ownership

`src/core/tasks/contracts.ts` and `src/core/tasks/supervisor.ts` wrap the native `TaskSupervisor`. `bindHostSession` binds the actual scope, `authorizeLaunch`, and runner factory; `openTaskOwner` opens admission. Authorization precedes native admission. Task registration precedes runner setup. An exact operation replay reuses execution without invoking another factory; a fresh operation creates a distinct task. Leases are environment-local, non-serializable capabilities and cannot be reconstructed from IDs or history.

Each workflow admission boundary allocates a process-private stage-attempt identity. The original session/run/stage identity and lazily bound `bindAgentTaskHost` owner survive fallback session replacement. Replacement disposal does not close those tasks. Sealing fences admission and starts owner closure; generation close awaits independent cleanup and reports failures. Restoration creates a fresh boundary, not a restart capability. Public producers, durable callback joins, and nonvisual completion admission use this owner.

An outbox restored from history immediately retries unacknowledged terminal completion intents through the current admission boundary, without waiting for another settlement or recreating execution capabilities. Failed admission leaves the original identity pending. Acknowledged intents are not redelivered; a closed boundary refuses admission. Session initialization restores admission keys from custom messages, preventing duplicate delivery after a crash between persisted delivery and outbox acknowledgement.

Already-admitted in-process `taskExecution` hooks retain the original result and cleanup promises. An exact Intercom commit yields its registered observation. In an explicit foreground group it also yields active sibling observations once per child through the group signal, without detaching or completing execution.

## Observation and closure

`initialObservation` returns `default-background` for omitted policy, `explicit` for explicit background, or registers a budgeted foreground wait. A ready terminal result wins. `waitForTask(task, budgetMs?, designation?)` and `foregroundTask(task, budgetMs?)` return Result/WaitOutcome, not leases. Native registration and the WaitId registry are populated synchronously before awaiting. `findWait(waitId)` lets lifecycle code yield or dispose a wait. SDK waits replace host designation only with a matching HostSession. Yield and observer disposal do not stop or relaunch execution; yielding a disposed wait replays its ObserverCancelled Result.

Requested agent waits default to 30000 ms. Host configuration can set `tasks: { wait: { kind: "automatic", agentBudgetMs: 5000 } }`; `until-settled` disables timed yielding. Per-call budgets, including zero, win. These settings govern explicit foreground launch, foregrounding, and ID waits, not independent default launches. Wide budgets are not narrowed to u32. Accepted NaN budgets remain pending until explicit yield, settlement, disposal, or closure because elapsed comparison never reaches NaN. Bounded sleep chunks avoid a native scheduling panic without rewriting the budget or imposing a new finite-only contract.

`cancelTask` preserves the first accepted cause. `closeTaskOwner` seals before draining and requires independent cleanup acknowledgement. Cancellation cleanup can finish without a result; natural cleanup-first delivery waits for its outcome before acknowledging reaping. External native closure aborts resources even for settled results without changing those results. User cancellation retains input attention until settlement or closure, including reattached/event-reduced snapshots.

Runner rejection becomes `RunnerFailed`; cleanup rejection becomes diagnostic `CleanupFailed`, never successful reaping. Setup throws retain `SpawnFailed` and unconfirmed cleanup. Preserve strings and Error messages; safely convert other JavaScript values, falling back to `Unprintable JavaScript rejection`. Missing cleanup acknowledgement may leave close pending. The S1 fake-runner tests alone do not prove force-stop or real-process cleanup.

## Supervised commands

`startCommandTask(owner, intent, operation)` starts Unix pipe/PTY or Windows pipe/ConPTY work. Command observation defaults to 10000 ms and is separate from execution timeout. Unix owner closure sends TERM, waits 250 ms, then sends KILL; it reaps the leader and confirms process-group exit and reader drain. Failures retain diagnostics. This is ordinary host shutdown, not a guarantee under forced host death or a blocked JavaScript loop.

`CommandIntent.shell: { program, args }` launches the executable directly, appending `command` as one final argument. Omission keeps the native default shell. `inheritEnv` defaults true; false uses only supplied variables. Both participate in replay identity.

`taskStdin` returns a non-serializable capability. `writeTaskInput` uses an operation ID and `{kind:"bytes", bytes:Uint8Array}` or `{kind:"eof"}`. Empty bytes do nothing. Credits are 65536 bytes; excess input is refused before admission. Replay returns the receipt without resending. Ambiguous partial delivery returns `InputDeliveryUnknown` with the operation ID and known accepted-byte count.

`readTaskOutput(task, {start, maximumBytes})` returns byte chunks at decimal offsets, bounds, omissions, and optional `nextOffset`. Clamp requests to the 1 MiB preview limit before allocation/read. Bytes are not normalized. Retention uses a 1 MiB live head/tail, an 8 MiB foreground spill threshold, and a 5 GiB disk cap. Output is not conversation history. Supervised drains, not inherited file writers, enforce one serialized stdout/stderr/descendant disk budget. A crossing write retains only the permitted prefix, including during foreground collection and termination. After collection yields, rejected overflow kills the group and reports `OutputLimitExceeded` only after confirmed cleanup. Spool setup failure is `SpawnFailed`. Drained pipe/PTY output can instead continue with bounded retained bytes and omissions.

Unix resize uses the retained portable-pty master. Windows uses ConPTY; pipe and ConPTY children start suspended, enter a kill-on-close Job Object, then resume. Failed containment refuses execution, with no unsupervised fallback. Native Windows legacy WSL `bash.exe` stdin launch is refused because Windows jobs cannot supervise Linux guests. Atomic inside WSL uses POSIX/Bash.

Bound Bash and `createLocalBashOperations` launches retain shell arguments, cwd, environment, authorization, and owner wait policy. Output gaps use `[Output omitted: bytes start-end]` with exclusive end offsets. Unbound Bash/native PTY behavior remains separate.

The public PowerShell factory uses encoded command transport internally while retaining the original text in task descriptions. This implementation note was relocated from `sdk/reference.md`, “PowerShell tool behavior”.

## Journal delivery and replay identities

`watchOwnerTasks(owner, cursor?)` returns a lease, snapshot, decimal-string cursor, and disposable `AsyncIterable<NativeEvent>`. Each iterator covers one contiguous epoch. Backlog overflow or native journal reset replaces snapshot/cursor, discards stale queued deltas, and completes the old iterator, including pending reads. This also handles an oversized final settlement with no retained event. No synthetic reset event is added.

After iterator completion, reconcile snapshot at cursor. If still observing a live owner, acquire another iterator from the same `subscription.events`; the old one stays done. Ignore events at or below the reconciled cursor. Reset does not dispose or close. Explicit disposal or breaking a live iterator ends observation; owner closure ends delivery. New subscriptions are refused once closing begins, while existing ones observe cleanup. Disposal inside `onReconcile` prevents retained deltas from publishing and finishes pending/new iterators while leaving the snapshot readable.

`onReconcile` is optional. Exceptions appear as `subscription.failure`; safe diagnostic conversion handles hostile conversion and revoked proxies without interrupting delivery or fallback polling. Native callbacks are wake hints; drains and reset snapshots are authoritative. Each live subscription has one fallback poll, stopped on disposal or observed closure.

Each task retains its last 256 accepted activity report IDs, SHA-256 payload hashes, and receipts in `TASK_REPORT_IDENTITY_WINDOW`. Matching replay returns `duplicate` with the original cursor; changed payload returns `ReportConflict`. Neither emits nor refreshes retention order. Evicted IDs are fresh while live, subject to terminal/closure guards. Terminal receipts are retained for the task lifetime separately. This bounds identity entry count, not ID length, task count, terminal payloads, or total history memory. S1 adds no persistence layer.

No activity spelling is reserved, including `runner-outcome`, empty strings, and isolated surrogates. Private runner support selects a free terminal identity and accepts it under one actor lock. At most 257 candidates suffice against 256 retained activity IDs, without events or extra ID history. It reuses accepted terminal identity so late results cannot replace it; cancellation-first rejects late natural outcomes. Public `reportTaskOutcome` still conflicts on same-ID cross-kind reports and replays original terminal receipts. Normal, rejected, and setup-failure results use this path without bypassing cleanup.

Preserve exact JavaScript UTF-16 code units across identity, scopes, intents, activity, results, and nested metadata, including isolated surrogates and NUL. U+FFFD substitution changes identity. Title uses a nonempty description, otherwise the first nonblank task line unchanged, then the agent name. Preserve missing fields, empty strings, zero, and ordered duplicates distinctly. `elapsedMs`, `toolCount`, `tokenCount`, and completed/failed `exitCode` remain JavaScript numbers without narrowing. Replay distinguishes omission, zero, and negative zero; repeated NaN/infinities acknowledge once, changed numeric payloads conflict without an event. `OutputRef` is metadata, not retained-byte evidence.

The credential-free `test/fixtures/task-s1-demo.ts` exercises the facade and native actor with a fake runner. Historical S1 notes described output storage, input, persistence, completion delivery, and real agent/Intercom integration as later slices; do not read that chronology as the current feature inventory.

## Transcript adapter

A runner binds existing child history with `context.bindTranscript(sessionManager)`. `core/tasks/transcript.ts` reads through the task capability, returning references (`id`, `kind`, `source`, optional `toolCallId`), not copied text. Kinds are prompt, assistant, tool-call, tool-result, and response. Thinking and non-conversation entries are excluded. Duplicate source IDs collapse; distinct message IDs remain distinct.

The first page contains up to 100 recent references in source order; opaque `nextCursor` reads earlier references and `omittedEarlier` reports remaining history. Cursors belong to one task/session. Errors are `UnknownTask`, `ScopeMismatch`, and `TranscriptUnavailable` with `Transcript unavailable` for empty/unbound history. History never recreates execution authority. Production runners bind child history; main and attached workflow hosts mount the shared inspector. Selection/view lifetime scopes command-detail reads so late results cannot overwrite a different view.
