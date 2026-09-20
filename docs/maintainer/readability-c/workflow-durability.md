# Workflow durability and database maintenance

Relocated from `packages/coding-agent/docs/workflows/operations.md`, with topology requirements from `workflows/authoring.md`. Public database setup, status/doctor/recover actions, supported platforms, privacy, resume limits, and failure remedies remain in the guides.

## Bundled PostgreSQL and shared ownership

All eight targets carry checksum-pinned runtimes: Linux x64/ARM64 glibc/musl, macOS x64/ARM64, and Windows x64/ARM64 through x64 emulation. npm resolves the matching `@bastani/atomic-natives` platform leaf, including nested installs; archives use `node_modules/@bastani/atomic-natives/postgres-runtime`. Those precede the legacy upstream wrapper, even in compiled Bun archives. Upstream optional runtime packages do not override the native leaf.

Musl uses PostgreSQL 18.6 Alpine builds; other targets use 18.4, sharing major-version-18 data layout. Direct `postgres` startup uses an opaque retained native process lease. Ready shared servers survive the final client exit; only failed startup can stop its exact unpublished server. Preserve shared records outside installation/version directories.

For root Linux, resolve `postgres`, `nobody`, or `daemon` and probe exact UID, primary GID, primary-group membership, and absence of root group. Additional nonroot groups are valid. Direct native spawn clears supplementary groups before setting GID/UID. If a root-owned prefix is untraversable, publish an exact content generation into a root-owned runtime cache, readable/executable but not writable by the server account. Re-snapshot source for reuse/publication and validate the deterministic path after rename. Source mutation, corrupt content, and displaced setup leases fail closed without repeated repair copies.

Elevated Windows starts with reduced privileges. Server logs are redirected without leaking handles into unrelated concurrent commands. SQL/data/process identity, not a listening TCP port, authorizes attachment. Recovery uses an elected owner and shared setup lock, never initializes missing data, kills an unrelated listener, switches to Docker, or restarts the DBOS executor. Initial provisioning and post-readiness connection failure have different fallback rules; do not equate them.

Payloads contain libraries/share trees, executable modes, scriptless link metadata, licenses, and `runtime-provenance.json`. Packaging rejects missing inventory, checksum faults, and CPU/libc/target mismatches. Install validation checks aliases and startup/database dependencies. npm first-use link setup can copy libraries when symlinks are unavailable; malformed manifests, conflicts, and failed copies are errors.

CI exercises initdb, start, connect, and clean shutdown on stock Alpine for both musl architectures. There is no repository Windows ARM64 runner: payload selection/PE architecture checks do not establish emulated runtime behavior. Real Windows ARM64 hardware validation remains a separate coverage need. This relocation did not run those checks.

## Checkpoints, scopes, and topology

Persist a versioned child-boundary start before dispatch: stable boundary/child IDs, root/parent ownership, source order/parents, composed replay scope, alias, workflow, state, and deterministic fingerprint of definition plus exact validated inputs. Distinct-input parallel calls keep stable scopes if dispatch order changes. Identical fingerprints use an ordinal. Replay validates identity before allocating a UUID.

Child effects are stored under the durable root; each nesting layer strips exactly one scope to expose its local view, never suffix-matching siblings or root data. Checkpoints retain order, DAG edges, actual status, ownership, timing, output summary, model, session references, and exact control targets.

Runtime must check each materialized parent edge incrementally during execution and replay. DBOS hydration rejects cycles before exposing cache/control/dispatch. Authoring/discovery cannot prove arbitrary dynamic acyclicity.

Older completed boundaries lacking start/fingerprint records require reciprocal checkpoint proof of root, parent, boundary, child, and scope. Active records without a provable fingerprint, duplicate/stale/nonreciprocal/aliased/cyclic/orphaned topology, and unsupported formats fail closed. Do not invent child links or perform repair effects during inspection.

Current-format topology-less tool output remains authoritative for replay. Root inspection derives fallback identity/order from checkpoint identity and record order. Child replay adds awaited topology metadata without replacing the original output. Invalid local parent edges must not be overwritten by a different recovered graph. Older targeted-abort recovery requires one typed unfinished node and intact completed predecessors; error text is not executable state.

## Liveness and persistence ordering

Each process has a DBOS executor ID. Active stage session identity is checkpointed after stage start and before first model use. Serialized unref'd liveness writes refresh pause-adjusted stage/root timing at a bounded 30-second cadence, including nested scopes. Stop timers on every exit; drain an in-flight checkpoint at shutdown. A late durability failure makes the stage failed and releases its concurrency slot rather than disappearing after the model turn.

Writes serialize per durable root, not globally. Independent roots can register and progress during another root's stalled write; nested children share root order. Lifecycle drains wait for every root. Resume claims are durable first-writer-wins with observed-generation revalidation.

Awaited DBOS writes update the in-memory mirror only after acceptance. Root metadata uses versioned records with latest timestamp winning hydration. Unmarked raw outputs remain generic stage checkpoints only with compatible current metadata. Unsupported marked envelopes are not decoded as raw output; malformed additive topology does not discard an otherwise valid stage envelope. DBOS remains authoritative, not the legacy `~/.atomic/workflow-durable` store.

## Quit, failure, and late callbacks

Quit first obtains controllable-stage acknowledgements, then closes the root-shared tool-admission boundary. Scan after closure so calls admitted during stage stopping are included. Abort the complete set, wait a bounded time, then publish the durable pause. Cancellation commits callback executors to suspension even if the durable pause fails; preserve the local pause and distinguish usable prior progress from a failed write.

An abandoned callback's executor remains alive but no longer owns the run. Detach its job so same-ID resume starts a new executor. Its aborted signal prevents replayable persistence; stale cleanup cannot mutate replacement nodes or unregister replacement jobs/cancellation entries. Catching cancellation cannot publish completion after whole-run quit.

First observed tool failure, not admission order, chooses the failed-node link when the body later fulfills. Identical thrown objects/primitives still retain the correct origin. Unrelated later errors do not inherit caught tool provenance. Once failure wins after body settlement, close admission, cancel non-failed siblings, await failed-node publication, and do not wait forever on cancellation-ignoring callbacks. A later cancellation cannot replace the chosen error.

Return-mode cancellation and targeted abort retain inspection-only `tool-failure:` records with `cancelled: true`, not replayable success or `return_failure`. Late values are rejected before persistence. Replay computes the same ordinal/`argsHash` and rejects mismatched identity/parents. Calls through retained `ctx.tool` after terminal closure reject without graph/checkpoint/callback work and do not produce an unhandled rejection when ignored.

Task-tail persistence stays controllable. Abort after write begins must observe rejection and not strand durable finalization; catching the rejection cannot overwrite pause. Nested tail pause/quit suspends the root. Terminal stage checkpoints can supply the complete prior `WorkflowTaskResult` when a task checkpoint is absent, retaining truncation, primitive structured values, artifacts, warnings, session, and model metadata. Unknown same-process checkpoint history is rejected rather than skipped.

## Inspection rendering and history

The tool card uses status-tinted tool-block padding, bounded tail rendering, and optional callback source captured by `fn.toString()`. Tabs expand and controls escape as `\xNN`; cyclic, throwing serialization, and throwing getter values become `<cycle>`, `<unserializable>`, and `<unreadable>`. This projection does not alter exact checkpoint output or raw-argument hashes.

The resume picker and command share `isWorkflowRunResumable` in `packages/workflows/src/durable/resume-eligibility.ts`. Catalog hydration and deletion revalidate authoritative state. Read-only inspection never claims ownership or dispatches. Artifact pruning removes the durable entry first and preserves the directory when deletion is refused or unavailable. Fresh completed inspection does not currently persist declared root output.
