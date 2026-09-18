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
