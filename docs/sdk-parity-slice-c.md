# SDK parity slice C acceptance

Frozen goal: implement issue #3105 slice C using existing AgentSession, extension dialogs and questionnaire results, without implementing slices D–H. Base: `ce5e05a85`, branch `feat/3105-sdk-c`.

## Acceptance matrix

All SDK test names below are in `packages/coding-agent/test/sdk-builtin-parity.test.ts`.

| Criterion | Current-checkout oracle and evidence |
| --- | --- |
| Exact HostInput, HostInputOptions, HostDiagnostic and existing questionnaire exports; required methods and optional identity fields | `npm run check` passes. `test/unit/sdk-host-input-contract.test.ts` checks root/extension export equality, original questionnaire type identity, non-any types and negative required-method/boolean/identity assignments. `SDK rejects adapters without every required method` checks malformed JavaScript hosts. |
| hasHumanInput independent of rendering; ordinary unavailability refuses and questionnaire retains no_ui | `SDK host callback answers a questionnaire without rendering`, `SDK human capability is separate from rendering and binding preserves pending requests`, and the questionnaire schema test pass. Unsupported custom rendering rejects HumanInputUnavailable. |
| Runtime-owned questionnaire/dialog bridge and existing formatting/schema errors | Callback tracer changed from exact no_ui failure to passing. Existing tool, TUI, response-envelope, preview and transcript-scroll suites pass. CLI presentation retains chat-as-option configuration and balanced prompt spans. |
| Actual booleans and supplied selections; malformed replies reject InvalidHostInput | `SDK dialogs preserve raw arguments and reject malformed host replies` checks false, truthy non-booleans, foreign selections and invalid text. Questionnaire test rejects malformed result shapes, invalid selections and repeated indices. |
| Raw strings, empty/whitespace, choice order, permitted duplicate choices, previews, notes, answer order and absent optional fields | Dialog test plus `SDK questionnaire preserves rich answers and rejects malformed results and request schemas` and `SDK questionnaire preserves multi-selection and empty custom answers` pass. Existing duplicate-question/duplicate-label/reserved-label request errors remain unchanged. |
| Creation binds before one startup; omitted preserves, null withdraws, explicit adapter beats UI | `SDK startup hooks can await human input without rendering` and binding test pass. Existing A startup-once and rollback tests remain unchanged and pass. |
| Ready → awaiting → one settlement; cancellation/rejection/timeout/withdrawal cannot approve; late completion ignored | `SDK abort cancels host input and ignores late approval` and `SDK pending host requests settle at each cancellation boundary` pass, including already-aborted tool input. No callback cooperation is needed for runtime settlement. |
| Reload/disposal invalidates old requests; current bindings survive reload and identities remain session-specific | Cancellation-boundary and startup tests exercise reload and disposal. Old context becomes stale, old signal aborts, late true cannot settle again. Existing runtime/replacement suites pass. |
| Session-attributed diagnostics, no callback/global-state leakage | `SDK diagnostic sinks are session attributed and remain separate` checks two sessions and excludes raw secret exception text. Standalone Node fixture emits no stdout/stderr. Service-wide diagnostic audit remains G. |
| Actionable guide and Unreleased behavior notes | `packages/coding-agent/docs/sdk.md` documents adapter methods, cancellation, withdrawal/rebinding, missing-input refusal and diagnostics. Changelog records added host callbacks and changed unsupported-dialog behavior only under Unreleased. |
| Build, check, applicable focused tests and non-TTY Node scenario | Commands and outcomes below; no skipped tests in final acceptance runs. |
| Signed conventional commit, normal hooks, clean tree, no external writes | Final commit/signature and `git status --porcelain` are recorded in the implementation handoff. No push, PR, merge, release or deployment performed. |

Constrained choices: the actual AgentSession and existing result schemas remain unchanged. HostInput methods are all required. Request/session IDs are required; workflow IDs stay optional and absent outside workflow ownership. No text normalization, payload reordering, generic answer envelope or new capability manager. Existing questionnaire schema owns enumerated duplicate/reserved errors. Failed startup retains its original cached rejection on repeat binding, as required by A's existing tests; a normally disposed session rejects binding with SessionClosed.

Request states are pending, settled or cancelled. Cancellation, adapter replacement/withdrawal and generation invalidation move pending requests to cancelled; terminal requests cannot return to pending or authorize late replies. An omitted rebind neither cancels a pending request nor replays startup. Durable workflow re-presentation belongs to D; full awaited cleanup belongs to F.

## Validation commands and outcomes

Run from checkout root unless a package cwd is specified.

- Preflight `npm ci --ignore-scripts` and `npm run build` passed independently in this checkout. Logs: `/tmp/sdk-3105-c-install.log`, `/tmp/sdk-3105-c-initial-build.log`.
- Final `npm run build` passed: `/tmp/sdk-c-build-final.log`.
- Final `npm run check` passed Biome, root tsc, package tsgo and typetests, and shrinkwrap verification: `/tmp/sdk-c-check-final.log`.
- `node test/fixtures/sdk-host-input-consumer.mjs` passed under Node 26.8.2 with no TTY, no model-provider call and zero stdout/stderr. It imports built JS, answers the real questionnaire tool, preserves whitespace, cancels an ordinary approval, ignores its late true answer, withdraws capability and observes no_ui. Normal process exit, no forced exit. Log: `/tmp/sdk-c-node-final.log`. This is built-checkout proof, not H's packed installation proof.
- Package cwd: `npx vitest run test/sdk-builtin-parity.test.ts test/extensions-ui-prompt-events.test.ts test/extensions-ui-prompt-contract.test.ts test/ask-user-question-tool.test.ts test/extension-stale-context.test.ts test/extensions-runner test/queued-message-escape-ask-user-question.test.ts test/extension-provider-rollback.test.ts`: 118 passed in 13 files, `/tmp/sdk-c-package-final.log`.
- Package cwd: `npx vitest run test/suite/agent-session-runtime-01.suite.ts test/suite/agent-session-runtime-02.suite.ts test/agent-session-runtime-events.test.ts test/suite/regressions/2753-reload-stale-resource-settings.test.ts`: 20 passed in 4 files, `/tmp/sdk-c-runtime-final.log`.
- Package cwd: `npx vitest run test/ask-user-question-transcript-scroll.test.ts`: 76 passed, `/tmp/sdk-c-scroll-final.log`.
- `npx vitest run --project unit test/unit/sdk-host-input-contract.test.ts test/unit/subagents-child-policy-gate.test.ts test/unit/subagents-foreground-guard-propagation.test.ts test/unit/workflow-invocation-intercom-subagent.test.ts`: 19 passed in 4 files, `/tmp/sdk-c-root-final.log`.
- `npx vitest run --project unit test/unit/ask-user-question-tui.test.ts test/unit/ask-user-question-response-envelope.test.ts test/unit/readiness-gate-decision.test.ts test/unit/stage-prompt.test.ts test/unit/stage-chat-view-overlay-custom-ui.test.ts test/unit/main-task-inspector-overlay.test.ts`: 107 passed in 6 files, `/tmp/sdk-c-questionnaire-final.log`.
- `npx vitest run --project unit test/unit/ask-user-question-preview-pane.test.ts`: 12 passed, `/tmp/sdk-c-preview-final.log`.
- `qlty metrics --functions packages/coding-agent/src/core/extensions/host-input.ts packages/coding-agent/src/core/extensions/runner.ts` and the same paths with `qlty smells`: completed using Qlty 0.642.0 and existing configuration. Logs: `/tmp/sdk-c-qlty-metrics-final.log`, `/tmp/sdk-c-qlty-smells-final.log`. New request settlement and questionnaire validation have cognitive complexity 21 and 22; retained because they implement the required cancellation and reply-validation branches without a second framework. Runner constructor/bindCore/provider-header findings concern unchanged existing functions. No claim of a finding-free Qlty report; Biome remains the authoritative lint gate.
- `git diff --check` passed before commit.

Total focused acceptance: 214 package tests plus 138 root tests, 352 tests in 29 files. No full-suite repetition or platform claims beyond local macOS/Node execution.

## Regression and debugging history

- RED callback questionnaire returned `{answers:[],cancelled:true,error:"no_ui"}`; GREEN callback result unchanged. Logs `/tmp/sdk-c-red.log`, `/tmp/sdk-c-green.log`.
- RED abort outside a provider turn reached the existing 30000 ms timeout; GREEN runner-owned cancellation closes it immediately. Logs `/tmp/sdk-c-abort-red.log`, `/tmp/sdk-c-input-green.log`.
- RED omitted UI rebinding cancelled a pending request; GREEN caches the presentation adapter and preserves it. Logs `/tmp/sdk-c-rebind-red.log`, `/tmp/sdk-c-rebind-green.log`.
- RED falsy JavaScript adapter was accepted; GREEN validates all five required methods. Logs `/tmp/sdk-c-adapter-red.log`, `/tmp/sdk-c-adapter-green.log`.
- Full parity exposed two A regressions: repeated bind after failed startup returned SessionClosed instead of the original failure. Cached failed-start outcome restored; all original assertions pass. `/tmp/sdk-c-parity.log` records failure; final package log records repair.
- UI prompt suite initially used an empty SessionManager stub. Replaced it with real in-memory SessionManager; updated option assertions to combined cancellation signals and adapter-replacement expectation to cancellation under C. Retained synchronous presentation, thrown-error behavior and all event-balance assertions. `/tmp/sdk-c-affected.log` and `/tmp/sdk-c-affected-green.log` record repair.
- Typecheck caught missing required context/internal-session fields and erasableSyntaxOnly parameter properties. Fixed declarations/fixtures and ordinary field initialization; final check passes.
- Resolved slice-C entries were removed from ISSUES.md. Its unrelated pre-existing entries remain untouched.

## Residual observations and deferred work

The combined package run emits a `MaxListenersExceededWarning` for 11 process beforeExit listeners. Tests pass and the standalone Node fixture exits silently; origin/leak attribution is not established by this slice. Do not suppress the warning. Owner/service cleanup audit remains F/G. Qlty complexity observations remain as disclosed above, not acceptance failures.

D workflow durable gates, E child inheritance, F awaited disposal and replacement binding transfer, G service isolation/audit, H genuine packed consumer and broader platform verification remain assigned later slices. No additional feature scope accepted.

## Contract amendments received

- "make sure that you create PRs and loop until CI is green, then you can merge if so"
- "and there is no addressable greptile feedback"

The parent owns one cumulative PR after all slices, exact-head green CI and resolution of actionable Greptile feedback before conditional merge. This child does not push, create PRs or merge.

## Review round 2 repair

The six blocking reports from completion, evidence and risk reviewers group into two defects. Both are resolved locally; the previous claim of complete malformed-reply validation was incomplete.

| Grouped finding | Root cause and repair | Durable evidence |
| --- | --- | --- |
| Sparse answers and selected labels bypass validation | Array every/some skip holes. Iterate dense validation-only copies, retaining the original response object and raw values. | `SDK questionnaire rejects sparse answers and selections` fails before repair with formatter TypeError and passes after; built Node fixture rejects both with InvalidHostInput. |
| Throwing reply accessors escape owned settlement | The response continuation could throw into an ignored promise. Catch validator exceptions and reject the owning request with InvalidHostInput, allowing its existing finally cleanup. | `SDK questionnaire settles throwing reply validation and releases the request` fails before with timeout/unhandled rejection and passes after. It verifies released request signal remains un-aborted on subsequent session abort and the next valid reply retains object identity. The Node fixture catches InvalidHostInput and exits normally without an unhandled-rejection handler. |

Round 2 reran every build/check/test command in the validation list above, using `/tmp/sdk-c-r2-` log prefixes: `build`, `check`, `package`, `runtime`, `scroll`, `root`, `questionnaire`, `preview`, and `node`. Build/check passed. Package suites passed 120 + 20 + 76 tests; root suites passed 19 + 107 + 12 tests. Total: **354 tests across 29 files, none skipped in acceptance runs**. Targeted red/green runs use name filters only during diagnosis, not as acceptance substitutes.

`node test/fixtures/sdk-host-input-consumer.mjs` passed with zero stdout/stderr and normal process exit. The fixture also failed against the pre-repair built code (`/tmp/sdk-c-r2-node-red.log`). Reviewer probes reproduced sparse answer TypeError, accepted sparse selections and accessor-induced Node exit 1 before repair (`/tmp/sdk-c-r2-sparse-before.log`, `/tmp/sdk-c-r2-throw-before.log`). SDK red/green logs are `/tmp/sdk-c-r2-sparse-red.log`, `/tmp/sdk-c-r2-sparse-green.log`, `/tmp/sdk-c-r2-throw-red.log`, `/tmp/sdk-c-r2-green.log`.

`qlty metrics --functions packages/coding-agent/src/core/extensions/host-input.ts` and `qlty smells packages/coding-agent/src/core/extensions/host-input.ts` completed with existing configuration unchanged; logs `/tmp/sdk-c-r2-qlty-{metrics,smells}.log`. Request complexity increased from 21 to 24 for the explicit exception boundary; questionnaire validation remains 22. The prior combined-suite beforeExit listener warning remains, and the standalone Node fixture remains silent. No unrelated cleanup, D–H work or external publication was performed. Existing guide and Unreleased validation guidance remain accurate and need no further change. Only this repair's resolved ISSUES.md section was removed; inherited entries remain untouched.

## Review round 3 repair

All three consolidated P2 findings identify the same missing named `ExtensionBindings` root export. The earlier exact-export claim was incomplete: Vitest erased the parity test's type-only import without checking it. The root now re-exports the original interface from `agent-session-types`, without a wrapper or inferred substitute.

`test/unit/sdk-host-input-contract.test.ts` now imports the named public contract and checks equality with its original definition and `AgentSession.bindExtensions`, non-any identity, exact human-input/diagnostic fields, permitted omitted/null bindings, and rejection of incomplete adapters. This file is included in the authoritative root `tsc --noEmit` gate. Before the export, that command failed with TS2305; after the one-line export it passed. Logs: `/tmp/sdk-c-r3-type-{red,green}.log`.

The independent built-root probe also failed TS2305 before repair and passed after rebuilding:

```sh
./node_modules/.bin/tsc --ignoreConfig --noEmit --module NodeNext --moduleResolution NodeNext --target ES2023 --strict --types node --typeRoots "$PWD/node_modules/@types" --skipLibCheck true /tmp/sdk-c-completion-e917-export.mts
```

The probe contains `import type { ExtensionBindings } from '/Users/tonystark/Documents/projects/atomic-sdk-3105-c/packages/coding-agent/dist/index.js'; export type HostBindings = ExtensionBindings;`. Logs: `/tmp/sdk-c-r3-consumer-{red,green}.log`. This is built-checkout type proof, not H's packed-package or full declaration-closure proof.

All validation commands listed above were rerun with `/tmp/sdk-c-r3-` logs: `npm run build` and `npm run check` passed; package groups passed 120 + 20 + 76 tests; root groups passed 20 + 107 + 12 tests, **355 tests in 29 files with no acceptance skips**. The built Node fixture passed with zero output and normal exit. The three duplicate findings are repaired; independent re-review remains separate.

`qlty metrics --functions packages/coding-agent/src/index.ts test/unit/sdk-host-input-contract.test.ts` and `qlty smells` with the same paths completed with no reported findings, using existing configuration. Qlty parsed one file of the two requested paths; no broad lint/coverage claim is made. The combined-package beforeExit listener warning remains disclosed. No runtime, D–H, guide/changelog or external-publication changes were needed. Only this repair's resolved ISSUES.md section was removed; inherited content is unchanged.
