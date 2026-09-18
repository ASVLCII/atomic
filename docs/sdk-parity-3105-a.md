# SDK builtin parity, slice A

Goal: make normal SDK creation and the CLI share Atomic builtin defaults, finish startup once per generation, and unwind failed startup before rejecting.

Scope is contract A and issue #3105 section 8.1 A. Later slices B through H are not acceptance requirements here. Implementation is authorized despite historical RFC design-only wording.

## Acceptance and evidence

| Requirement | Current-checkout oracle | Status |
| --- | --- | --- |
| Default shipped tools and resources through normal factory | `npm run test --workspace=@bastani/atomic -- test/sdk-builtin-parity.test.ts` | First test failed with `missing builtin workflow`, then passed after default composition and startup |
| Actual AgentSession and unchanged result fields | Same test uses `instanceof AgentSession`; inspect sdk-types.ts | Identity passes; optional fields unchanged |
| Shared CLI/factory defaults, preserve trust/deferred host behavior | Service parity, mounted-host startup, CLI trust/order suites and real CLI `/workflow list` | Passed |
| Custom loaders retain user resources | Custom parity and resource loader suites | Passed |
| Builtin identity dedup, descriptor order, immutable caller options/arrays/loader | Repeated-root parity plus five unique custom-loader builtin registrations before/after reload | Passed after review repair; prior coverage missed duplicate Intercom |
| Missing enabled shipped assets reject `BuiltinUnavailable` naming package | Missing-assets parity | Passed; RED recorded before repair |
| Creating to ready only after startup and resource discovery | Default/custom/service parity, deferred publication suites | Passed |
| Ready to rebound stays same generation, no repeated start | Concurrent binding parity | Passed |
| Reload creates one new started generation | Parity reasons exactly `["startup", "reload"]`, transactional and Herdr tests | Passed |
| Failed creation awaits partial rollback before rejection | Eager/deferred startup and post-discovery prompt-finalization failures, borrowed-provider rollback | Passed after review repair; repeated failed binding neither restarts nor repeats cleanup |
| Preserve tool selection and collisions | SDK defaults and mandatory Intercom suites | Passed; selection redesign belongs to B |
| User guides and Unreleased behavior | SDK guide/reference and coding-agent/workflows changelogs | Updated; released sections unchanged |
| Designated checkout/branch, no external writes | Git branch/status | `feat/3105-sdk-a`; no push, PR, merge or release |
| Independent install/build and final build/check/focused gates | Commands below | Passed |
| Signed conventional attributed commit, normal hooks, clean tree | Git commit/signature/status at handoff | Commit identifier and final status recorded in receipt |

## Interface and state choices

Keep the returned actual AgentSession and existing result fields. Add only optional creation-time `extensionBindings` needed to bind before startup. Preserve absent binding fields on rebinding. No new orchestration handle. Preserve caller text, arrays, resource order and arbitrary duplicate user data. Deduplication applies only to shipped builtin identities. Existing tool collision rules remain authoritative.

States: creating loads resources and constructs the session; startup completes before ready. Binding ready sessions updates bindings without replaying start. Reload prepares another generation, starts it once and publishes it through existing transactional machinery. Failed creation rejects after cleanup and never returns a half-started session. Public awaited-disposal redesign belongs to F, not A.

CLI UI construction requires a session before mounting. The approved internal constructor retains first-start rollback until the real mounted host binds. It uses the same composition/start implementation and is not re-exported from the public package. No public deferred option or fake UI was added. The public services factory forwards `extensionBindings` and remains eager. Repeating a failed first binding neither restarts nor repeats cleanup.

## Deferred

Builtin selection/suppression matrix B, host input C, workflow gates D, child inheritance E, full awaited lifecycle F, service isolation/Node adapters G and genuine packed consumer H remain separate slices. No claim of complete installed-package or multi-session parity.

Repeated auto-started builtin sessions expose a `beforeExit` MaxListeners warning in affected suites. It was not suppressed; full service/lifecycle isolation remains F/G. Existing unrelated `ISSUES.md` entries are unchanged. No live provider, packed-install, remote CI or other-platform claims are made.

## Validation commands and observations

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build
npm run check
npm run test --workspace=@bastani/atomic -- test/sdk- test/herdr-reload.test.ts test/interactive-deferred-startup-first-prompt.test.ts test/interactive-engine-resource-readiness.test.ts test/mandatory-intercom-session.test.ts test/agent-session-services-model-paths.test.ts test/resource-loader- test/main-deferred-startup.test.ts test/startup-project-trust.test.ts test/interactive-deferred-startup.test.ts test/interactive-startup-resource-ordering.test.ts test/interactive-startup-resource-gate.suite.ts
npm run test:unit -- test/unit/workflow-reload-render.test.ts test/unit/workflow-session-boundary-preserves-runs.test.ts test/unit/durable-dbos-session-replacement.test.ts
node packages/coding-agent/test/fixtures/sdk-builtin-composition.mjs
qlty metrics --functions packages/coding-agent/src/core/sdk.ts packages/coding-agent/src/core/builtin-resource-loader.ts packages/coding-agent/src/core/session-startup-rollback.ts
qlty smells packages/coding-agent/src/core/builtin-resource-loader.ts packages/coding-agent/src/core/session-startup-rollback.ts
```

Expanded package validation passed 238 tests in 28 files, none skipped. Affected workflow validation passed 28 tests in three files. Build and repository check passed. The built Node fixture printed `SDK builtin composition: PASS` and exited normally without forced termination or inference. It uses built workspace artifacts, not H's packed-install proof.

Qlty 0.642.0 produced scoped function metrics and no smells for the new loader/rollback modules. Existing configuration was preserved. Repository lint/typecheck remains authoritative.

A real built CLI ran in dedicated tmux with temporary cwd and agent directory, no credentials. Startup listed all five extensions and shipped skills; `/workflow list` displayed bundled definitions; Ctrl-D exited with `CLI_EXIT:0`. Captures: `/tmp/3105-a-cli-pane.txt`, `/tmp/3105-a-cli-workflows.txt`. Inherited Herdr environment produced `[Herdr] protocol_rejected`; this is not Herdr transport proof. Dedicated fake-Herdr reload tests passed.

Logs: `/tmp/3105-a-final-build.log`, `/tmp/3105-a-final-check.log`, `/tmp/3105-a-final-affected.log`, `/tmp/3105-a-workflow-affected.log`, `/tmp/3105-a-final-node-smoke.log`, `/tmp/3105-a-qlty-metrics.log`, `/tmp/3105-a-qlty-smells.log`. Initial RED logs `/tmp/3105-a-red*.log` demonstrated missing defaults, missing-asset behavior and provider rollback before repair.

## Regressions repaired

Debugger diagnosis distinguished authorized additive builtin resources from workflow startup incorrectly removing `ask_user_question` in headless sessions. That removal was dropped; existing missing-UI refusal remains. Caller-only skill tests now assert additive resources and caller-array preservation.

Expanded reload tests exposed user discovery routed only to the builtin overlay. Forwarding to the caller loader now preserves publication errors and rollback. Herdr tests exposed eager headless startup before CLI UI mounting; the internal constructor fixes production ordering, and public SDK Herdr fixtures supply creation-time bindings. A build caught optional-versus-required callback parameters; the concrete callback type was corrected and final build/check passed.

## Consolidated review repair

The first readiness claim was premature. Review reproduced three slice A findings: rollback was removed before prompt finalization, custom-loader composition loaded Intercom twice, and the dynamic-tool test still expected deferred startup. All three were repaired together without changing the contract or weakening acceptance.

Startup now includes fallible prompt finalization and queued-message recovery in its memoized outcome before releasing rollback. Factory result lookup is inside the protected initialization path. An eager or deferred first-bind failure awaits shutdown; a repeated failed binding reuses the rejection without acquiring or releasing again. The overlay marks registrations it actually loaded from shipped roots using the existing trusted mandatory mechanism. Caller-supplied registrations are not granted trust. The dynamic-tool test now expects its startup tool at factory return and retains metadata, active-tool, prompt and rebinding assertions.

Durable regressions in `sdk-builtin-parity.test.ts` failed before repair for both finalization paths and for the custom-loader builtin count. Their green reruns passed alongside mandatory Intercom anti-spoof tests. Existing user guides and Unreleased entries describe the intended behavior accurately; no duplicate release note was added.

Current repair validation:

- `npm run build` and `npm run check`: passed, logs `/tmp/3105-a-repair-build.log` and `/tmp/3105-a-repair-check.log`.
- The expanded package command above plus `test/agent-session-dynamic-provider.test.ts test/agent-session-dynamic-tools.test.ts test/agent-session-runtime-events.test.ts`: 255 passed in 31 files, no skips; `/tmp/3105-a-repair-affected.log`.
- `npm run test --workspace=@bastani/atomic -- test/agent-session-dynamic-provider.test.ts test/agent-session-dynamic-tools.test.ts test/agent-session-runtime-events.test.ts test/session-cwd.test.ts`: 18 passed in four files, no skips; `/tmp/3105-a-repair-additional.log`. This deliberately includes the actual `session-cwd.test.ts` filename.
- The affected workflow command above: 28 passed in three files; `/tmp/3105-a-repair-workflows.log`.
- `node packages/coding-agent/test/fixtures/sdk-builtin-composition.mjs`: `SDK builtin composition: PASS`, normal exit; `/tmp/3105-a-repair-node.log`.
- Reviewer probes `node /tmp/3105-a-risk-finalization.mjs` and `node /tmp/3105-a-completion-probe.mjs`: both failed before repair, both passed after rebuilding. Finalization observed exactly `["acquire","release"]`; composition listed exactly five distinct builtin paths in descriptor order. Logs `/tmp/3105-a-repair-{red,green}-{finalization,dedup}.log`. Durable equivalents are in the parity suite rather than relying on temporary probe files.
- `qlty metrics --functions packages/coding-agent/src/core/builtin-resource-loader.ts packages/coding-agent/src/core/agent-session-extension-bindings.ts`: executed with existing Qlty 0.642.0/configuration; `/tmp/3105-a-repair-qlty.log`. This is supplementary metrics, not a substitute for the repository check.

No findings from this consolidated batch remain deferred. The pre-existing listener warning and later slices remain as documented above. No new live-provider, packed-install, platform or Herdr-transport claim is made.

## Constructor rollback review repair

The second readiness claim also missed an initialization boundary: `new AgentSession` could register providers and then throw before the factory installed startup rollback. The constructor probe failed with `providerLeaked:true`. Factory construction now restores the provider snapshot and flushes settings before rejection, aggregating cleanup failures. The constructor releases its acquired agent subscription, temporary-storage lease and execution-ended listener, invalidates its partial runner and clears the runner reference on runtime construction failure. No startup event is emitted for this failed constructor.

The durable `constructor failure restores new and replaced providers without starting a session` parity regression failed before repair and passes afterward. It verifies new registrations are removed, a pre-existing borrowed registration overwritten during construction is restored verbatim, and creation rejects rather than returning a session. This extends the initialization-rollback acceptance row above; previous startup/finalization and deduplication checks remain green.

Current validation supersedes the earlier counts:

- `npm run build` and `npm run check` passed: `/tmp/3105-a-constructor-{build,check}.log`.
- The expanded package command above plus `test/agent-session-dynamic-provider.test.ts test/agent-session-dynamic-tools.test.ts test/agent-session-runtime-events.test.ts test/session-cwd.test.ts` passed 259 tests in 32 files, no skips: `/tmp/3105-a-constructor-affected.log`.
- The affected workflow command above passed 28 tests in three files: `/tmp/3105-a-constructor-workflows.log`.
- `node /tmp/3105-a-risk-turn2-constructor.mjs` failed before repair and passed after rebuild with `providerLeaked:false`: `/tmp/3105-a-constructor-{red,green}.log`. Focused test RED/GREEN: `/tmp/3105-a-constructor-test-{red,green}.log`.
- `node /tmp/3105-a-risk-finalization.mjs`, `node /tmp/3105-a-completion-probe.mjs` and `node packages/coding-agent/test/fixtures/sdk-builtin-composition.mjs` passed and exited normally: `/tmp/3105-a-constructor-{finalization,dedup,smoke}.log`.
- `qlty metrics --functions packages/coding-agent/src/core/sdk.ts packages/coding-agent/src/core/agent-session.ts` executed with existing configuration: `/tmp/3105-a-constructor-qlty.log`.

No constructor finding is deferred. The existing listener warning and B–H remain separate work.

## Contract amendments received

The current instruction authorizes runtime implementation despite historical design-only wording and limits this checkout to A. Child stages still may not push, create PRs, merge, release or deploy.

Inherited user amendments:

> "make sure that you create PRs and loop until CI is green, then you can merge if so"

> "and there is no addressable greptile feedback"

The parent owns one cumulative PR after sequential slices, then exact-current-head CI/repair convergence and inspection of Greptile summaries, inline threads and comments. Merge requires green required CI, no remaining actionable Greptile feedback and applicable review/protection gates. Non-actionable feedback needs evidence-backed disposition; stale reviews or aggregate scores are insufficient. This child does not start a duplicate post-PR workflow or merge partial slices. These parent-owned gates are not yet verified here.
