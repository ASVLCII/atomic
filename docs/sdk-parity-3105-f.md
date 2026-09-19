# SDK parity #3105: slice F

## Contract

Implement awaited shared shutdown and generation replacement/reload. Seal admission synchronously; abort, drain, settle input, shut down extensions, flush persistence and release leases. Attempt all cleanup and report aggregate `ShutdownFailed` causes. Preserve siblings and borrowed resources. Public `await session.dispose()` must let a built Node workflow process exit normally. Keep the actual `AgentSession`, existing tool/event contracts and authored workflow bytes. No new manager or required host configuration.

User amendments carried forward: "make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback". Those are parent-owned gates for the cumulative PR, not permission to publish or merge slice F. This child performs no push, PR, merge, release or deployment.

## Decisions

- Durable workflows retain their existing runtime ownership across reload/new/resume/fork. Generation-owned provider calls, auth, input, shell work, child admission and subscriptions close. Actual final owner disposal drains retained workflow roots/stages and releases the last owned DBOS lease. Injected durability remains borrowed.
- The internal optional `pi.lifecycleScope` identifies a runtime across replacement. It is not a host setting or control API. Independent session creation originates a fresh identity, including SDK children and sessions borrowing the same loader, event bus or settings. Only explicit reload/runtime lineage transfers it. Borrowed default loaders supply discovery configuration/assets, not a shared live extension generation. Existing host bindings transfer before successor startup.
- Mutable workflow stores, registries and tool/status/control helpers capture the owning session's concrete resources rather than the latest process-global facade.
- Native closed task-owner scopes never reopen. Reload creates a fresh internal owner identity without changing the public session ID or a borrowed workflow-stage owner.
- Closed ordinary input, prompt, shell and auth admission refuse rather than accepting work into a retired generation. Raw payloads and tool result formats are unchanged; no new text normalization or duplicate policy.

## Acceptance matrix

| Required clause | Evidence |
| --- | --- |
| Awaited idempotent disposal, synchronous admission seal | `sdk-builtin-parity.test.ts`: public disposal Promise identity, pending shutdown, immediate prompt/binding/reload/input/compact/tree/model/startup-resource refusal; replacement fixture checks repeated runtime success/failure outcome |
| Ordered cancellation/drain/settlement and no replay | Public shell/input drain, active-provider/OAuth and queued-child tests; suspended prompt, compaction hook/provider and tree preflight remain owned until settlement and cannot write retired results or enter a retired provider turn |
| Every cleanup attempted; aggregate component causes | Public two-extension plus settings-flush failure test proves later session persistence runs; MCP final-close aggregate/deadline and real-adapter failure fixtures |
| Persistence and subscription release | Protected-shutdown, runtime event subscriptions, RPC shell-source persistence suites; shutdown explicitly flushes session/settings persistence before lease release |
| Startup rollback | SDK eager/deferred startup and post-discovery failure cases; workflow partial DBOS startup cleanup regression |
| Replacement binding and identity | Runtime replacement startup receives inherited input; new/resume/fork/import × preflight/factory/startup Node matrix proves terminal drain and no successor publication; prepared resume and candidate cleanup/rollback failures covered |
| Reload invalidation and fresh admission | Transactional reload disposal races at `beforeSessionStart`, `session_start`, `resources_discover` and retiring shutdown; candidate rollback, callback rejection and aggregate cleanup failure; slash-command reload avoids draining itself; strict reload, Herdr, shell-owner and OAuth suites |
| Borrowed stage resources survive replacement | Stage-runner public adapter ownership, shell-wait workflow-stage cases and workflow retained-generation tests |
| Borrowed managers/model runtime | Public sibling uses the same settings manager after peer close; OAuth disposal retains caller's registered provider; injected workflow backend survives final lease release |
| Sibling workflow survival | Built Node fixtures start/close siblings with independent buses, one borrowed shared bus, and one borrowed default loader plus shared bus/settings. Shared-resource fixture reloads both rightful owners, retains pending input and exits naturally; original fixture still completes exactly one guarded effect |
| Last-owned runtime closes, no process-exit mask | Built non-TTY Node fixture exits naturally after public `session.dispose()`; no manual DBOS cleanup or `process.exit`; workflow beforeExit fallback removed |
| Normal process state/architecture | No workflows build pipeline or new runtime service; no cwd mutation, signal handler or console suppression added; workflow owner resources passed explicitly |
| Exact existing API identity and payload behavior | Prior A–E SDK and host parity suites rerun in full; `dispose` alone changes to `Promise<void>`; existing authored workflow hash remains `aee794cfa82fe248928ab07ec0964752c59a0bfc8ff685f814f710f9c4c61db2` |
| Documentation and release notes | SDK guide/reference describe awaited cleanup, errors, borrowed ownership and replacement; coding-agent/workflows/MCP Unreleased notes |
| Build/check and applicable focused tests | Commands and current results below |
| Signed conventional commit, normal hooks, clean tree | Recorded in the implementation handoff receipt |

## State checks

- Creating → ready: one startup per generation. Failure → closed after attempted rollback, never a returned half-started session.
- Ready/active/awaiting-input → closing → closed: admission seals before yielding; pending input is cancelled and cannot approve later; cleanup failure stays explicit and admission stays closed.
- Ready → reload: old generation work drains and input is invalidated; prepared extension publication remains transactional. New admission receives a fresh native owner. Borrowed workflow-stage lifetime does not close.
- Replacement: old session is terminal; successor receives runtime identity and configured bindings before startup. Siblings do not inherit this identity.
- Terminal queued child: cannot dispatch or resurrect; the owner close receipt records cancellation. New execution requires new admission.
- Replacement factory rejection: finalizes retained outgoing runtime resources even though ordinary disposal remains idempotent. New/resume/fork regressions and a real pending-workflow Node process cover the no-successor path; original and cleanup failures remain visible.

## Prior validation (superseded by consolidated review repair below)

Current local host is macOS arm64, Node 26.8.2, Bun 1.4.2. Provider inference, OAuth and cleanup failures use deterministic fixtures. The Node fixture loads actual built exports/assets, not a packed independent install; packed Node/OS matrix acceptance remains H.

- `npm run build`: passed, `/tmp/3105-f-build-final-receipt.log`.
- `npm run check`: passed, `/tmp/3105-f-check-final-receipt.log`, including Biome, both typecheck passes and shrinkwrap verification.
- Coding-agent focused command selected `sdk-builtin-parity`, `agent-session-runtime-events`, `agent-session-shell-wait`, `interactive-deferred-startup-first-prompt`, `herdr-reload`, `rpc-bash-session-replacement`, `paused-protected-shutdown`, `oauth-cancellation`, `provider-oauth-login-signal`, `interactive-engine-shutdown`, `rpc-oauth-login`, and `rpc-bash-streaming`: 12 files, 151 passed. One pre-existing real-PowerShell case is platform-inapplicable without `pwsh`; both registry branches and borrowed-stage ownership cases passed. Log `/tmp/3105-f-core-final-receipt.log`.
- Root focused unit command selected DBOS lifecycle/replacement, workflow boundaries/tool ownership/quit/runtime, stage registry/broker/public ownership, MCP cleanup/ownership and subagent public/foreground cleanup suites: 35 files, 316 passed, `/tmp/3105-f-unit-acceptance.log`.
- `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts`: all 44 passed, `/tmp/3105-f-integration-final-receipt.log`. Includes natural Node exit after public disposal and after rejected replacement with a real pending workflow.
- `node test/fixtures/sdk-host-built-node.mjs`: exited 0 with correct source hash, preserved text, approval and one effect after sibling closure, `/tmp/3105-f-public-node-siblings.log`.
- Supplemental qlty smells/metrics ran on shared close and new lifecycle helpers. No helper smells; existing `_processAgentEvent` complexity is 69 and unchanged. Shared close measured 11. Logs `/tmp/3105-f-qlty.log` and `/tmp/3105-f-metrics.log`. Authoritative Biome/typechecks remain the gate.
- Additional workflow control/resume/inspection coverage: 12 suites, 135 passed, `/tmp/3105-f-controls-acceptance.log` (some overlap with the 35-suite run). CLI fallback/model setup: 2 suites, 9 passed, `/tmp/3105-f-cli-fallback.log`.

## Debugging and remaining work

The initial public regression returned `undefined` from disposal. Later regressions caught mutable runtime factory preflight lookup, a static mixin import cycle, missing shell persistence, reload publication before admission reopened, reuse of a closed native owner, remote abort calls during isolated-engine teardown, and workflow tool helpers consulting sibling state. Focused reruns passed after repairs. Pre-F tests that required generation-owned shells to keep running across replacement/reload were migrated to explicit F cancellation; their output paging and ordinary wait assertions remain, with new fresh-owner checks. Borrowed stage retention assertions remain unchanged.

The replacement-factory leak reproduced as a 60-second real Node timeout before repair and passed the normal-exit oracle afterward. The prior claim that no unresolved F failure remained was too broad: consolidated review found three missed shared-owner/admission races. The current repair and bounded evidence below supersede that claim. Existing tracked `ISSUES.md` risks for other issues and G/H remain outside this slice; packed-consumer and remote platform CI evidence is not claimed here.

## Consolidated review repair

All three P1 roots reproduced against `fe41a5d4c` with the supplied public built-Node probes: shared-bus disposal paused a sibling's workflow; suspended prompt preflight invoked a provider after disposal; suspended reload started a candidate after disposal and leaked it. Scope identity alone was insufficient: workflow run-state adoption also had to stop using the shared bus as an owner.

The repair registers admitted prompt work before invoking callbacks, guards its captured generation after asynchronous preflight, and drains reload preparation/rollback before terminal extension shutdown. Candidate startup/publication checks closure; discarded candidates receive shutdown and invalidation, with cleanup failures retained in `ShutdownFailed` even when reload rejected before disposal started. Reload remains exclusive while startup effects are published, without blocking those effects' ordinary prompt admission. Disposal remains pending while noncooperative admitted callbacks remain pending, rather than claiming successful cleanup. No deadline, forced exit, private DBOS cleanup, new manager API or shared-bus restriction was added.

Persisted tests cover actual SDK callbacks and built Node exports. The original two risk probes await disposal before releasing their callback, which is incompatible with a truthful drain: their post-fix noncompletion is not a passing oracle. `sdk-host-admission-drain.mjs` observes disposal pending, releases the callback independently, then requires `SessionClosed`, zero provider calls/resources and natural process exit. `sdk-host-shared-bus.mjs` retains the actual durable workflow path and reloads both owners.

Existing affected test fixtures were migrated, not weakened: concurrency cases now use real extension hooks instead of incomplete private runner stubs; storage assertions await public disposal before deleting persistence directories; real graph-reload fixtures explicitly transfer an owner instead of treating bus reuse as ownership. Their behavioral assertions remain. No new skips were introduced.

RED logs: `/tmp/3105-f-batch-{scope,prompt,reload,rollback,overlap}-red.log`; broader fixture failures: `/tmp/3105-f-batch-{core,unit}.log`. Exact reproducible commands are in `/tmp/3105-f-batch-commands.txt`.

### Previous round verified acceptance (baseline `2b21a7f3a`)

- Unmodified `npm run build` and `npm run check`: exit 0; `/tmp/3105-f-batch-{build,check}-final.log`.
- `npm run test --workspace=@bastani/atomic -- sdk-builtin-parity agent-session herdr-reload paused-protected-shutdown oauth-cancellation provider-oauth-login-signal interactive-engine-shutdown rpc-oauth-login rpc-bash interactive-deferred-startup-first-prompt session-temp-protection-lifecycle extensions-runner`: 54 files passed, 434 tests passed, including all 73 SDK parity tests; `/tmp/3105-f-batch-core-green.log`. Fourteen existing skips remain: live-provider branching/tree cases require credentials, and one real-PowerShell case requires its applicable platform/executable. No tests were newly skipped or failures filtered from the final run.
- Affected root lifecycle/ownership/control command: 45 files, 460 tests passed; `/tmp/3105-f-batch-unit-green.log`. Includes real workflow graph reload, DBOS replacement, workflow pending-input/quit/owner controls, public stage ownership, MCP ownership/cleanup and subagent foreground/cancellation suites. Exact selectors are in the command receipt.
- `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts`: 47/47 passed; `/tmp/3105-f-batch-integration-final.log`. Includes unchanged workflow host parity, sibling survival, failed replacement, all three new built-Node scenarios and natural exit.
- Exact shared-bus review probe: exit 0; `/tmp/3105-f-batch-shared-green.log`. Independent public Node admission oracles: both exit 0 with `drained: true`, `providerCalls: 0`, `active: 0`; `/tmp/3105-f-batch-{prompt,reload}-node-green.log`. Original sequential-release probes now exit 13 for unsettled top-level await, recorded as a noncompletion observation, not a success.
- Supplemental qlty smells/metrics completed: `/tmp/3105-f-batch-{qlty,metrics}.log`. No lifecycle-helper smells; existing large prompt/binding modules still report complexity. Build/check remain authoritative.
- All executed required local gates are green. Packed-consumer H, unexecuted platforms/live-provider cases, cumulative exact-head CI and actionable Greptile disposition remain parent/later-slice work; no remote results are claimed.

## Latest consolidated F repair and disposition

This section supersedes the previous round's completeness claim. All eight latest consolidated findings reduce to three reproduced P1 roots; none is deferred as an implementation follow-up:

| Review finding / root | RED evidence on `2b21a7f3a` | Repair and current GREEN |
| --- | --- | --- |
| Compaction admission (completion/risk/evidence reviewers) | Both exact probes invoked retired hooks after awaited disposal and appended entries (3→4 and 12→13) | `compact()` seals admission, tracks hook/provider work and fences results after awaits; both exact probes now report `SessionClosed`, zero hooks and unchanged entries |
| Replacement close race (completion/evidence/risk reviewers) | Suspended factory outlived runtime close and published a successor accepting `replacement-alive` | Runtime owns a terminal seal, shared close receipt, admitted-operation drain and candidate cleanup; exact probe observes close pending then no surviving successor |
| Borrowed same-loader ownership (completion/evidence/risk reviewers) | Closing idle B paused A's pending workflow with `exitReason: quit` | Fresh factory scope plus session-local default-loader generations preserve discovery/deferral options and added assets without mutating the borrowed loader; explicit lineage alone transfers ownership. Exact probe retains A running; durable fixture also reloads both owners |

Prepared but unbound extension runtimes no longer receive live session bus delivery. This prevents borrowed discovery callbacks from acting as a session owner. Existing deferred-startup regressions caught lost loader deferral options during repair; those options are now preserved. Fixture updates use actual started generations, await cleanup before removing directories and retain original behavioral assertions. No added skips, relaxed assertions, loader uniqueness restriction, manager API, forced process exit or private DBOS teardown was introduced. `ISSUES.md` remains untouched; no unresolved local debug note was added.

### Analogous lifecycle audit

- Manual compaction's hook and provider paths both drain; provider completion cannot append a retired transcript result. Tree navigation fences preflight/auth/summary completion and retains its existing branch-summary drain.
- Async model selection/cycling and startup/resource extension now participate in admission/drain. Runtime startup and provider login/logout participate in runtime admission. Existing prompt, queue, input, OAuth, shell, child admission and transactional reload coverage remains green.
- All four replacement APIs are exercised at preflight, factory and startup suspension, plus prepared resume. Disposal stays pending until independently released callbacks settle; no candidate publishes after closure. Candidate cleanup and startup rollback failures remain visible as `ShutdownFailed`, including repeated close.
- Same-loader, same-bus and same-settings identities do not confer ownership. Sibling/reload and borrowed workflow-stage tests remain green. Session-local loader candidates retain configuration, resources and deferred startup behavior; caller-owned managers/model runtimes are not globally closed.

### Current local evidence

RED: `/tmp/3105-f-latest-{completion-admission,completion-replacement,risk-compact,risk-shared-loader}-red.log` capture exact probe assertion failures; durable regressions are recorded in `/tmp/3105-f-latest-{compact,tree,doors,loader-durable,replacement-durable}-red.log`. No timeout or unsettled-await exit is counted as GREEN.

- Fresh unmodified `npm run build`: exit 0, `/tmp/3105-f-handoff-build.log`.
- Fresh unmodified `npm run check`: exit 0, `/tmp/3105-f-handoff-check.log`; Biome, both coding-agent typecheck passes and shrinkwrap verification succeeded.
- Exact `node /tmp/3105-f-{completion-admission,risk-compact,completion-replacement,risk-shared-loader}.mjs`: all exit 0 on the fresh build; individual `/tmp/3105-f-handoff-*.log` receipts.
- Fresh direct built-Node compact/compact-provider drain and shared-loader fixtures also exit 0: zero active generations; provider counts 0/1 respectively; shared-loader sibling remains running after reload/close.
- Full SDK parity plus affected coding-agent suites: 63 files passed, 481 tests passed, 14 pre-existing credential/PowerShell skips; `/tmp/3105-f-latest-core-second.log`. Command: `npm run test --workspace=@bastani/atomic -- sdk-builtin-parity agent-session herdr-reload paused-protected-shutdown oauth-cancellation provider-oauth-login-signal interactive-engine-shutdown rpc-oauth-login rpc-bash interactive-deferred-startup-first-prompt session-temp-protection-lifecycle extensions-runner extensions-loader resource-loader`.
- Affected root suites: 45 files, 460 tests passed; `/tmp/3105-f-latest-unit.log`. Same root unit selectors as `/tmp/3105-f-batch-commands.txt`.
- Full host parity: `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts`: 65/65 passed; `/tmp/3105-f-latest-integration.log`. Includes natural built-Node exit for compaction hook/provider drain, shared-loader reload/sibling survival and the 15-case replacement matrix. No source/test changes followed those suite runs; this continuation changes documentation only.
- Supplemental `qlty smells --no-upgrade-check --no-duplication` on lifecycle work/runtime/compaction/resource-loader and `qlty metrics --no-upgrade-check --functions` on lifecycle work/runtime: exit 0; `/tmp/3105-f-handoff-{qlty,metrics}.log`. Existing large modules and `fork` complexity (28) remain reported, not suppressed; no lifecycle-work helper smell.

Local evidence uses macOS arm64 Node 26.8.2, deterministic inference/auth fixtures and built workspace exports. It does not claim paid-provider, other-platform, packed-consumer H or remote CI results. Noncooperative callbacks must settle; disposal does not invent a successful timeout. G/H scope and parent-owned exact-head CI/Greptile conditional-merge gates remain unchanged.

## Latest four-root review batch (baseline `35d1d4ef7`)

This section supersedes the preceding completeness claim and receipts. Every consolidated finding in the latest review maps to one of the following repaired roots:

| Root | Reproduced RED | Persisted regression and GREEN |
| --- | --- | --- |
| Borrowed custom loader shares a live extension generation | `custom-loader.mjs` exits 1: closing idle B pauses A's running workflow | Existing composition now instantiates session-owned extensions from borrowed discovery, including forwarding loaders; `sdk-host-shared-bus.mjs facade` reloads both owners, preserves A's pending workflow and exits naturally |
| Base-class reconstruction loses caller policy | Both supplied subclass probes exit 1; exact instance-method override also reproduced RED in `/tmp/3105-f-r4-instance-red.log` | Delegate subclass/custom resource getters rather than reconstructing their policy. SDK regressions preserve the exact `Respect caller custom loader policy  \n` string for subclasses, instance overrides and forwarding views; built subclass sibling/reload fixture preserves the same policy |
| Outgoing retirement failure skips final retained cleanup | Bounded 25-second Node probe reports only `shutdowns: ["new"]`, no successor, DBOS ready with one lease and does not exit | Retirement rejection attempts final quit before propagating original/additional causes. `sdk-host-retirement-failure.mjs` covers new/resume/fork/import, each with and without a final cleanup failure; requires no successor, repeated-close identity, preserved causes and natural exit |
| Initial direct binding is outside disposal drain | Supplied direct `new AgentSession` probe exits 1 with resource active after successful disposal | Initial startup is registered before callback execution; rollback runs after tracked startup settles, avoiding self-drain. SDK and `sdk-host-initial-startup.mjs` independently release suspended startup while close is pending, then require shutdown once, zero active resources and natural exit, including startup/cleanup failures |

The shared implementation retains construction metadata, not shared session identities. Plain default discovery still preserves its existing private/deferred loading path; custom policy is delegated without requiring a clone method or unique loader. Disabled builtin factories are filtered before instantiation. Extension-discovered assets stay session-local when discovery is borrowed; prepared transactional loaders retain their validation/publication behavior. Internal service composition uses the same instantiation seam without changing CLI deferral.

The full host run also exposed a previously hidden discovery-only DBOS lease. Workflow durability leases now begin at `session_start`, not extension discovery. The pre-existing pending-workflow/rejected-replacement fixture now exits naturally. Three old lifecycle cases now invoke real startup through their harnesses before asserting owned shutdown; all original pause/drain/shutdown assertions remain. No new skips or relaxed behavioral assertions were added, and tracked `ISSUES.md` is untouched.

### Current verified local gates

- Unmodified `npm run build` and `npm run check`: exit 0; `/tmp/3105-f-r4-receipt-{build,check}.log`.
- Full SDK parity plus affected coding-agent lifecycle/resource/CLI suites: **65 files, 496 tests passed**, with the same 14 credential/PowerShell skips (two wholly skipped files). `/tmp/3105-f-r4-receipt-core.log`. Command: `npm run test --workspace=@bastani/atomic -- sdk-builtin-parity agent-session herdr-reload paused-protected-shutdown oauth-cancellation provider-oauth-login-signal interactive-engine-shutdown rpc-oauth-login rpc-bash interactive-deferred-startup-first-prompt session-temp-protection-lifecycle extensions-runner extensions-loader resource-loader mandatory-intercom`.
- Affected root lifecycle suites: **45 files, 460 tests passed**, `/tmp/3105-f-r4-receipt-unit.log`; exact root selectors remain those recorded in `/tmp/3105-f-batch-commands.txt`.
- Full host parity: `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts`: **78/78 passed**, `/tmp/3105-f-r4-receipt-host.log`. Includes prior prompt/compact/reload/replacement races, borrowed-stage ownership, sibling survival and all new built-Node cases.
- All five supplied Node probes exit 0 on the final build: `/tmp/3105-f-r4-receipt-probe-{1,2,3,4,5}.log`, respectively custom facade, completion subclass, risk subclass, direct startup, failed retirement. Initial assertion-failure logs are `/tmp/{custom-loader,subclass-loader,3105-f-risk-r3-loader-subclass,3105-f-evidence-r3-startup}.mjs.r4-red.log`. The retirement RED bound is recorded above and in the tool transcript; timeout was not counted as success.
- `qlty smells --no-upgrade-check --no-duplication` and `qlty metrics --no-upgrade-check --functions` completed with exit 0 on affected loader/lifecycle files; `/tmp/3105-f-r4-receipt-{qlty,metrics}.log`. Complexity/parameter warnings remain visible, including startup complexity 22 and existing workflow lifecycle complexity; they are not suppressed or represented as a clean-smells result. Build/check are authoritative.

No source/test edits followed these final suite receipts. Only this evidence matrix and external progress notes were completed afterward. Evidence remains local macOS arm64, Node 26.8.2 with deterministic providers and built workspace exports, not packed-consumer H, other platforms, paid-provider tests or remote CI. Parent-owned exact-head CI/Greptile gates and conditional merge remain unexecuted here. No push, PR, merge or release was performed.

## Current four-root completion batch (baseline `9c04df878`)

This section supersedes the preceding receipts. All twelve consolidated findings (three reviewers per root) are addressed; none of the four required roots is deferred.

| Root / disposition | RED evidence | Repair and durable public coverage |
| --- | --- | --- |
| Queue admission and drain: fixed | `queue-admission.mjs` closed with hooks suspended, then appended retired messages; `closed-queue.mjs` accepted both public queue methods after close | Steering/follow-up admission is tracked before callbacks and captures its generation; delegate user/custom sends and interrupt deliveries seal and drain. New SDK tests cover continue/handled/transform replies, closed sends, suspended reload, raw ordering and fresh queues. Built Node steer/follow-up fixtures independently release hooks and exit naturally |
| Factory acquisition rollback: fixed | `3105-f-evidence-factory-rollback.mjs`: acquired=2, released=0, leaked owned acquisition | Failed instantiation cleans earlier owned factories and the failing factory's registered cleanup, then releases subscriptions. Cleanup attempts continue after failure and preserve original/cleanup causes; discovery remains borrowed. SDK tests cover both shutdown failures and three throwing subscription releases |
| Shared storage/native task ownership: fixed | `3105-f-risk-r4-shared-manager-tasks.mjs`: closing A makes B fail `OwnerClosing` | Every independent session starts with a fresh native owner, preserving public persisted identity and explicit borrowed workflow-stage owners. Public SDK and Node tests share one manager; B retains background wait/kill, new shell execution and reload after A closes |
| Copied/edited registration binding: fixed | `3105-f-risk-r4-custom-registration-facade.mjs`: `/probe` fails with uninitialized runtime | Construction snapshots retain fresh factory-local state while reconciling caller edits. Invocation-local API bindings preserve copied/wrapped/added/deleted registrations and concurrent sibling calls across awaits; later registrations and event subscriptions retain the registering owner. No caller metadata-retention, unique-loader/storage or clone-method requirement |

The new source regressions live in `packages/coding-agent/test/sdk-builtin-parity-review.test.ts` (19 tests). `test/fixtures/sdk-host-review-lifecycle.mjs` adds three natural-exit cases to the full host parity suite. Existing borrowed-stage, resource-loader, extension, provider, workflow and sibling/replacement cases remain in the executed matrix. No process-exit mask, private DBOS teardown, manager API, payload normalization, caller mutation or test suppression was added.

### Current executed gates and receipts

- Exact commands and RED/GREEN mapping: `/tmp/3105-f-r5-commands.txt`. Five supplied probes all exit 1 on the baseline and 0 on the final build; `/tmp/<probe basename>.r5-{red,receipt}.log`. Factory GREEN reports acquired=2, released=1 and only one borrowed discovery listener.
- Fresh unmodified `npm run build` and `npm run check`: exit 0, `/tmp/3105-f-r5-receipt-{build,check}.log` (Biome, both typecheck passes and shrinkwrap verification).
- Full SDK parity and the previous broad coding-agent selector matrix: **66 files, 515 tests passed**, same 14 existing credential/PowerShell skips; `/tmp/3105-f-r5-receipt-core.log`.
- Previous affected root lifecycle matrix: **45 files, 460 tests passed**, `/tmp/3105-f-r5-receipt-unit.log`.
- Full host parity: **81/81 passed**, `/tmp/3105-f-r5-receipt-host.log`; preserves unchanged authored workflow hash and all prior built Node natural-exit oracles.
- Additional public queue/shell/kill suites: **10 files, 55 tests passed**, one existing platform-dependent case skipped; `/tmp/3105-f-r5-queues-green.log`. Additional task adapter/command/kill/stage/contract/subscription suites: **8 files, 49 tests passed**, `/tmp/3105-f-r5-receipt-tasks.log`.
- Supplemental qlty smells/metrics completed with exit 0; `/tmp/3105-f-r5-receipt-{qlty,metrics}.log`. Warnings are retained, including registration reconciliation complexity 18, instantiation complexity 20, and existing queue/task complexity. These are not represented as clean-smell results; build/check remain authoritative.

Intermediate evidence remains explicit: `/tmp/3105-f-r5-host.log` caught delayed lifecycle-scope capture changing reload identity; eager construction-scope capture repaired it and full host reruns passed. `/tmp/3105-f-r5-dynamic-red.log` caught copied APIs losing bindings on later registrations; owner capture repaired it before the final full runs. The first broad core run had one `SpawnFailed: Output spool unavailable`; its cause was not established. The same test passed isolated, with temp-lifecycle coverage, and in three subsequent full runs without native/test changes targeting that failure; no assertion was filtered.

The additional queue run reproduced two old synchronous-disposal fixture assumptions. The transfer test now awaits disposal before asserting the same six persisted entries; the intentional abort-failure test now asserts `ShutdownFailed` and its original cause rather than leaving close rejection unobserved. All original queue/resume/ordering assertions remain. These two test-only migrations followed the full matrix, then their complete ten-suite command passed. Tracked `ISSUES.md` is unchanged; resolved debug notes are not retained as open defects.

Evidence remains local macOS arm64, Node 26.8.2 and deterministic providers using built workspace exports. Packed-consumer H, other platforms/live providers and parent-owned exact-head CI/Greptile/conditional merge remain unexecuted here. No push, PR, merge, release, nested delegation or new workflow was performed.

## Consolidated rollback/replacement/persistence batch (baseline `d674f05e0`)

This section supersedes earlier completeness claims and receipts. All eight consolidated reviewer findings map to four repaired roots; none is deferred:

| Root / disposition | Reproduced RED | Repair and durable public coverage |
| --- | --- | --- |
| Pre-constructor acquisition rollback: fixed | Exact `3105-f-completion-r5-preconstructor.mjs` leaves owned acquisition 2 live | Creation-scoped tracking covers subsequent setup before ownership transfers to the session. Constructor rollback attempts every release and preserves original/cleanup causes. SDK transform/resource/constructor-cause tests and built Node acquisition fixture preserve borrowed discovery and release owned factories |
| Concurrent replacement ownership: fixed | Exact `3105-f-risk-r5-concurrent-replacements.mjs` leaves active generation 3 after successful close | Factories remain concurrent; retirement/publication/rebinding coordinate displacement and retain every candidate until publication or cleanup. Failed publication immediately closes its candidate. The last failed operation finalizes retained scope only without a live successor. Replacement startup rollback retains that successor's workflows. Public Node matrix covers new/resume/fork/import × reverse success, factory failure, both failures, disposal, displaced cleanup failure and startup failure; real pending workflows, suspended binding and callback-initiated replacement also exit naturally |
| Duplicate shell IDs: fixed | Exact `3105-f-risk-r5-duplicate-shell-id.mjs` observes signals `[false,true]` | Controller sets preserve exact caller IDs and results. ID abort cancels all matching operations; settlement removes only its controller. SDK dispose/ID/settled-peer regressions and built Node duplicate-ID fixture pass |
| Real settings persistence errors: fixed | Exact `3105-f-completion-r5-settings-failure.mjs` reports successful close while manager errors contain EISDIR | Internal write receipts attribute session writes without draining normal manager errors. Close reports unrecovered failures and continues cleanup. Real EISDIR tests cover owned/borrowed managers, idle siblings, caller-only writes, draining errors before close and recovery by a successful write. No new manager API |

Additional RED probes caught and repaired same-root gaps: constructor invalidation replaced the original setup error; failed displacement retained an unpublished candidate; late preflight retired a successor during host binding; failed candidate startup paused a live successor's pending workflow. The first publication-coordination iteration also blocked callback-initiated replacement; callback-scoped reentrancy preserves that supported behavior and fences displaced post-callback writes. Logs: `/tmp/3105-f-r6-{constructor-causes,displacement,binding,overlap-startup,reentrant}-red.log`. The reentrant RED exited 13 for unsettled await; it is not counted as successful cleanup.

### Final executed acceptance

Exact command receipt: `/tmp/3105-f-r6-commands.txt`. All four supplied probes exit 1 on baseline and 0 on the final build; `/tmp/<probe basename>.r6-{red,receipt}.log`. Final results include owned acquisition `[2]` released, no active successors after close, signals `[true,true]`, and real settings `ShutdownFailed` while both EISDIR errors remain readable.

- Unmodified `npm run build` and `npm run check`: exit 0, `/tmp/3105-f-r6-receipt-{build,check}.log`.
- Full SDK parity and broad affected coding-agent/runtime/resource/CLI/settings matrix: **72 files passed, 603 tests passed**, same 14 credential/PowerShell skips in two wholly skipped files; `/tmp/3105-f-r6-receipt-core.log`. Previous selectors are retained, adding `settings-manager`.
- Full named host parity: `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts`: **116/116 passed**, `/tmp/3105-f-r6-receipt-host.log`. Includes all prior A–E/F scenarios and natural built-Node exit, without private DBOS cleanup or forced process exit.
- Previous full affected root lifecycle matrix: **45 files, 460 tests passed**, `/tmp/3105-f-r6-receipt-unit.log`.
- Queue/shell/kill matrix: **10 files, 55 tests passed**, one existing platform skip; `/tmp/3105-f-r6-receipt-queues.log`. Task adapter/command/kill/stage/contract/subscription matrix: **8 files, 49 tests passed**, `/tmp/3105-f-r6-receipt-tasks.log`.
- Supplemental qlty smells/metrics: exit 0, `/tmp/3105-f-r6-receipt-{qlty,metrics}.log`. Complexity warnings remain visible, including publication `apply` 25 and existing `fork` 28; this is not a clean-smells claim. Normal build/check are authoritative.

No source/test edits followed these final suite receipts. SDK guide/reference and Unreleased explain the repaired behavior. No assertions were removed or softened and no skips added. `ISSUES.md` is unchanged. The earlier native `Output spool unavailable` observation remains unattributed: it did not recur in these full runs, but no native cause or repair is claimed. Evidence remains local macOS arm64 Node 26.8.2, deterministic providers and built workspace exports, not packed-consumer H, other-platform/live-provider or remote CI evidence. Parent-owned exact-head CI/Greptile conditional cumulative merge remains pending; no push, PR, merge or release was performed.

## F continuation from `9ab865cd4`

This repair supersedes earlier completeness claims. Scope remains contract F and issue §8.1 F, preserving A–E. The source-grounded lifecycle map guided the repair of all three consolidated P1 roots. No required root is deferred.

| Applicable requirement / decision | Current evidence |
| --- | --- |
| Failed file factory acquisitions roll back before successful creation | Shared inline/file factory execution now invokes registered rollback. Exact ordinary and later-rejected creation probes change acquired=1/released=0 to acquired=1/released=1. Public source and built Node tests cover ordinary diagnostics, later setup rejection and failing cleanup |
| Retiring input closes before successor startup; captured functions cannot approve | Reload seals the retiring bridge synchronously. Both exact input probes now report SessionClosed, with no old host call. Built overlap fixture permits successor approval while old captured input refuses |
| All admitted asynchronous extension execution drains before cleanup | Generic/specialized runner dispatch, bus callbacks, shortcuts and workflow observers attach to existing session work receipts before execution. Six public source and built Node cases independently release handlers after observing disposal pending, then require zero resources and one shutdown |
| Creating → ready or rollback → closed; original and cleanup causes retained | Complete SDK startup tests plus file/inline failure tests. Cleanup failures remain aggregate ShutdownFailed rather than discovery diagnostics |
| Live → closing → closed; synchronous seal, one shared Promise/outcome | Complete SDK and runtime suites preserve repeated Promise/outcome identity and reject closed work; detached callbacks cannot acquire resources after successful close |
| Reload/replacement drains old work, preserves durable pending state and bindings | All 127 host parity cases pass, including pending gates, sibling workflows and reentrant replacement. Failed transactional reload restores the surviving runner with a fresh input bridge; old captured functions stay closed |
| Cancellation, tasks, persistence, subscriptions, aggregate errors and borrowed ownership | Current lifecycle/queue/task selections pass. Shared managers, loaders, stage owners and siblings retain their existing tests |
| Exact actual AgentSession, dispose Promise<void>, synchronous setters and optional fields | Session result, setter and host-input signatures unchanged; source regression asserts setThinkingLevel returns undefined. Normal build/check pass; internal runner ownership methods add no new public manager/result shape |
| Raw input, duplicate values and order preserved | Existing A–E parity passes. Overlap fixture checks exact `  raw\n` payload; no normalization, deduplication or uniqueness rule added |
| Natural Node exit without forced exit/private DBOS cleanup | New 11-case built fixture and all prior host fixtures exit normally using public disposal. Authored workflow source hash remains `aee794cfa82fe248928ab07ec0964752c59a0bfc8ff685f814f710f9c4c61db2` |
| Independent checkout initialization; no workflows compile pipeline | npm ci --ignore-scripts and initial npm run build passed, `/tmp/3105-f-cont-{install,initial-build}.log`; normal final build passed |
| Vertical red-green and durable coverage in both named files | `/tmp/3105-f-cont-{path,input,thinking,dispatch,shortcut,specialized,causes}-red.log` retain public failures; corresponding regressions pass in complete SDK/host runs. New built fixture is `test/fixtures/sdk-host-dispatch-lifecycle.mjs` |
| Required build/check and all affected tests | Final commands/counts below; no new skips or weakened acceptance |
| Supplemental qlty preserving repository gates | Existing config unchanged; smells/metrics exit 0, warnings retained. New extension-work helper has no reported smells; existing publisher complexity 27 remains visible |
| Actionable SDK guide and Unreleased notes | Guide explains callback settlement and reacquiring dialogs after failed reload; one Fixed entry covers shipped behavior. Released sections unchanged |
| Signed conventional commit, normal hooks and model attribution | Delivery uses normal signed commit with Refs #3105 and Assistant-model: GPT-6-Astra; exact SHA/signature/clean status are in the handoff receipt |
| Designated checkout/branch, prior commits, no publication/G/H work | Only feat/3105-sdk-f changed. No push, PR, merge, release or other worktree writes |

### Current commands and results

Full exact selectors and log names are recorded in `/tmp/3105-f-cont-commands.txt`.

- `npm run build` and `npm run check`: exit 0, `/tmp/3105-f-cont-final-{build,check}.log`.
- Complete SDK parity and affected coding-agent lifecycle/resource/CLI/settings selection: **72 files, 613 passed**, 14 unchanged credential/PowerShell skips in two wholly skipped files; `/tmp/3105-f-cont-final-core.log`.
- `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts`: **127/127 passed**, `/tmp/3105-f-cont-final-host.log`.
- Affected root lifecycle and workflow-observation selection: **48 files, 477 passed**, `/tmp/3105-f-cont-final-unit.log`.
- Queue/shell/kill plus workflow activity/UI/input event selection: **15 files, 121 passed**, one existing platform skip; `/tmp/3105-f-cont-observers-queues.log`.
- Task adapter/command/kill/stage/contract/subscription selection: **8 files, 49 passed**, `/tmp/3105-f-cont-tasks.log`.
- Five exact review invocations: all exit 0, `/tmp/3105-f-cont-exact-green.log`. Thinking result is closedBeforeRelease=false, active=0, shutdowns=1.
- Supplemental `qlty smells --no-upgrade-check --no-duplication` and `qlty metrics --no-upgrade-check --functions`: exit 0, `/tmp/3105-f-cont-{qlty,metrics}.log`. They supplement, not replace, normal Biome/typechecks.

### Regression decisions and limits

The new dispatch accounting exposed two queue timing failures in the unchanged Escape/recovery suites. Agent-core had consumed steering text before serialized extension-event handling removed it from the session queue. Admission bookkeeping now runs synchronously when the event arrives; public notifications remain serialized. Both original failures pass without changed assertions, `/tmp/3105-f-cont-queues{,-green}.log`.

Two old fixtures assumed behavior the required drain forbids. The model lifecycle fixture now supplies fresh reload registrations instead of reusing an invalidated stub runtime; its startup/shutdown assertion is unchanged. The binding-overlap fixture independently releases old preflight before waiting for successor binding, explicitly checks no shutdown or binding occurred while preflight was suspended, and retains its concurrent/nested binding assertions. Initial failures remain in `/tmp/3105-f-cont-{core,host}.log`; complete reruns pass. Rejected-reload Herdr reporting also passes unchanged after restoration of the surviving runner.

Resolved temporary F notes were removed from case-insensitive `issues.md` without deleting the existing unrelated `ISSUES.md` content. No callback deadline, forced process exit, new manager, payload policy or tenant-sandbox promise was added. Public inspection remains available after closure.

Evidence is local macOS arm64 Node 26.8.2, Bun 1.4.2, deterministic inference and built workspace exports. Packed declaration/consumer closure, G services, unexecuted platforms/live credentials, remote CI and Greptile/conditional cumulative merge remain later-slice/parent work. The earlier native spool observation remains unattributed; no repair is claimed. No newly discovered out-of-scope change was made.

### Contract amendments received

"make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback" remain parent-owned publication gates. This child does not publish or claim the overall user task complete.

## Latest review repair contract

The previous readiness claim is superseded by three reproduced failures. Frozen F acceptance now maps queued completion persistence to the persist/control public probe, reload preparation rollback and aggregate causes to both preparation probes, and current/superseded summary settlement to the independently released provider probe. All three require public source and built Node regressions, normal build/check, complete parity and affected suites, updated guides/Unreleased notes, and a signed clean commit. Existing API identity, raw inputs, admission seal, borrowed ownership, sibling survival and prior tests remain required; no G/H work or publication is included.

### Repair evidence at the latest continuation

All three latest reviewer roots are repaired. The persisted tests are the five public cases at the end of `sdk-builtin-parity.test.ts` and the six `built Node completion persistence and cleanup` cases in `sdk-builtin-host-parity.test.ts`, backed by `sdk-host-completion-cleanup.mjs`.

| Requirement / state boundary | RED and current evidence |
| --- | --- |
| Active → closing drains already-admitted events and persists completed messages | Exact persist probe and source test failed with empty history. Completion delivery now explicitly retains its existing admission through the serialized event queue; fresh dispatch remains sealed. Source test checks start/end ordering and both persisted roles; Node fixture checks raw text. Exact control and repaired probe pass |
| Reload preparation failure → candidate rollback, old generation survives | Both exact probes and two source cases failed with candidate 2 still live. Existing acquisition ledger now encloses transactional preparation. Every successful factory rolls back if preparation rejects; original and both earlier/later cleanup causes remain in ShutdownFailed. Tests require active=[1] after failure, shutdowns=[2,1] and active=[] after final close |
| Current/superseded summary execution → cancellation → settlement → cleanup | Exact summary probe and one/two-summary source cases failed with close already resolved. Every summary launch uses existing session work accounting, retaining superseded settlement receipts; generation abort is combined with local cancellation. Source and Node cases require close pending before independent release, all signals aborted, zero active providers and no stale summary entry. Node also checks reload |
| Exact APIs, raw values, ordering, borrowed ownership and sibling isolation | No session result/setter/dispose signature or payload policy changes. Existing parity, replacement, shared-owner and stage tests remain in complete passing selections. Caller managers and old reload generation are not rolled back |
| Aggregate failure and repeated close | Failed preparation cleanup reaches existing reload failure retention, so reload and later disposal remain ShutdownFailed; all causes are checked. Existing repeated-close and component-attempt regressions pass |
| Build/check, both complete parity files and affected suites | Commands/counts below. No new skips or removed assertions |
| Docs, Unreleased, signed commit and no publication | SDK guide and current Unreleased explain queued persistence, summary settlement and candidate rollback. Normal signed commit/hook evidence is recorded in the handoff. No other checkout, G/H implementation or publication |

Exact commands: `/tmp/3105-f-next-commands.txt`. Debugger execution receipt: `/tmp/3105-f-next-execution.md`; run identity `a568fef9`, progress artifact under `subagent-artifacts/progress/a568fef9/progress.md`.

- Fresh normal `npm run build` and `npm run check`: exit 0, `/tmp/3105-f-next-{build,check}.log`.
- Complete affected coding-agent selection: **72 files, 618 passed**, 14 unchanged credential/platform skips; `/tmp/3105-f-next-core-rerun.log`.
- Complete host parity: **133/133 passed**, `/tmp/3105-f-next-host.log`.
- Root lifecycle selection: **48 files, 477 passed**, `/tmp/3105-f-next-unit.log`.
- Observer/queue selection: **15 files, 121 passed**, one existing platform skip; `/tmp/3105-f-next-queues.log`.
- Task selection: **8 files, 49 passed**, `/tmp/3105-f-next-tasks-rerun.log`.
- Final primary SDK suite after removing a no-op test cleanup: **94/94 passed**, `/tmp/3105-f-next-sdk-final.log`.
- Exact five latest invocations, including the persistence control: exit 0, `/tmp/3105-f-next-exact-green.log`. Six built Node cases exit naturally, `/tmp/3105-f-next-node-green.log`.
- Supplemental qlty smells/metrics exit 0, `/tmp/3105-f-next-{qlty,metrics}.log`; pre-existing large-module complexity remains reported, not suppressed. Config unchanged; normal Biome/typechecks remain authoritative.

RED evidence: `/tmp/3105-f-next-{exact,persist,events,prepare,summary}-red.log`. The first persistence test scaffold awaited a serialized agent-end event before independently releasing agent-start and timed out; its corrected provider-completion barrier then reproduced the real empty-history assertion. A supplemental SDK-only command's shell budget expired at 120 seconds; its full rerun with a sufficient command budget passed in 151 seconds without changing test budgets.

The known native spool observation recurred in the first broad core run and first task selection (`SpawnFailed: Output spool unavailable`). The unchanged isolated shell suite passed 15 tests; unchanged complete reruns passed 618 and 49 tests respectively. Bounded inspection locates failure at native spool `create_new` open but does not establish its OS error or cause. No native fix, retry masking, skipped assertion or universal absence of that intermittent failure is claimed. Logs retain both failures. Temporary resolved F notes were removed while unrelated `ISSUES.md` content remains unchanged.

Evidence remains local macOS arm64 Node26.8.2 with deterministic providers and built exports. G/H, packed strict declaration closure, other platforms/live credentials, and parent-owned exact-head CI/Greptile/conditional merge remain deferred exactly as before. No new out-of-scope feature or refactor was added.

## Third continuation batch from `0753e58b`

This section supersedes the preceding readiness claim. The latest nine findings reduce to three reproduced roots: command-initiated replacement self-drain, nontransactional reload acquisition rollback, and admitted tool-result completion. Scope remains F, with all prior tests and commits preserved.

| Required behavior / transition | Current evidence |
| --- | --- |
| Command → retirement → successor without circular wait | Public source test and `sdk-host-retirement-completion.mjs command` hold unrelated thinking work, require generation 1 until peer release, then permit generation 2 and the original command continuation. Old fresh prompt/input admission remains sealed |
| Retirement is not terminal cleanup | Same source/Node tests suspend the command after replacement returns. Both old-session and runtime disposal remain pending; shutdown runs only after independent continuation release and removes its late acquisition. Direct replacement control still shuts down the old generation before creating the successor |
| Deferred failures remain explicit; failed replacement still cleans retained ownership | Node `command-cleanup` requires ShutdownFailed from both session and runtime disposal. `command-create-failure` requires creation rejection, allows the command to settle, then completes retained cleanup. No blanket terminal caller exclusion or successful timeout |
| Ordinary reload failure → rollback, preserving borrowed discovery | Two public source cases and Node `ordinary`/`ordinary-cleanup` require only borrowed resource 1 to survive, with candidate 3 released. Cleanup failure remains ShutdownFailed through reload and final disposal. Existing transactional cases remain green |
| Admitted tool execution → result hook → persistence during close | Public source and Node `tool`/`tool-control` preserve one result hook, success status, exact `  completed\n` content and `{completed: true}` details. No repeated tool effect; fresh dispatch stays sealed |
| Prior A–E/F, exact API identity, payload/order/optional fields, sibling and stage ownership | Complete SDK/host/affected selections below retain prior assertions. Actual AgentSession identity and public dispose/setter signatures are unchanged; no wrapper, input normalization or new manager API |
| RGR and both required parity files | Exact three negative probes failed before runtime edits; tool, ordinary rollback and command source regressions failed before their individual repairs. Four source cases and seven built Node scenarios are persisted in the named parity suites |
| Build/check, docs, normal hooks, signed clean commit | Normal build/check pass; guide explains command handoff versus final disposal and ordinary reload. Unreleased Fixed entry added, released sections unchanged. Commit/signature/clean status recorded in execution receipt |
| No publication, other worktree or later-slice implementation | All changes are in feat/3105-sdk-f. G/H, packed consumers/platform/live-provider and parent publication gates remain outside this slice |

The command fix uses the existing admitted-work ancestry and shared close. Its retirement receipt drains peers, but the full close still drains every admitted operation, including the invoking command, before shutdown and persistence. The runtime retains that full receipt even after publishing a successor and aggregates deferred failures. This follows the supervisor's scoped-handoff decision; it does not treat replacement return as completed disposal.

Exact commands and log paths: `/tmp/3105-f-third-commands.txt`. Debugger execution receipt: `/tmp/3105-f-third-execution.md`, writer run `6d36cec7`; prior debugger `35bd94b7` handed off a design question before editing.

- `npm run build`, `npm run check`: exit 0, `/tmp/3105-f-third-{build,check}.log`.
- Complete SDK/affected coding-agent selection: **72 files, 622 passed**, 14 unchanged credential/platform skips, `/tmp/3105-f-third-core.log`.
- Complete host parity: **140/140 passed**, `/tmp/3105-f-third-host.log`.
- Root lifecycle: **48 files, 477 passed**, `/tmp/3105-f-third-unit.log`.
- Observer/queue selection: **15 files, 121 passed**, one existing platform skip, `/tmp/3105-f-third-queues.log`.
- Task selection: **8 files, 49 passed**, `/tmp/3105-f-third-tasks-rerun.log`.
- All five exact probe/control invocations and all seven built Node modes: exit 0, `/tmp/3105-f-third-{exact,node}-green.log`.
- Supplemental qlty smells/metrics: exit 0, `/tmp/3105-f-third-{qlty,metrics}.log`. Existing large-module warnings remain visible; no config or suppression change.

RED logs are `/tmp/3105-f-third-{exact,tool,ordinary,command}-red.log`. Initial command test setup had no reasoning-capable model and never reached the thinking barrier; adding its explicit fixture model exposed the actual circular-wait assertion. Build caught unsupported Promise.withResolvers in the source target and a boolean-return mismatch; both were corrected without changing the target or API. Final tests use independent release and natural Node exit, not forced termination.

The first task selection again hit the already-disclosed native `SpawnFailed: Output spool unavailable`; the unchanged complete rerun passed. Its source/OS cause remains unattributed and no native fix or stable-absence claim is made. Temporary F debugging notes were removed; unrelated ISSUES.md content is unchanged. Local evidence remains macOS arm64 Node26.8.2 and deterministic providers with built workspace exports, not packed H or remote CI proof.

### Contract amendments received

"make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback" remain parent-owned gates. No publication occurred in this child.

## Fourth continuation contract

Repair the latest consolidated F batch without widening the contract. Concurrent replacement commands must hand off without circular peer draining while final disposal retains every continuation; transactional settings/resource publication failures must clean the candidate; unpublished MCP cleanup failures must remain explicit ShutdownFailed. Public source and built Node regressions, exact negative probes and controls, normal build/check and affected suites are the acceptance oracles. Existing ownership, payload, API and prior regression requirements remain unchanged.

### Fourth batch acceptance and evidence

| Required boundary | Repair and current evidence |
| --- | --- |
| Two admitted commands → retirement → successors without circular waiting | Register replacement ancestry before publication waits, retaining it until callback settlement. Peer drain wakes when another admitted command joins retirement. Source single/dual cases and built `command-dual` require generations=3 and both returns while unrelated work still drains |
| Terminal disposal owns every continuation | Existing single-command and extended dual-command cases independently release post-return continuations only after both old-session/runtime disposal remain pending. No terminal exclusion was added; deferred failures remain covered by prior Node cases |
| Candidate startup → settings commit/activate/resource commit → installed, or rollback | All publication callbacks remain inside candidate cleanup. Four source cases and built activate/commit/settings/activate-cleanup/control cases preserve the original generation, release candidates, and retain aggregate cleanup failure |
| MCP retired initializer → candidate cleanup → explicit success/failure | Actual adapter with controlled initializer is exercised through public create/dispose in source and Node tests. Failure retains original/cleanup causes and returns ShutdownFailed; the control releases its resource. OAuth cleanup is attempted in both. This is deterministic adapter lifecycle proof, not G live-service coverage |
| Prior F/A–E APIs, raw text, optional fields, ordering, borrowed/sibling resources | Public API signatures and payload policy unchanged; complete parity, queue, replacement, workflow and ownership selections remain passing. No new manager, normalization, test skip or borrowed-resource shutdown |
| RGR, both named parity files, normal build/check, docs and signed clean delivery | Exact RED logs precede repairs; source/public Node regressions persist. SDK and MCP guides plus Unreleased notes describe repaired behavior. Commit/hook/signature receipt is in the execution handoff |

Commands are recorded in `/tmp/3105-f-fourth-commands.txt`; debugger run `4bc671ac`, execution receipt `/tmp/3105-f-fourth-execution.md`.

- Normal `npm run build` and `npm run check`: exit 0, `/tmp/3105-f-fourth-final-{build,check}.log`.
- Complete coding-agent selection: **72 files, 627 passed**, 14 unchanged credential/platform skips, `/tmp/3105-f-fourth-core.log`.
- Complete host parity: **148/148 passed**, `/tmp/3105-f-fourth-final-host.log`.
- Root lifecycle plus affected MCP: **54 files, 492 passed**, `/tmp/3105-f-fourth-final-unit.log`.
- Observer/queue: **15 files, 121 passed**, one unchanged platform skip, `/tmp/3105-f-fourth-queues.log`.
- Tasks: **8 files, 49 passed**, `/tmp/3105-f-fourth-tasks.log`.
- Seven exact probe/control invocations and eight built Node modes: all exit 0, `/tmp/3105-f-fourth-{exact,node}-green.log`. MCP failure intentionally retains active=1 because its cleanup throws; the oracle requires explicit ShutdownFailed, not fabricated successful release. Control active=0.
- Supplemental qlty smells/metrics exit 0, `/tmp/3105-f-fourth-{qlty,metrics}.log`. Existing large-module complexity warnings remain visible; no suppression/config change.

RED logs: `/tmp/3105-f-fourth-{exact,command,publication,mcp}-red.log`. The first command test scaffold shadowed the path `join` import; after renaming its barrier, single passed and dual reproduced the actual circular wait. The first Node MCP fixture accidentally bundled an unmocked `.ts` direct-tools import; matching both source suffixes removed that fixture-only diagnostic. The first root selection caught an extra aggregate wrapper changing the existing cleanup error shape; preserving the original shape when there is no unpublished failure made the unchanged assertion and complete rerun pass. None was suppressed or counted as passing evidence.

Temporary F debugging notes are removed; unrelated ISSUES.md content is unchanged. The prior native spool flake did not recur in this batch, but its cause remains unattributed and no native repair is claimed. Evidence is local macOS arm64 Node26.8.2, deterministic inference and built workspace exports. G/H, packed/platform/live-provider coverage and parent publication/CI/Greptile gates remain deferred. No push, PR, merge, release or other-checkout writes.

### Contract amendments received

"make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback" remain parent-owned gates.

## Fifth continuation contract

Preserve retiring-generation cleanup across all postcommit runtime reconstruction, including a throwing custom loader. Public failure/control and shutdown/invalidation failure cases must retain original and cleanup causes, clean both owned generations, preserve borrowed state, and pass build/check and complete parity/affected gates. Scope remains F; no publication or later-slice implementation.

### Fifth batch acceptance and evidence

The single consolidated root is repaired. Immediately after publication, the started candidate remains reachable from the session. Runtime reconstruction is captured separately from retiring shutdown and invalidation; all cleanup attempts run and aggregate failures retain the original setup cause. A plain reconstruction failure remains its original error when cleanup succeeds. No new API, owner manager or payload policy was introduced.

| Required boundary | Current evidence |
| --- | --- |
| Postcommit rebuild failure retains both owners | Exact failure/control plus four source and four built Node cases require only candidate 4 after reload and no active resources after disposal; shutdown order is retiring 2 then candidate 4 |
| Every retiring cleanup attempted; causes preserved | Source/Node shutdown and invalidation failure variants require the original setup error plus cleanup failure, invalidation attempted, and later disposal reporting ShutdownFailed rather than success |
| Prior ownership, generation admission, APIs, raw data, sibling/stage resources | Complete SDK, host, lifecycle, queue and task selections pass unchanged prior assertions; public return identities/signatures and caller payload policy unchanged |
| Durable RGR in both named parity suites | Exact failure exits1 before fix; source3 fail/1 control pass before fix,4 pass afterward. Built fixture sdk-host-postcommit-cleanup.mjs exits naturally in all4 modes |
| Build/check, documentation, Unreleased, signed clean delivery | Normal gates below pass; SDK guide and Unreleased explain postcommit cleanup and causes. Normal signed commit/hook evidence is recorded in execution receipt |

Debugger run `6635905d`; `/tmp/3105-f-fifth-execution.md` records execution. Exact commands and selectors: `/tmp/3105-f-fifth-commands.txt`.

- Normal `npm run build` and `npm run check`: exit0, `/tmp/3105-f-fifth-{build,check}.log`.
- Complete coding-agent selection: **72 files,631 passed**,14 unchanged credential/platform skips, `/tmp/3105-f-fifth-core.log`.
- Complete host parity: **152/152 passed**, `/tmp/3105-f-fifth-host.log`.
- Root lifecycle/MCP: **54 files,492 passed**, `/tmp/3105-f-fifth-unit.log`.
- Observer/queue: **15 files,121 passed**,one unchanged platform skip, `/tmp/3105-f-fifth-queues.log`.
- Tasks: **8 files,49 passed**, `/tmp/3105-f-fifth-tasks.log`.
- Exact failure/control and four new Node modes: all exit0, `/tmp/3105-f-fifth-exact-green.log`; RED `/tmp/3105-f-fifth-{exact,source}-red.log`.
- Supplemental qlty smells/metrics: exit0, `/tmp/3105-f-fifth-{qlty,metrics}.log`. Existing large-module warnings retained; config unchanged, no suppression.

All runtime/test edits preceded these gates; only documentation and receipts followed. Temporary resolved F notes were removed while unrelated ISSUES.md content remains unchanged. No new skips, softened assertions, forced exit, private DBOS cleanup, other worktree writes or publication. The known native spool flake did not recur, but its cause remains unattributed and no repair is claimed. Evidence remains local macOS arm64 Node26.8.2 deterministic built exports, not G/H packed/live/platform or parent CI/publication proof.

### Contract amendments received

"make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback" remain parent-owned gates.

## Sixth continuation contract

Repair the latest three reload ownership roots within F: preparation acquisitions remain owned until transfer or cleanup, failed candidate callbacks drain before shutdown, and self-reload command continuations retain their generation cleanup until settlement. Public source and built Node failure/control pairs, aggregate cleanup failures, borrowed discovery preservation, normal build/check and complete focused gates are required. Prior API, payload, ownership and A–E/F acceptance remains unchanged. No publication or G/H work.

### Sixth batch lifecycle-map verification

All three consolidated roots are repaired. These rows connect the touched transfer boundaries from `continuation-1/lifecycle-map.md` to executed fault/interleaving checks, not inspection alone.

| Map boundary and state transition | Current executable evidence |
| --- | --- |
| §3 acquisition ledger → candidate ownership → commit or rollback | Seven new public source cases include preparation success, beforeSessionStart rejection and discovery cleanup failure. Built `acquire-success`, `acquire-failure`, `acquire-cleanup` and exact subclass/plain probes release discovery3 and candidate4 as appropriate, preserving borrowed1. Untransferred acquisitions remain in the enclosing reload ledger; adopted factories transfer explicitly to runner cleanup |
| §6/§7 admitted candidate callbacks → seal → drain → shutdown | Source candidate cases and built `candidate`/`candidate-cleanup` independently hold a bus callback after startup rejects, verify no shutdown or reload settlement before release, then require zero resources. Built scenarios overlap terminal disposal with rollback. Cleanup failure remains ShutdownFailed |
| §4/§7 reload caller → continuation → retained generation cleanup | Source self-reload cases and built `self`, `self-cleanup`, `self-ordinary`, `self-twice` hold continuation after reload returns, verify final disposal remains pending, then require old cleanup after late acquisition. Ordinary and successive reloads preserve the same ownership. Deferred failures survive until final disposal; terminal drain excludes no caller |
| §7 publication/failed-reload restoration and §8 all-cleanup invariant | Existing full publication, postcommit, initial-startup, borrowed loader, concurrent command replacement and durable workflow parity tests pass. Postcommit shutdown assertions now require discovery3 cleanup as well as retiring2 and candidate4, retaining the prior started-generation order |
| Public API identity, optional fields, raw/ordered inputs, borrowed siblings/stages | No public session result, dispose/setter signature or payload policy changes. Complete prior A–E/F parity, queue, task and lifecycle selections pass; original borrowed discovery is not shut down |
| RGR, guides/Unreleased, signed clean delivery and no publication | Exact three failures and all seven new source cases reproduced before their respective edits. SDK guide and Unreleased describe the repaired ownership boundaries; normal signed commit and hook evidence is in the execution receipt |

Commands and selectors: `/tmp/3105-f-sixth-commands.txt`. Debugger run `8c13a9de`, execution receipt `/tmp/3105-f-sixth-execution.md`.

- Normal `npm run build` and `npm run check`: exit0, `/tmp/3105-f-sixth-build.log` and `/tmp/3105-f-sixth-final-check.log`.
- Complete coding-agent selection: **72 files,638 passed**,14 unchanged credential/platform skips, `/tmp/3105-f-sixth-core-green.log`.
- Complete host parity: **161/161 passed**, `/tmp/3105-f-sixth-host.log`.
- Root lifecycle/MCP: **54 files,492 passed**, `/tmp/3105-f-sixth-unit.log`.
- Observer/queue: **15 files,121 passed**,one unchanged platform skip, `/tmp/3105-f-sixth-queues.log`.
- Tasks: **8 files,49 passed**, `/tmp/3105-f-sixth-tasks.log`.
- Six exact failure/control invocations and nine built Node modes: exit0, `/tmp/3105-f-sixth-{exact,node}-green.log`. RED logs: `/tmp/3105-f-sixth-{exact,acquisitions,candidate,caller}-red.log`.
- Supplemental qlty smells/metrics: exit0, `/tmp/3105-f-sixth-{qlty,metrics}.log`; existing large-module complexity remains visible, no configuration/suppression change.

The first broad core run found four postcommit assertions expecting only started-generation shutdowns `[2,4]`; they now require `[3,2,4]`, including the newly required preparation cleanup. The corresponding Node fixture retains the same stronger order assertion. The first ordinary self-reload fixture had no preloaded caller subclass discovery and exited13 before reaching its command; it now uses the documented loader setup and passes. A new test's getter-identity assumption was narrowed to failed transactions because successful custom-loader commit already updates discovery; borrowed resource preservation is still checked in every case. No existing assertion was suppressed or test skipped.

Remaining evidence limits are unchanged: noncooperative callbacks require independent settlement; this does not forcibly terminate host code. G/H packed declarations/consumers, live services, other platforms and parent CI/publication gates are unexecuted here. The prior native spool observation did not recur and remains unattributed. No additional boundary defect is established by these checks; this is bounded verification, not an exhaustive claim about arbitrary host callbacks. Temporary F notes were removed while unrelated ISSUES.md remains unchanged. No publication, other-worktree write, forced exit or private DBOS teardown occurred.

### Contract amendments received

"make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback" remain parent-owned gates.

## Seventh continuation: frozen invariant delta (baseline `009b389e4`)

The prior readiness claim is superseded by two reproduced ownership/authority failures. This supplements the existing lifecycle map; it does not replace it.

| Invariant and transition | Materially distinct paths/adapters | Required regression dependencies and acceptance |
| --- | --- | --- |
| Every creation-owned factory transfers explicitly or is cleaned; selection is not ownership | SDK default discovery and unloaded caller DefaultResourceLoader with extensionsOverride; selected and omitted factories sharing one runtime; startup rollback | Subset, none and unfiltered selection; exact registrations/startup; omitted cleanup failure and later startup failure; cleanup exactly once; selected API, bus and task capabilities survive omitted cleanup. Retain borrowed/custom-loader/sibling and constructor rollback suites |
| Retired authority ends before successor admission, independently of retained cleanup | Transactional and ordinary reload; captured extension API and context; invoking command continuation; terminal disposal and successive reload | During independent continuation hold both external mutation and task-host admission reject; fresh successor works. Disposal remains pending until independent release; late owned acquisition is cleaned; deferred shutdown failure remains ShutdownFailed. Preserve ordinary/successive reload, replacement reentrancy, durable workflow and input controls |

Exact baseline probes: `node /tmp/3105-f-completion-filtered-acquisition.mjs filter` exit1 (omit remains active), `control` exit0; `node /tmp/3105-f-risk-retired-external.mjs failure` exit1 (external-stale-write and hostAcquired=true), `control` exit0. Logs `/tmp/3105-f-seventh-{filter-red,filter-control,authority-red,authority-control}.log`.
Acceptance requires durable public SDK and natural-exit built Node host tests, build/check, complete SDK including review files, complete host parity and existing core/root/queue/task selections. API identity, raw payloads, aggregate failures and borrowed ownership remain frozen. Packed G/H/platform/live/remote coverage remains outside F.

### Seventh batch executed acceptance

Both remaining roots are repaired. Selection transfers only adopted factories; omitted acquisitions receive cleanup without invalidating a shared selected runtime. Reload revokes old API/context authority before reopening admission, separately from its retained continuation/drain/shutdown receipt. Shutdown dispatch has scoped cleanup access that expires when dispatch settles. No session API, payload policy or manager was introduced.

| Invariant | Affected paths | Executed assertion/log | Residual gap |
| --- | --- | --- | --- |
| Every owned acquisition transfers or is cleaned, despite selection | `sdk.ts`, `extensions/loader-rollback.ts`; SDK and host parity, `sdk-host-filtered-acquisition.mjs` | `filtered creation owns every acquisition`: subset/none/all/startup/cleanup; exact selected commands/startup, selected mutation/task-host/bus capabilities, cleanup exactly once and retained cause. RED4 failures/1 control; GREEN5. `/tmp/3105-f-seventh-filter-source-{red,green}.log`; built natural-exit modes in `node-final.log` | Borrowed discovery remains caller-owned; existing sibling/custom-loader cases rerun |
| Retired authority ends before successor admission; cleanup remains owned | `extensions/extension-work.ts`, `extensions/runner.ts`, `agent-session-extension-bindings.ts`; both parity files and `sdk-host-reload-ownership.mjs` | Held self-reload rejects both external mutation and task host; fresh successor works; terminal close remains pending; late acquisition cleaned and deferred failure retained. Source RED2; final focused GREEN9 including existing shell controls. Built self/self-cleanup/self-ordinary/self-twice pass in `node-final.log` | Noncooperative callbacks still require settlement; not a sandbox |
| Shared boundaries preserve cancellation, reentrancy, aggregate failures and API/raw payload behavior | Existing complete SDK/review, host, lifecycle, queues/tasks selections | Complete final gates below; ordinary reload exact control and all14 ownership fixture modes exit0 | G/H packed/platform/live/remote evidence remains unexecuted |

Exact commands and log mapping: `/tmp/3105-f-seventh-commands.txt`. Candidate is the signed commit containing this section; its exact SHA/signature is recorded in `/tmp/3105-f-seventh-execution.md` after commit. Baseline `009b389e4` and all prior A–E/F commits are preserved.

- `npm run build` and `npm run check`: exit0, `/tmp/3105-f-seventh-{build,check}-final.log`.
- Complete affected coding-agent selection including SDK review files: **72 files,643 passed**,14 unchanged credential/platform skips, `/tmp/3105-f-seventh-core-final.log`.
- Complete host parity: **166/166 passed**, `/tmp/3105-f-seventh-host-final.log`.
- Root lifecycle/MCP: **54 files,492 passed**, `/tmp/3105-f-seventh-unit-final.log`.
- Observer/queues: **15 files,121 passed**,one unchanged platform skip, `/tmp/3105-f-seventh-queues-final.log`.
- Tasks: **8 files,49 passed**, `/tmp/3105-f-seventh-tasks-final.log`.
- Four exact failure/control invocations and14 built Node modes all exit0, `/tmp/3105-f-seventh-{exact,node}-final.log`. Durable host baseline RED2: `/tmp/3105-f-seventh-host-red.log`.
- Supplemental qlty smells/metrics exit0, `/tmp/3105-f-seventh-{qlty,metrics}.log`; existing config unchanged. Large-module warnings remain, including constructAgentSession130 and reloadOwnedGeneration41. These do not replace build/check.

The first broad core run caught two fresh-shell regressions: a runner context check consulted an invalidated runtime reused by an empty loader. Restricting that check to the explicitly retired runner preserves fresh contexts; both unchanged tests and the complete rerun pass. Initial new-test scaffold errors (command getter name, existing session-name trimming and aggregate startup error shape) were corrected before recording genuine RED. No old assertion was softened or skipped. Final source/test edits preceded every final gate; only guides, Unreleased and evidence notes followed. Temporary F notes were removed with unrelated `ISSUES.md` unchanged. No prior native spool failure recurred; no native repair is claimed. No install, forced exit, private DBOS cleanup, delegation, other-checkout edit or publication occurred.

## Eighth continuation: shared-boundary map delta

Baseline `6fd5f465` fails the supplied filtered subscription/reload, retired-shutdown and direct execution admission probes; unfiltered control passes. Previous completeness claims do not cover these boundaries.

| Boundary | Source-grounded ownership and authority paths | Repair and dependency checks |
| --- | --- | --- |
| Factory API and subscription lifetime | `loader-core.loadExtensionFromFactory` creates one API transaction per Extension; `loader-api` registrations target invocation-remapped extensions while actions use the shared runtime. Bus unsubscriptions belonged only to that runtime. `loader-rollback` shut omitted instances down but could not retire their API/subscriptions independently | Retire each omitted instance and release its subscriptions even on cleanup failure; preserve selected shared runtime. Creation `sdk.ts` already passes retained runtimes; transactional `reloadOwnedGeneration` and ordinary reload's enclosing ledger must preserve transferred runtime too. Subset/none/all and rollback aggregates; borrowed replay remains a distinct fresh factory instance through loader-bindings |
| Dispatch versus direct actions | Generic/specialized runner dispatch, shortcuts and bus handlers enter `trackExtensionWork`; commands were tracked only by their outer session prompt, not the generation. Direct loader API exec/mutations/registration only called assertActive. `sealHostInput` seals runtime work synchronously for close and reload but did not fence these actions | Enforce runtime admission for direct actions while retaining admitted completion and shutdown cleanup. Track commands through existing `runResourceRegistrationBatch` and direct subprocess completion through `trackExtensionWork`. Abort does not seal. Failed reload resumes the original runtime; terminal close never resumes |
| Cleanup permission versus successor authority | `revokeExtensionAuthority` replaces assertActive with a blanket cleanup ALS exemption; runner context checks use that same exemption. Deferred self-reload shutdown therefore reaches new task owner, session mutation and shared bus | Separate scoped cleanup/inspection from authority for new work or successor mutation. Retain retired resource cleanup, read-only context, captured unsubscribe/publisher disposal and aggregate failure. Both transactional/ordinary retirement invoke revokeAuthority; replacement uses shared close and cannot publish until retirement boundary |
| Unaffected contracts from actual callers | `runResourceRegistrationBatch` already tracks dispatch and checks admission; host-input bridge independently seals requests; session public prompt/tasks/model/binding gates use session closure. Borrowed managers are explicit raw objects, not API proxies | Keep prior dispatch drain, copied-registration, stage-owner, sibling, cancellation/reentrancy and raw payload tests. No new manager or restrictions on caller-owned managers; no changes to provider/tool schemas or public method signatures |

### Eighth batch executed acceptance

All four consolidated roots are repaired at the existing factory, runtime action and shared handoff boundaries. Omitted factories have individual API/subscription retirement; selected runtime ownership is preserved in creation and both reload paths. Cleanup-scoped inspection no longer authorizes actions against the successor. Retired cleanup emissions are dropped rather than delivered into the successor. The shared close handoff also revokes authority before publishing a command-initiated replacement.

| Invariant | Paths | Exact executed assertions and evidence | Residual limit |
| --- | --- | --- | --- |
| Omitted factory release without selected capability loss | `loader-api.ts`, `loader-rollback.ts`, SDK creation; transactional and ordinary reload in `agent-session-extension-bindings.ts` | Public source `filtered creation owns every acquisition` and `filtered reload preserves owner boundaries`: subset/none/all, startup/rollback/cleanup, omitted API throws, omitted deliveries zero, selected command/task host/subscription works, every owned shutdown once. Built filtered fixtures10 modes exit0; exact review subscription/reload probes pass. Ordinary subclass supplemental probe preserves borrowed generation1 and selected generation4 delivery1, omitted deliveries0 | Borrowed discovery remains caller-owned; no change to arbitrary factory external side effects |
| New direct actions refuse synchronously; admitted work drains | `extension-work.ts`, `loader-api.ts`, `runner-context.ts`, `runner.ts` | `direct extension admission seals before awaiting`: close/reload/rollback/cancel; exec, mutation, command registration and subscription refuse before awaiting and while suspended; ready/post-abort and post-rollback/fresh successor exec succeed. `direct extension execution drains before shutdown` holds child until independent release. Built direct fixture5 modes exit0 | Caller cancellation/timeout remains available for subprocesses; noncooperative work requires settlement |
| Cleanup is not successor authority | `extension-work.ts`, `loader-api.ts`, `runner-context.ts`, shared close handoff in `agent-session-events.ts` | `self reload retains invoking continuation cleanup` preserves context/name inspection and late resource cleanup, rejects old mutation/task host and observes no retired delivery; cleanup-failure variant retains ShutdownFailed. Built self/self-cleanup/self-ordinary/self-twice pass. New public replacement regression and built command-retired prove no event reaches a live successor sharing the bus | Raw borrowed managers remain actual caller objects, not a sandbox |
| Commands retain admitted continuation ownership | `runner.getCommand` now enters the same batch/work boundary as other dispatch | First broad core run reproduced missing generation tracking in unchanged `command replacement drains peers and retains 2 continuations until terminal cleanup`; both1/2 cases pass after shared command tracking, as do existing reentrant reload/replacement and terminal drain cases | No per-command-name guards or new manager |
| Prior A–E/F, aggregate failures, siblings and public shapes remain | Complete SDK/review, host, core, root, queues/tasks and affected extension suites | Final counts below; exact API compile checks actual AgentSession, Promise<void> disposal, non-any and unchanged void thinking setter. Prior filtered-acquisition and retired-external failure/control probes all exit0 | Packed H, live services, other OS/Node and remote CI remain unexecuted |

Commands/log map: `/tmp/3105-f-eighth-commands.txt`; signed candidate/signature and complete file receipt: `/tmp/3105-f-eighth-execution.md`. All source/test changes preceded final gates:

- `npm run build`, `npm run check`: exit0; `/tmp/3105-f-eighth-{build,check}-final.log`.
- Complete core/SDK including review files: **72 files,654 passed**,14 unchanged credential/platform skips; `core-final.log`.
- Complete host parity: **177 passed**, no skips; `host-final.log`.
- Root lifecycle/MCP: **54 files,492 passed**; `unit-final.log`.
- Observer/queue: **15 files,121 passed**,1 unchanged platform skip; `queues-final.log`.
- Tasks: **8 files,49 passed**; `tasks-final.log`.
- Additional directly affected extension stale/provider/graph/module/UI contracts: **8 files,37 passed**; `affected-final.log`.
- Eleven exact supplied/prior failure/control invocations and25 built Node fixture modes: all exit0 with natural process exit; `exact-final.log`, `node-final.log`. Strict local API probe: exit0, `api.log`.
- Supplemental qlty0.642.0 smells/metrics: exit0, existing config unchanged; `qlty.log`, `metrics.log`. Warnings remain in existing large modules, including createExtensionAPI100, reloadOwnedGeneration43 and closeAgentSession23 cognitive complexity; no clean-smells claim or suppression.

Vertical RED evidence: initial supplied negative probes exit1/control0; source filtered creation2 failures, reload1, cleanup authority2, direct admission4, exec drain1 and replacement event1 before respective repairs. Built baseline five selected regressions failed; built replacement probe observed `[2]` before the shared handoff fix. Final focused20 source cases and complete gates pass. Logs retain the initial broad core failure; it was repaired, not skipped. A supplemental ordinary-loader probe initially had a data-URL import error, then lacked the required caller preload; corrected public setup passes without changing assertions about successor delivery. No native spool failure recurred; its prior cause remains unattributed.

Temporary F issue notes were removed while preserving unrelated `ISSUES.md` bytes. Guides and Unreleased only were updated. No dependencies/setup restart, delegation, new worktree, G/H implementation, forced exit, private workflow teardown, original-checkout edit or publication. Local deterministic macOS arm64 Node26.8.2 evidence only. This is bounded verification of the repaired invariants, not an exhaustive claim about arbitrary third-party extensions.

## Ninth continuation: invariant map before repair (`5df933650`)

Three roots supersede the prior readiness claim. Exact failure/control probes reproduce getter rollback leakage (active factory2), cleanup subprocess escape (close before child settlement), and retained released callbacks (100 payloads after close).

| Invariant | All materially distinct paths and transitions | Regression dependencies |
| --- | --- | --- |
| Cleanup cannot depend on rereading failed resource views | `reloadGeneration` encloses ordinary reload and transactional preparation/publication; its catch currently calls getExtensions before rollback. Selected ownership transfers at ordinary runtime construction or transactional candidate publication. Creation uses the same acquisition rollback helper, with explicit selected runtime retention and startup close | Preserve primary getter error, aggregate cleanup causes, selected runtime after transfer, borrowed discovery and old generation on rejected transaction. Existing preparation, postcommit, filtered creation/reload and startup cases remain required |
| Cleanup-admitted tracked work settles before teardown completes | `emitSessionShutdownEvent` serves terminal SDK/runtime replacement, startup rollback, ordinary/transactional retirement and candidate rollback. Drain must occur after dispatch has left its tracked frame, even on handler failure. `rollbackExtensionFactories` also invokes shutdown before a runner exists; its inline/file/replay callers must retain runtime work until settlement | Independent child release while close/reload remains pending; overlap terminal close with candidate rollback; aggregate handler failures; stale/new authority remains sealed. Existing self-reload and command replacement guard against self-drain. No owner-wide exemption |
| Completed release removes every bookkeeping reference | `loader-api` adds bus unsubscribe and publisher disposal to factory lifetime; `loader-runtime.trackEventBusSubscription` separately owns invalidation. Manual release, runtime invalidation, omitted factory retirement and failed factory discard must converge on one idempotent release and delete references before invoking potentially throwing code | Durable GC child plus deterministic lifetime ledger checks; retained session/API/unsubscribe handles; release during held close; publisher disposal; throwing release still removes ledger and does not skip peers. Preserve shared borrowed bus and selected sibling subscriptions |

Use existing lifecycle/work ledgers, not a new manager. Public source and natural-exit built Node regressions will establish RED/GREEN per boundary. No G/H, packed/platform/live/remote or arbitrary untracked work guarantee is added.

### Ninth batch executed acceptance

All three roots are repaired. Reload records retained runtime ownership at transfer instead of querying the failed loader during cleanup. Shared shutdown joins tracked cleanup execution after dispatch has left its own work frame; pre-runner factory rollback also tracks and drains execution. Per-factory cleanup seals external API/bus admission without sealing selected siblings. Event and publisher releases now remove both ownership entries and clear their captured callbacks before invoking potentially throwing cleanup.

| Invariant | Paths | RED/GREEN assertion and candidate evidence | Residual limit |
| --- | --- | --- | --- |
| Failed resource views cannot prevent rollback; selected/borrowed ownership survives | `agent-session-extension-bindings.ts`, shared `loader-rollback.ts`; ordinary, transactional preparation, after-transfer and creation rollback | Source getter RED4 failures/1 control, GREEN6. Public tests preserve exact primary/cleanup objects, retain old transactional or installed ordinary owner as appropriate, then release owned resources on disposal. Built getter7 scenarios include caller-preloaded creation and primary/cleanup controls. `/tmp/3105-f-ninth-getter-{red,green}.log`, `core-final.log`, `host-final.log` | Borrowed discovery stays caller-owned; arbitrary custom-loader external effects remain caller responsibility |
| Cleanup-admitted work settles before teardown; fresh authority remains sealed | `runner.emitSessionShutdownEvent` serves terminal/replacement/startup and reload candidate/retirement; `loader-core` inline/file/replay and acquisition rollback use `loader-rollback`; `extension-work` tracks even before runner binding | Source RED4 premature-close failures; GREEN4 independently released child cases. Built close/control/error, candidate/error overlapping terminal disposal, and failed factory all require close pending, zero premature completion and natural exit. Additional factory admission assertion failed before scoped factory cleanup was added; source and built tests now refuse fresh subscription and bus delivery while child drains. Existing self-reload, command replacement/reentrancy and filtered ownership cases remain green | Noncooperative tracked work must settle; no forced termination or cleanup-to-dispose cycle is permitted |
| Release actually forgets completed closures across ownership ledgers | `loader-api.trackRelease` feeds runtime invalidation, manual unsubscribe, publisher disposal, failed discard and omitted-factory retirement | Source RED3 nonempty ledgers, GREEN4 including throwing automatic release. Built `--expose-gc` retains session/API/100 public unsubscribe handles while requiring zero payloads and zero lifetime entries after manual/automatic release; errors retain cause identity and all100 attempts. Four GC modes repeated3 times, all pass. Existing filtered/discard and publisher suites rerun | Retained error objects can retain V8 lazy stack frames independently of ownership bookkeeping; the deterministic injected fault is precreated to isolate release ownership, not discard errors |
| Prior A–E/F APIs, raw values, sibling isolation and all cleanup attempts remain | Both complete SDK parity files, complete host parity, affected root/core/queue/task/extension suites | Exact compile passes;20 supplied/prior probes pass, including synchronous seal, shared failed outcome, borrowed sibling, raw input, authority and filters. No signatures, payload policy, skips or existing assertions changed | G/H packed declaration/consumer, live services, other OS/Node and parent exact-head CI/publication remain unexecuted |

Exact serialized commands: `/tmp/3105-f-ninth-gates.sh`; output receipt `/tmp/3105-f-ninth-gates.log`. Supplemental exact commands: `/tmp/3105-f-ninth-probes.sh`; output `/tmp/3105-f-ninth-probes-final.log`. RGR command/log index: `/tmp/3105-f-ninth-commands.txt`. Full signed candidate SHA, files, signature and clean status are recorded after commit in `/tmp/3105-f-ninth-execution.md`.

- Final sequential `npm run build` and `npm run check`: exit0.
- Complete core/SDK/review selection: **72 passing files,668 passing tests**,14 unchanged credential/platform skips in2 skipped files.
- Complete host parity: **194/194 passing**, including17 new built Node cases, no skips.
- Root lifecycle/MCP: **54 files,492 passing**. Observer/queues: **15 files,121 passing**,1 unchanged platform skip. Tasks: **8 files,49 passing**. Additional affected extensions: **8 files,37 passing**.
- Exact public API compile: exit0. Twenty exact/prior probes and12 repeated GC child invocations: exit0, natural process exit.
- Supplemental qlty smells/metrics: exit0, existing config unchanged. Existing large-function warnings remain: createExtensionAPI101, reloadOwnedGeneration43 cognitive complexity. New scoped factory-cleanup helper measures2. Normal build/check remains authoritative.

No source/test changes followed the final gates. Initial fixture corrections are retained in logs: transactional preparation now explicitly throws its intended primary instead of preparing an unrelated third generation; startup assertions inspect aggregate causes; custom creation preloads caller discovery before testing replay rollback. A newly added automatic-throw GC check initially retained V8 lazy error stack frames; inspecting those stacks alone released all100 payloads (`gc-throw-investigation.log`). The durable fixture instead injects a precreated Error, preserving error identity, automatic failure and all GC assertions without conflating the callback fault's captured stack with release bookkeeping. No production error suppression or broad memory-policy change was made.

Unrelated `ISSUES.md` bytes are restored, guides and Unreleased only updated, no native spool failure recurred and no native repair is claimed. Evidence is local macOS arm64 Node26.8.2 with existing dependencies and built workspace exports. No delegation, new worktree, install, forced exit, private DBOS cleanup, other-checkout edit or publication occurred.

## Tenth continuation: pre-edit ownership map (`5cbf05f833`)

The latest six findings reduce to two reproduced roots: shutdown precedes admitted factory callbacks (live resource1 after close), and sequential rollback leaves closing peers open (fresh exec succeeds). Both supplied failure probes exit1; controls exit0 (`/tmp/3105-f-tenth-red.log`). Prior completeness claims do not cover these cases.

| Boundary | Callers and closing ownership | Required repair / dependent assertions |
| --- | --- | --- |
| Failed single factory | `loadExtensionFromFactory` serves inline `resource-loader-extensions.loadExtensionFactories` and file `loadExtension`; ordinary factory errors become discovery diagnostics, so earlier successful factories are not necessarily closing | Seal only failed instance; drain its admitted bus/exec receipts before shutdown and cleanup-created receipts afterward. Preserve diagnostic control, aggregate cleanup errors and selected peer execution |
| Failed replay batch | `instantiateExtensions` replays caller discovery through `loadExtensionFromFactory`; unlike diagnostics, a replay failure aborts the whole fresh batch. Existing outer catch reaches earlier replayed factories only after the failing factory cleanup | The inner rollback must own the whole replay batch before its first await, not just the failed factory. Skip already-retired cleanup on outer catch; borrowed originals remain untouched |
| Enclosing acquired set | `rollbackFactoryAcquisitions` is called by SDK `createScopedSession` preconstructor catch, `constructAgentSession` omitted-selection cleanup, and `reloadGeneration` catch/final cleanup | Snapshot and seal every pending closing factory synchronously before any drain/hook. Drain the complete set before the first hook. Keep exact primary and cleanup causes and attempt all releases |
| Transfer and subset | Ordinary reload deletes adopted extensions after `_buildRuntime`; transactional reload deletes candidate extensions before discovery cleanup; SDK deletes selected extensions before startup. All pass retained runtime ownership | Drain by factory, not shared runtime: omitted subset cannot wait on selected sibling callbacks or its own selected invoking work. Selected APIs and borrowed discovery remain usable. Getter-independent retained ownership remains unchanged |
| Runner-owned startup/retirement | Transferred creation/startup failures use `_close`; ordinary and transactional reload use runner drain, shared shutdown post-drain, and invalidation | Unchanged runner generation tracking already drains before and after cleanup; rerun startup/cancel/candidate-close overlap and self-reload/replacement controls. No relaxation of retired authority or caller exclusion |

Use the existing work receipts keyed by the actual invocation-remapped factory for bus callbacks and direct execution. A sealed factory permits only its own already-admitted continuation or bounded cleanup scope; runtime revocation still independently denies successor authority. Preserve previous release/getter/cleanup-spawn/filter/GC regressions. Public source and natural-exit Node assertions cover these distinct boundaries without a Cartesian matrix. No new manager, API contract or G/H scope.

### Tenth batch executed acceptance

Both roots are repaired at the shared factory ownership boundary. Rollback snapshots and synchronously seals its complete closing set, drains that set before its first shutdown, and retains the prior post-shutdown drain. Bus callbacks and direct execution retain receipts on the existing invocation-remapped factory lifetime as well as the runtime. This avoids draining selected shared-runtime work and permits only the admitted factory's own continuation. Runtime revocation remains independently authoritative. Replay failure transfers its whole fresh batch into rollback before awaiting the failed factory's hook; the enclosing catch cannot repeat those hooks. Public factory signatures and result/payload conventions are unchanged.

| Invariant | Paths | Exact assertion / executed candidate evidence | Residual |
| --- | --- | --- | --- |
| Already-admitted acquisitions precede shutdown | Single inline/file failure, enclosing creation/reload acquisitions, omitted shared-runtime subset | Source drain RED1 (`drain-red.log`); source GREEN9 in `focused-final.log`. Built `drain-inline/path/error/control` and `subset/startup` require callback acquisition before shutdown, live0 and natural exit. Exact supplied failure now reports `shutdownBeforeRelease:false`, `live:0`; control unchanged. `host-final.log`, `probes-final.log` | Arbitrary untracked work is not joined; callbacks must settle independently |
| All closing peers lose fresh admission before first await | Preconstructor failure, replayed borrowed discovery, ordinary and transactional preparation failure, omitted set | Source peer RED5; final GREEN6 including abort plus overlapping terminal close. Every pending peer refuses exec, subscription and bus emission; delivery0, each shutdown once, exact factory/setup and cleanup causes retained. Built peer6 modes pass. `peers-red.log`, `focused-final.log`, `host-final.log` | Replay fixture initially used clonable default discovery; corrected to subclass/preload so it actually exercises replay. Baseline built replay test separately failed before rebuild |
| Admission completion is factory-scoped, not blanket authority | Failed callbacks, two omitted factories sharing selected runtime, selected pending bus callback | Source and built subset tests hold selected work independently: selected exec returns `selected`; omitted callback can register its own late subscription but cannot register on unrelated closing peer; all omitted acquisitions drain before either hook; creation finishes with selected work still pending. Subsequent startup failure closes the selected owner. Existing retired-authority and self-reload/replacement probes pass | Borrowed raw resources remain caller-owned; no tenant sandbox or new manager |
| Post-cleanup drain, full attempts and sibling isolation survive | Existing getter failures, cleanup-created subprocesses, manual/automatic/throwing release, GC, cancellation, replacement/self-reload | Complete unchanged prior host194 plus12 new cases pass; all prior public probes and12 repeated GC children pass. Core includes both SDK/review files. Exact public API compile passes | Packed G/H, live service/other-platform and remote CI remain unexecuted |

Candidate is the signed commit containing this section; full SHA/signature/files are recorded in `/tmp/3105-f-tenth-execution.md`. Log names above use `/tmp/3105-f-tenth-`. Exact serialized gates: `/tmp/3105-f-tenth-gates.sh` and `gates.log`; exact supplemental commands: `probes.sh` and `probes-final.log`; complete command index: `commands.txt`.

- Final sequential build/check: exit0, after all runtime/test edits.
- Complete coding-agent SDK/review and affected core: **72 passing files,677 passed**,14 unchanged credential/platform skips in2 skipped files.
- Complete host parity: **206/206 passed**, no skips. New durable baseline:10 failing scenarios and1 passing control before rebuild; final12 pass including new overlap control.
- Root lifecycle/MCP: **54 files,492 passed**. Queues/observers: **15 files,121 passed**,1 unchanged platform skip. Tasks: **8 files,49 passed**. Additional affected extensions: **8 files,37 passed**.
- Four current supplied failure/control invocations,20 prior public probes and12 repeated GC invocations: all exit0, natural exit. API compilation: exit0.
- Supplemental qlty smells/metrics: exit0, unchanged config. Existing complexity warnings remain (createExtensionAPI101, instantiateExtensions20); shared rollback helper17. No clean-smells/security claim.

Only docs and evidence followed final runtime/test gates. New startup fixture initially expected original Error identity, but `startExtensions` intentionally converts runner diagnostics to attributed Error messages; corrected to assert AggregateError and the original message. Factory/setup and cleanup identity assertions remain exact. No old assertion was changed or skipped. Temporary `issues.md` notes removed without altering case-insensitive `ISSUES.md`; released changelog sections remain byte-identical. No native spool failure recurred and no native fix is claimed. No delegation, reinstall, new worktree, other-checkout edit, forced exit, private DBOS teardown, G/H work or publication occurred.

## Eleventh continuation: pre-edit async adapter map (`669ca0ba8`)

The three review findings share one missing receipt: `loader-api.refreshWorkflowResources` checks admission but invokes the normalized provider outside `trackAPIWork`. Supplied dispose/reload/replay probes all finish cleanup before independent release; the late-acquisition probe leaves one interval. Both supplied controls pass. Previous complete-drain claims exclude this newly demonstrated hole.

| Async adapter / boundary | Actual ownership and callers | Required change / dependencies |
| --- | --- | --- |
| Workflow resource refresh | `loader-resources` normalizes optional refresh/get; loader construction binds the ResourceLoader provider, including borrowed subclass replay. `loader-api` bypasses accounting before runner binding and after adoption | Wrap the complete refresh plus fallback snapshot in existing `trackAPIWork`: invocation-remapped factory receipt and runtime/session receipt before provider invocation. Factory rollback drains only closing factories; terminal close and both reload paths drain generation work. Preserve copied results, optional refresh fallback and provider errors |
| Exec and event callbacks | Existing `trackAPIWork` records direct exec; bus dispatch records captured runtime/factory, not ambient caller identity | Reuse without changing shared helper; retain selected sibling isolation, cleanup-created work, admitted completion, copied-registration and failed replay regressions |
| Message APIs | `agent-session-extension-bindings` delegates sendMessage/sendMessages to `sendCustomMessage(s)`, which synchronously enters `trackSessionWork` before admission barriers; sendUserMessage delegates to tracked prompt. Candidate publication queues effects until commit | No missing provider ownership here; retain queue/batch/raw-field and rollback-publication tests. Uninitialized factory actions refuse; do not add blanket async wrappers that alter void return contracts |
| Model and synchronous notification APIs | setModel delegates to session model work before awaited model_select; candidate publication defers it. Name/thinking setters remain void and runner dispatch owns their async hooks. Registration batches and workflow observers have existing runtime receipts | No new manager or API changes. Existing model/notification/observer gates cover these materially distinct paths |
| Retirement and reentrancy | session work uses caller-aware reload exclusion; terminal close never excludes pending callers. Factory receipt keys are invocation-remapped, not shared provider or bus | Test held refresh across dispose/reload/replay; reject fresh admission while held, preserve already-admitted completion and original errors, late acquisition before cleanup and natural exit. Reuse existing self-reload/replacement and selected/borrowed controls |

Bounded scope: SDK-invoked operations only, not arbitrary detached third-party work. No forced exit, G/H, platform/packed or remote CI claim.

### Eleventh batch executed acceptance

The provider invocation and fallback result snapshot now enter the existing `trackAPIWork` boundary. No helper, public signature, return fields, resource policy or retirement rule changed. Receipts belong to the invocation-remapped factory and runtime/session, preserving selected siblings, borrowed discovery and caller-aware self-reload.

| Invariant | Affected paths | Exact RED/GREEN assertions / candidate evidence | Residual |
| --- | --- | --- | --- |
| SDK-admitted refresh settles before cleanup | `loader-api.ts:303–309`; terminal close, reload retirement, failed replay rollback | Supplied refresh/reload/replay RED exit1; late-acquisition RED live1. Source tracer RED stale API after premature close, then six cases GREEN. Eight built Node cases GREEN after baseline seven failures/one control. Final source and host logs require pending cleanup before independent release, admitted own subscription completion, acquisition before shutdown, live0 and borrowed generation1 untouched | Custom provider must settle independently; no forced cancellation of arbitrary third-party work |
| Fresh admission remains sealed and failures stay distinct | Source dispose/reload/replay/error/control; built overlap and replay-error | Fresh refresh rejects while suspended; provider error remains exact caller object; replay preserves exact primary and cleanup errors. Runner shutdown reports attributed cleanup message. Overlapping terminal close rejects reload with SessionClosed and still releases resources. Source `admitted workflow refresh drains before cleanup`, built `workflow refresh ownership` | Runner diagnostic attribution intentionally does not preserve original shutdown Error identity |
| Reentrancy and shared identity remain correct | Refresh-initiated self-reload; existing selected subset, copied registrations, shared loader and bus | Built `self` acquires before retiring generation2 shutdown and exits naturally. Existing `self reload retains invoking continuation cleanup`, `command replacement drains peers`, `factory rollback drains the omitted set without selected sibling work`, and filtered/borrowed regressions rerun in complete suites. Exact shared-resource `siblings` and `none-selected` probes pass | Raw borrowed resources are not sandboxed; no selected sibling ownership is added |
| Earlier A–E/F behavior is preserved | Complete core/review, host, root, queues, tasks, affected extensions, workflow resources | Build/check exit0; core683, host214, root492, queues121, tasks49, affected37, workflow-resource204. Current supplied probes and complete tenth/prior probe chain pass, including12 GC runs. Public API compile passes; authored workflow SHA256 remains aee794cfa82fe248928ab07ec0964752c59a0bfc8ff685f814f710f9c4c61db2 | Existing14 core credential/platform skips and1 queue platform skip unchanged; packed G/H, other platforms, live providers and remote CI not executed |

Exact commands and output index: `/tmp/3105-f-eleventh-gates.sh`, `gates.log`, `probes.sh`, `probes-final.log`, `commands.txt`. All log short names use `/tmp/3105-f-eleventh-`. Final signed SHA/files/signature/clean status: `execution.md`. Runtime/test content was final before sequential build/check and all gates; only docs/evidence followed. Source tracer `source-red.log`/`source-green.log`; final six source cases `source-green-final.log`; built `host-red.log`/`host-green.log`; full suites `core-final.log`/`host-final.log`.

Supplemental qlty smells and metrics passed with unchanged configuration; existing createExtensionAPI complexity101 warning remains. No clean-smells/security claim. Fixture corrections: initial tracer used an undefined local constant, fixed before meaningful RED; terminal error assertions now follow existing runner diagnostic attribution, while factory error identity stays exact; self-refresh ordering distinguishes unrelated discovery cleanup from retiring generation2. No runtime workaround or weakened prior assertion was introduced. Temporary F notes removed preserving unrelated case-insensitive ISSUES.md bytes; released changelogs untouched. No dependency/setup changes, delegation, other checkout, forced exit, private DBOS teardown, G/H or publication.
