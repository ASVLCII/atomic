# SDK parity #3105: slice F

## Contract

Implement awaited shared shutdown and generation replacement/reload. Seal admission synchronously; abort, drain, settle input, shut down extensions, flush persistence and release leases. Attempt all cleanup and report aggregate `ShutdownFailed` causes. Preserve siblings and borrowed resources. Public `await session.dispose()` must let a built Node workflow process exit normally. Keep the actual `AgentSession`, existing tool/event contracts and authored workflow bytes. No new manager or required host configuration.

User amendments carried forward: "make sure that you create PRs and loop until CI is green, then you can merge if so" and "and there is no addressable greptile feedback". Those are parent-owned gates for the cumulative PR, not permission to publish or merge slice F. This child performs no push, PR, merge, release or deployment.

## Decisions

- Durable workflows retain their existing runtime ownership across reload/new/resume/fork. Generation-owned provider calls, auth, input, shell work, child admission and subscriptions close. Actual final owner disposal drains retained workflow roots/stages and releases the last owned DBOS lease. Injected durability remains borrowed.
- The internal optional `pi.lifecycleScope` identifies a runtime across replacement. It is not a host setting or control API. SDK children receive independent scope identities. Existing host bindings transfer before successor startup.
- Mutable workflow stores, registries and tool/status/control helpers capture the owning session's concrete resources rather than the latest process-global facade.
- Native closed task-owner scopes never reopen. Reload creates a fresh internal owner identity without changing the public session ID or a borrowed workflow-stage owner.
- Closed ordinary input, prompt, shell and auth admission refuse rather than accepting work into a retired generation. Raw payloads and tool result formats are unchanged; no new text normalization or duplicate policy.

## Acceptance matrix

| Required clause | Evidence |
| --- | --- |
| Awaited idempotent disposal, synchronous admission seal | `sdk-builtin-parity.test.ts`: public disposal Promise identity, pending shutdown, immediate prompt/binding/reload/input refusal, repeated success/failure outcome |
| Ordered cancellation/drain/settlement and no replay | Public shell drain and pending-input test; runtime active-provider and OAuth tests; queued-child test proves a queued runner never dispatches after close |
| Every cleanup attempted; aggregate component causes | Public two-extension plus settings-flush failure test proves later session persistence runs; MCP final-close aggregate/deadline and real-adapter failure fixtures |
| Persistence and subscription release | Protected-shutdown, runtime event subscriptions, RPC shell-source persistence suites; shutdown explicitly flushes session/settings persistence before lease release |
| Startup rollback | SDK eager/deferred startup and post-discovery failure cases; workflow partial DBOS startup cleanup regression |
| Replacement binding and identity | Runtime replacement startup receives inherited input; retired session refuses work; sibling scope differs |
| Reload invalidation and fresh admission | Strict transactional reload, Herdr reporter, shell-owner generation and OAuth reload cases; old input cancelled, old task IDs refused in successor, fresh commands/auth work |
| Borrowed stage resources survive replacement | Stage-runner public adapter ownership, shell-wait workflow-stage cases and workflow retained-generation tests |
| Borrowed managers/model runtime | Public sibling uses the same settings manager after peer close; OAuth disposal retains caller's registered provider; injected workflow backend survives final lease release |
| Sibling workflow survival | Built public Node fixture starts/closes sibling while first awaits input, then completes the first workflow with exactly one guarded effect; owner-scoped workflow tool/status/control tests |
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

## Validation

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

The replacement-factory leak reproduced as a 60-second real Node timeout before repair and passes the normal-exit oracle after repair. Shutdown diagnostic/error observers were also fault-injected: every cleanup still runs and all component/observer failures remain in the aggregate. No unresolved F failure remains in the executed acceptance. No unrelated improvements were added. Existing tracked `ISSUES.md` risks for other issues and G/H remain outside this slice; full packed-consumer and remote platform CI evidence is not claimed here.
