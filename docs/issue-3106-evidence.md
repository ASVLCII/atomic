# Issue #3106 implementation evidence

Contract: the complete issue body captured at `/tmp/atomic-issue-3106.json`. Goal: separate content-bearing routing from registered execution, preserve one instance identity throughout its lifecycle, and report canonical quarter-hour duration estimates. No PR, merge, push or release during implementation.

Rows below define the frozen verification boundaries. Current evidence and outstanding gates are recorded below; a planned boundary alone is not a passing claim.

## Acceptance matrix

| ID | Literal requirement | Verification boundary |
|---|---|---|
| D1 | Exactly 96 finite quarter-hour labels followed by `unknown`, `>1d`; no literal ellipsis | duration enumeration test |
| D2 | `min` below an hour, whole `hr`, combined components, omitted zeros, `1d` exactly 24 elapsed hours | independent expected-label test |
| D3 | Positive estimates round up; below/exactly 15 use `15min`; above one day never clamps | boundary semantics test and criteria |
| D4 | Unknown means insufficient evidence, not long duration | provider criteria test |
| D5 | Wall clock includes critical path, overhead, estimable human waits and inline work | provider payload test |
| D6 | Granularity is not accuracy, guarantee or budget; preserve inherited/explicit budgets | budget regression and guides |
| D7 | One definition derives enum, validation and explicit Jev meanings; direct labels in outputs/renderers | schema/provider/render tests |
| D8 | Both providers support all 98 choices | deterministic inference payload tests |
| D9 | Nested/top-level duration match for inline and missing inputs | tool tests |
| D10 | Presentation at 15min, 1hr, 1hr15min, 23hr45min, 1d, >1d, unknown | render tests |
| D11 | Reject old values, off-grid/out-of-range/malformed; no aliases/parsing/translations | negative validation tests; repository search |
| D12 | Update prompts, affected consumers, README, guides and shipped changelogs | per-location caller inventory, full-file guidance scan and docs diff; final guidance repair below |
| R1 | Exactly route assessment then run execution; no dispatch alias or selection-ID continuation API | public schema/admission tests |
| R2 | Route example uses task, attributed conversation and source/content documents, no workflow-specific inputs | literal issue example test |
| R3 | Named result has exact workflowType, code-owned unique workflowId, estimatedDuration, actual inputSchema/defaults | tool entrypoint test |
| R4 | Inline result has workflowType none, workflowId empty, estimate; no reservation or launch | inline tool test |
| R5 | Reservation is not executing; none is not completion | status listing and guidance test |
| R6 | Run literal example supplies workflowId and inputs; no second routing/extraction call | tool entrypoint test |
| R7 | Run resolves registered definition, preserves input validation, budgets and result semantics | admission tests |
| R8 | Missing/invalid inputs give actionable feedback; same ID remains available for correction | retry test |
| R9 | Task/selection changes require new route, not silently remapping run | overrides/staleness tests |
| R10 | Bind definition/schema identity, owner/session and applicable constraints | ownership/registry tests |
| R11 | Reject absent, empty, unknown, forged, foreign, invalidated and stale IDs; no name/action bypass | negative admission matrix |
| R12 | Preserve authorization/preferences/budgets/approval/cancel/registry checks | existing and new admission tests |
| R13 | First successful admission atomically creates one instance; duplicate/concurrent/lost-response retries never create another | race tests |
| R14 | Same ID supports status/inspection/pause/resume/answer/cancel under ownership rules | lifecycle scenario |
| R15 | Resume preserves checkpoints/completed effects; run/resume/control races have one executor | continuation/race tests |
| R16 | Terminal inspection supported; terminal run relaunch rejected; new route for new execution | terminal test |
| R17 | Distinct IDs can execute independently in parallel | concurrent distinct-ID test |
| R18 | Define cleanup/invalidation/stale errors; never reroute/remap registry changes | invalidation tests and docs |
| R19 | Direct user /workflow needs no reservation; ctx.workflow internal child composition preserved | command/internal tests |
| R20 | Provider/routing/launch failures remain errors, not none/success | failure/cancellation tests |
| R21 | Schemas/descriptions/callers/examples/tests use route-then-run; remove abandoned designs | per-location route/registered-run contract plus obsolete-admission scan; final guidance repair below |
| S1 | task is actual current request; conversation carries roles/text and preserves decisions/unresolved questions | both-provider payload test |
| S2 | Documents carry excerpts or labeled faithful summaries with source metadata; preserve uncertainty | both-provider payload test |
| S3 | Facts/constraints useful and separate from question instructions; no predetermined verdict | payload/question tests |
| S4 | Caller reads authorized sources; no implicit filesystem/network/transcript dereference or filename inference | path-only/unavailable tests |
| S5 | Empty arrays valid; unavailable source limitation explicit; no invented evidence | context tests |
| S6 | Existing credential/privacy filtering applies; bounded relevant excerpts, not transcript dumps | privacy regressions and docs |
| S7 | No quoted-document promotion into user authorization | provider instructions and preference tests |
| S8 | Update schema descriptions/prompts/docs/examples with content requirement | docs/search |
| P1 | Replace duplicated caller selection heuristics with issue's concise route-then-run contract | four caller-entry contracts and eleven full-document scans; final guidance repair below |
| P2 | Remove defaults/triggers/pre-routing architecture/model rituals; retain safety/lifecycle/authoring | guidance inventory plus retained authoring, budget, verification and lifecycle suites; final guidance repair below |
| P3 | Router owns complexity/interaction judgments; simple autonomous work need not workflow; discussion not authorization; approval gates distinct | representative state tests |
| P4 | Named concise JSON facts, runtime contracts, unknowns, no unrelated history/secrets | payload tests |
| P5 | Focused contrasting questions; independent useful judgments batched and combined in code, no dependent parallel answers | provider payload tests |
| P6 | Deterministic validation/authorization/budgets/registration/execution in code; judgments not permission | admission tests |
| P7 | Preserve none/uncertainty; representative cases, no arbitrary confidence thresholds | provider tests |
| P8 | Test simple task, complex autonomous work, exploration, architecture discussion, explicit preferences, deliberate approval | representative fixtures |
| X1 | Jev native choices and non-Jev structured tool have same public contract/state/semantics | both-provider tests |
| X2 | Neither provider generates/authorizes ID; no mandatory Jev call or invented confidence fields for others | payload and reservation tests |
| X3 | Both preserve names/none/reservations/input correction/admission | provider parameterized tool tests |
| X4 | Both invalid outputs/failures/cancel/budget/registry changes tested; probabilistic choices need not match live | deterministic provider tests |
| X5 | Docs provider-independent; TypeSafe guidance not claim all routers Jev | docs review |
| V1 | Read rules, workflow/SDK/router/lifecycle docs and TypeSafe refs | inspection record |
| V2 | Focused deterministic regressions, actual executable scenario, full necessary suites/build/check | command record |
| V3 | Independent literal-criteria falsification and bounded repair | parent review stage |
| V4 | Signed conventional commit, hooks, attribution, clean designated branch | git/hook record |

## Interface and state decisions

Required route input is `state.task`; supporting conversation/documents and known facts may be omitted. Preserve raw text, message roles, duplicates and order. No normalization of evidence. Optional fields remain optional; budget omission and zero retain existing meaning. Workflow definition names remain exact registered names. `workflowId` is the execution UUID, not a definition name; existing lifecycle `runId` accepts that same UUID.

States: reserved -> admitting -> active -> pending-input/paused/blocked -> active -> terminal. Invalid inputs keep reserved; stale owner/registry/definition invalidates admission. Concurrent admitting/active run attempts resolve existing instance or report lifecycle conflict. No terminal -> new execution transition. Existing recoverable failed/blocked checkpoint continuation via explicit resume retains its ID, not a new execution. Nonrecoverable, success, cancelled and killed terminal states remain inspection-only. Every transition must retain one executor, owner, selection, budget and checkpoint effects. Distinct IDs are independent.

## Evidence and constraints

Setup was performed by the preceding worker, not this implementation session. Current branch inspection: `feat/3106-route-registered-run`, initially clean. TypeSafe Choice reference says up to 255 options; 98 is within that contract. Current live/provider, cross-platform and complete implementation validation are pending.

### Caller/provider migration verification, 2026-09-19

- `npm run check` passed, including Biome, root and coding-agent typechecks, and shrinkwrap verification. Log: `/tmp/3106-check-worker2.log`. `npm run build` passed: `/tmp/3106-build-worker.log`. `git diff --check` passed. V2 is supported locally, not a full-suite or cross-platform completion claim.
- Focused unit command: `npx vitest run --project unit test/unit/workflow-estimated-duration.test.ts test/unit/workflow-router.test.ts test/unit/workflow-router-credentials.test.ts test/unit/workflow-router-render.test.ts test/unit/workflow-route-providers.test.ts test/unit/workflow-registered-run.test.ts test/unit/workflow-router-reload.test.ts test/unit/workflow-router-host-reload.test.ts test/unit/workflow-reload-rediscovery.test.ts test/unit/workflow-public-tool-timeout.test.ts test/unit/workflow-lazy-startup-review-followup.test.ts test/unit/execution-routing-guidance.test.ts test/unit/workflow-runtime-guidance.test.ts test/unit/workflow-schema.test.ts`. Result: 14 files, 310 tests passed. Log: `/tmp/3106-unit-final-worker.log`.
- D1–D11: canonical duration, router, provider and renderer suites exercise exact enumeration, all 98 transported schema/Jev choices and selections, boundary meanings, obsolete-value rejection, nested estimates and budget preservation. Jev Choice documentation allows 255 options. This is deterministic adapter/schema evidence, not paid live-provider accuracy evidence.
- S1–S8: provider state tests preserve raw attributed text, whitespace, duplicates/order, empty or omitted arrays, unavailable sources, labeled summaries and explicit quoted constraints. A path can remain a task target. Matching source/content and selected absolute-path/URL-only document forms are rejected before inference; this is not universal path detection. Relative text such as `docs/spec.md` with a different source label reaches inference verbatim, without dereferencing. Existing credential suites verify pre-inference filtering. These tests verify content transport and constraints, not probabilistic model obedience.
- R1–R13, R16–R18, X1–X4: registered-run tests exercise both providers through actual reservation/dispatcher/durable execution, same-ID input correction, four concurrent admissions, no second inference, terminal retry rejection, forged/empty/unknown/foreign/override/omitted-action rejection, stale registry invalidation and distinct IDs with terminal inspection. Reload and real host replacement tests exercise changing contracts and stale in-flight decisions. Public deadline tests exercise lost acknowledgements and retained instance inspection. R14–R15 checkpoint/resume proof remains lifecycle-owner work.
- P1–P8 and D12/R21/X5: removed caller trigger lists from the workflows overview and duplicated README tool-description JSON; replaced run-as-router docs/examples in README, API reference, operations and reliable-design. Guidance tests now enforce the concise route contract and absence of pre-routing architecture/selection rituals while retaining safety, authoring, budgets, heartbeat, side-effect and verifier-reference checks. Representative deterministic judgment-combination cases cover simple work, autonomous implementation, exploration, architecture discussion, inline preferences and deliberate approval gates. Both shipped changelogs record the breaking migration. The repository search found no old duration labels or `literalRequest` in shipped source/guides outside immutable changelog history; negative regression fixtures intentionally contain rejected old inputs.
- Integration command: `npx vitest run --project integration test/integration/workflow-auto-attach.test.ts test/integration/mcp-entrypoint.test.ts test/integration/mock-extension-api-workflow-actions.test.ts test/integration/mock-extension-api-tool-registration.test.ts`. Result: 4 files, 63 tests passed. Log: `/tmp/3106-integration-final-worker.log`. This verifies current registered tool, MCP, direct slash-command and auto-attach entrypoints. Auto-attach initially failed because the factory still looked up obsolete caller `workflow`; it now resolves the admitted result's name. The unchanged failing assertion now passes.
- Executable real-host checks: `npx vitest run --project unit test/unit/workflow-registered-run.test.ts test/unit/workflow-durable-tool-failure-notice.test.ts test/unit/workflow-run-state-real-reload.test.ts test/unit/slash-dispatch.test.ts` yielded 178 passed and four lifecycle-continuation failures. All three non-slash files passed. Log: `/tmp/3106-real.log`. The four old linked/new-ID continuation expectations were handed to the lifecycle integration owner, not waived. This command must be rerun after that repair.
- `qlty metrics --functions packages/workflows/src/extension/workflow-reservations.ts` ran successfully with existing config. Log: `/tmp/3106-qlty.log`. New-module baseline: owner/register/assertOwner/resolve cyclomatic complexity 4/1/10/12, cognitive 0/0/7/6. No preexisting-module performance comparison or plugin lint claim is made. Repository Biome remains authoritative.
- V3/V4 and final broad suites, independent falsification, interactive terminal scenario and signed commit remain parent integration gates. No PR, push, merge, release or commit performed by this parallel worker. No authorized contract scope expansion.
- Final post-documentation checks repeated successfully: `npm run check` (`/tmp/3106-check-worker-final.log`), `npm run build` (`/tmp/3106-build-worker-final.log`), and `git diff --check`. `npx vitest run --project unit test/unit/execution-routing-guidance.test.ts test/unit/workflow-runtime-guidance.test.ts test/unit/workflow-stage-guidance-docs.test.ts test/unit/workflow-authoring-folder-disclosure.test.ts` passed 53 tests (`/tmp/3106-docs-final.log`). Removed remaining fresh-ID/new-ID continuation and run-budget guidance from user guides and the builtin workflow-first-default wording while preserving steering safety.

### Final integrated candidate verification, 2026-09-19

This section supersedes outstanding local gates in the parallel-worker records. Independent literal falsification (V3) remains the parent's next stage, not a completed claim.

| Gate | Actual result | Evidence |
|---|---|---|
| `npm run check` | Passed Biome, both typechecks, shrinkwrap | `/tmp/3106-final-check4.log` |
| `npm run build` | Passed, including bundled extension/SDK | `/tmp/3106-final-build3.log` |
| `npm run test:unit` | 897 files passed; 9871 tests passed, 23 skipped | `/tmp/3106-final-unit4.log` |
| `npm run test:integration` | 83 files passed, 2 skipped; 1161 tests passed, 12 skipped | `/tmp/3106-final-integration3.log` |
| `npm run test:ci-contracts` | 18 files, 114 tests passed | `/tmp/3106-final-ci4.log` |
| `npm run test --workspace=@bastani/atomic` | 566 files passed, 5 skipped; 4929 tests passed, 52 skipped | `/tmp/3106-final-coding-agent2.log` |
| Four-file real-host command above | 184 tests passed | `/tmp/3106-real-final2.log` |
| Registered-run and caller-guidance suites | 47 tests passed, including both providers' public route/correction/run/controls/input/terminal scenario | `/tmp/3106-e2e-route-lifecycle.log` |
| Qlty function metrics | Exit 0 for reservations, engine run, child primitive and finalizers; existing config unchanged | `/tmp/3106-final-qlty.log` |

The coding-agent full baseline preceded the final notification-only repair: removed linked-run notice data/text, migrated the same-ID regression, and corrected operations/heartbeat/runtime comments. That repair was red/green in `/tmp/3106-notice-red.log` and `/tmp/3106-notice-green.log`, then covered by the final full units/integrations, build, check and CI above. A redundant third coding-agent run was interrupted before any result (`/tmp/3106-final-coding-agent3.log`), not counted as a pass. No coding-agent implementation changed after its passing baseline. Existing skips were not added or expanded. No unrelated failures are waived.

#### Repair evidence and matrix coverage

- R14–R15/R19: slash-dispatch reproduced four failures in `/tmp/3106-integration-repro.log`; fixtures now require same execution ID, one snapshot, completed durable state and no replayed effects. Added missing durable registration to snapshot-only fixtures rather than restoring snapshot forks. Final 164 slash tests pass in the real-host command. Full integrations additionally exercise built Node CLI direct `/workflow` launch, pause/quit/resume, checkpoint retention, child composition and pending input.
- D6/R7/R12: same-ID replacement exposed a token-meter baseline defect. `run.ts` now meters the execution snapshot rather than its discarded predecessor; the 200 retained + 80 fresh = 280 token ceiling regression remains unchanged. Red: `/tmp/3106-budget-guidance-red.log`; green: `/tmp/3106-repairs-green.log` (241 tests), plus full units.
- R15/R20: DBOS frontier tests exposed absorbing nonresumable metadata for a refused completed exit, and a child boundary persisted before the frontier guard. Frontier refusal now remains recoverable; invalid output contracts stay nonresumable. Child admission validates before publishing a boundary. All 56 adversarial frontier scenarios pass (`/tmp/3106-frontier-green.log`), including corrected retry without repeated completed effects; full integrations also pass.
- P1–P8/R21: removed the remaining subagent workflow-by-default mandate, retained scoped preferences/safety, and added deterministic rejection of that mandate to composed-guidance tests. The notice regression verifies one identity and no spurious start. No abandoned model-tool dispatch/selection-ID path was added.
- D1–D12/S1–S8/X1–X5: canonical-duration, provider, router, credentials, renderer and reload suites ran in the full units. `workflow-route-providers.test.ts` transports all 98 values through both adapters and preserves attributed excerpts, summaries, unavailable-source limitations and quoted constraints. Router tests cover invalid output, errors, timeout/cancellation, strict budgets, registry mutation, inline judgments, provider choice and direct/internal exceptions. This is deterministic schema/adapter evidence, not a paid live-provider estimate-accuracy claim.
- R1–R13/R16–R18: registered-run, router, reload and public deadline suites cover code-owned admission, ownership, selection/schema, input correction, concurrent admission, terminal refusal, distinct IDs, invalidation and lost acknowledgement. Active-blocked claim tests cover concurrent runtime views and terminal control winning admission. Initialization cancellation tests verify delayed claims restore durable state rather than leaving orphan executor claims.
- Clean-break search: `/tmp/3106-clean-break-search.log` contains only five obsolete duration strings, all explicit rejection fixtures. No `literalRequest` or `selectionId` remains in scanned shipped sources/guides/tests. Internal dispatch and authored child execution remain execution mechanisms, not model-tool bypasses. No duration alias or translation was introduced.
- V1/V2: full issue/local rules read; TypeSafe index/state/building/choice references fetched successfully (response `mu8ud9q9ifzb3d`). Actual public-tool/durable execution and built Node CLI RPC scenarios provide executable evidence. No interactive TUI visual change required separate terminal automation; no terminal screenshot or live inference claim is made.
- V4: signing and isolated hooks inspected (`commit.gpgsign=true`); final signed candidate/hash and hook outcome are in the handoff. No PR, push, merge, release, additional worktree or original-checkout edit. Root `progress.md` and resolved `issues.md` are removed before staging; progress remains in the assigned external artifact.

### Consolidated independent-review repair, 2026-09-19

Independent reviews of `56830184ffc65b140887173c2c4639853733da11` falsified its R10/R12/R14 ownership and explicit-preference claims despite the preceding passing suites. Those historical results are not evidence for the repairs below. No legacy router, compatibility admission path, keyword authorization or duration translation was added.

**Shared ownership defect:** the tool checked a raw optional selector against a disposable reservation map, while lifecycle handlers normalized/defaulted/resolved other targets. Missing map entries allowed access. The repair records the admitted model caller in authoritative run snapshots, session entries and durable metadata; preserves it through continuation and DBOS hydration; and authorizes canonical targets before inspection/control. Agent-origin instances missing ownership fail closed. Direct-user commands and internal composition retain their exceptions. Bulk controls preauthorize all affected in-flight roots before the first mutation; same-owner default/prefix/padded/all selectors remain supported.

**Provider defect:** explicit structured `executionPreference: "inline"` was merely model context. Both adapters could return contrary executable/named judgments and obtain a reservation. The common deterministic combination now forces `none` for this constraint before registration. Provider failures and budget validation still remain errors. The two guides now describe `maxBudget` as a preserved override declaration, not resolved inherited limits.

#### Exact red/green commands

| Command | Red evidence | Green evidence |
|---|---|---|
| `npx vitest run --project unit test/unit/workflow-registered-run.test.ts -t 'foreign caller cannot pause'` | Missing expected rejection at implicit pause; `/tmp/3106-owner-default-red.log` | 1 passed; `/tmp/3106-owner-default-green.log` |
| `npx vitest run --project unit test/unit/workflow-registered-run.test.ts -t 'ownership survives model tool'` | Missing expected rejection after tool recreation; `/tmp/3106-owner-recreate-red.log` | Entire registered-run suite then passed 9 tests; `/tmp/3106-owner-recreate-green.log` |
| `npx vitest run --project unit test/unit/workflow-registered-run.test.ts -t 'contrary to explicit inline'` | Both providers returned `registered`, expected `none`; `/tmp/3106-inline-red.log` | Final three-file command below passes both unchanged new assertions |
| `npx vitest run --project unit test/unit/workflow-registered-run.test.ts test/unit/workflow-router.test.ts test/unit/workflow-route-providers.test.ts` | Above independent red cases | Initial 101 passed (`/tmp/3106-inline-green.log`); final 105 passed (`/tmp/3106-repair-focused-final.log`) |

The final public-tool regressions exercise actual route/reservation/runtime/durable execution: foreign/default/empty/padded/uppercase-prefix controls and inspections, paused resume, pending prompt answers, terminal retention, same-owner bulk success, mixed-owner bulk atomic refusal, tool recreation, fresh runtime/store checkpoint continuation with no repeated completed effect, and terminal inspection after **serialized DBOS SDK fixture storage** is restored into a new SDK/backend/runtime/store. Unknown/omitted-action/terminal run admission remains closed. The DBOS fixture proves metadata serialization/hydration, not a real PostgreSQL process restart. Same-session identity uses a stable session ID; an unattributed object caller has only object-local authority, not invented cross-restart identity.

The six representative independent judgment scenarios now run through both Jev and structured adapters. Both also test verbatim relative path-like content without implicit dereference. This is deterministic transport/combination evidence, not live-model judgment accuracy.

#### Broader validation after repair

| Command | Result | Log |
|---|---|---|
| `npm run test:unit` | 897 files passed; 9890 tests passed, 23 existing skips | `/tmp/3106-repair-unit.log` |
| `npm run test:integration` (bounded final rerun) | 83 files passed, 2 skipped; 1161 tests passed, 12 existing skips | `/tmp/3106-repair-integration-rerun.log` |
| `npm run test:ci-contracts` | 18 files, 114 tests passed | `/tmp/3106-repair-ci.log` |
| `npm run check` | Biome, both typecheck passes, shrinkwrap passed | `/tmp/3106-repair-check-final.log` |
| `npm run build` | Passed including native and bundled extension/SDK assets | `/tmp/3106-repair-build.log` |

These runs supersede the affected pre-repair unit/lifecycle/integration/build/check gates above. The coding-agent package suite was not rerun in this repair; its previous result remains historical. No coding-agent implementation was changed.

Validation failures were diagnosed, not waived: the new own-bulk fixture initially checked before both executors reached its barrier (`/tmp/3106-repair-affected.log`, 458 passed/1 failed); it now awaits both actual executors and still requires “Paused 2 run(s).” A draft quit/restart fixture incorrectly awaited termination of a deliberately paused live executor; the durable-recovery fixture instead uses a real recoverable checkpoint interruption. Two integration empty-session status tests inherited another test's owned snapshots (`/tmp/3106-repair-integration.log`); their setup now clears that shared fixture store, retaining their original assertions and the new foreign-owner rejection tests. Full integrations then exposed an unchanged, out-of-scope `subagents-zero-process` process-probe failure (`6481:(node)`, `/tmp/3106-repair-integration-full.log`); its focused command `npx vitest run --project integration test/integration/subagents-zero-process.test.ts` passed (`/tmp/3106-zero-process-focused.log`) and the bounded full rerun passed without subagent edits. The transient process-probe cause is unproven, not claimed fixed. No tests were suppressed, serialized, or granted larger timeouts.

Root generated `progress.md` was removed; isolated progress remains under `subagent-artifacts/progress/ownership-repair/progress.md`. Resolved in-scope issues are removed before staging. Follow-up signing/hook outcome and commit identity are recorded in the handoff; independent parent reverification remains required.

### Final consolidated guidance repair, 2026-09-19

**Correction to prior readiness:** the earlier P1/P2/D12/R21 and clean-break guidance claims were incorrect. The latest consolidated review of `bb6d0f09e` found obsolete workflow-default mandates in the package README, first-session guide and playbook, and run-as-router instructions in reliable-design. All reviewers reported `stop=false`. The historical passing tests and narrow obsolete-field search above did not prove the requested clean break. The old guidance test even required `Default to a workflow` somewhere in concatenated documentation, allowing an updated section to mask an obsolete caller elsewhere.

Read the full issue and its literal amendment, all four consolidated findings, and the complete affected guides. `git log -2 -p -- packages/workflows/README.md packages/coding-agent/docs/getting-started/first-session.md docs/workflow-playbook.md packages/coding-agent/docs/workflows/reliable-design.md` recorded the partial previous migration in `/tmp/3106-guidance-history.log`. Replaced the obsolete mandates in place with the issue's short content-bearing route → registered-run contract. Removed the reliable-design inline/workflow ladder, complexity thresholds, ten-call trigger and scoring rubric rather than retaining them under an authoring disclaimer. Kept definition design, coverage matrices, DAG, model assignment, verification, safety and lifecycle guidance. Nearby contradictions were corrected: README name-plus-inputs admission and fresh-ID resume prose; reliable-design run-budget prose; first-session's unconditional prelaunch confirmation claim. No runtime or compatibility path changed, and no new changelog entry was added for this guidance/evidence delta.

The deterministic inventory independently checks the contract in each of the four caller-entry sections and scans all eleven documentation paths (now including first-session) for policy-pattern contradictions. Positive section contracts prevent an appended instruction elsewhere from satisfying the test. Pattern checks cover defaults, tiny-chat restrictions, structural/loop triggers, numeric selection thresholds, run-as-router state and name-plus-input admission, rather than only the exact reported sentences. Same-ID resume and the existing authoring/safety suites remain required. These are deterministic documentation checks, not proof that every possible paraphrase or live-model interpretation is covered.

| Exact command | Outcome | Log |
|---|---|---|
| `npx vitest run --project unit test/unit/execution-routing-guidance.test.ts` before guide edits | Red: 10 failed, 46 passed; failures cover every reported caller, surrounding heuristic omissions and README resume identity | `/tmp/3106-guidance-red.log` |
| `npx vitest run --project unit test/unit/execution-routing-guidance.test.ts test/unit/workflow-runtime-guidance.test.ts test/unit/workflow-stage-guidance-docs.test.ts test/unit/workflow-authoring-folder-disclosure.test.ts` after initial repair | 68 passed, 1 failed: budget paragraph lost the existing explicit-field preservation phrase; restored that valid wording without weakening its assertion | `/tmp/3106-guidance-green.log` |
| Same four-file command after correction | Green: 4 files, 69 tests passed | `/tmp/3106-guidance-green-final.log` |
| `npm run check` | Exit 0: Biome, both typecheck passes and shrinkwrap passed | `/tmp/3106-guidance-check.log` |
| `npm run build` | Exit 0: native build, coding-agent assets, bundled extensions/SDK built | `/tmp/3106-guidance-build.log` |
| `qlty smells --include-tests test/unit/execution-routing-guidance.test.ts` | Exit 0; one high-total-complexity finding, 193 versus baseline 180; no duplication finding | `/tmp/3106-guidance-qlty-tests.log` |
| `git show HEAD:test/unit/execution-routing-guidance.test.ts > /tmp/3106-guidance-baseline.ts`; `cp /tmp/3106-guidance-baseline.ts .atomic-test-fixtures/3106-guidance-baseline.ts`; `qlty smells --include-tests --no-snippets .atomic-test-fixtures/3106-guidance-baseline.ts`; `rm .atomic-test-fixtures/3106-guidance-baseline.ts` | Baseline analysis exit 0, existing high-total-complexity 180; temporary fixture removed | `/tmp/3106-guidance-qlty-baseline-local.log` |
| `npx --no-install prek validate-config prek.toml` | All configs valid | terminal output |
| `git diff --check` | Passed | terminal output |

Qlty config was preserved. The first `qlty smells test/unit/execution-routing-guidance.test.ts` excluded tests and analyzed zero files (`/tmp/3106-guidance-qlty.log`), so it is not quality coverage. The baseline attempt outside the repository (`qlty smells --include-tests --no-snippets /tmp/3106-guidance-baseline.ts`) exited 99 with a path-prefix error (`/tmp/3106-guidance-qlty-baseline.log`); the local temporary-fixture command above supplied the actual baseline. The aggregate complexity warning comes from this existing large assertion suite plus the per-location inventory; no production complexity changed. Biome initially requested test formatting; corrected before the passing authoritative check. Optional plugin lint was not run because this repo uses Biome as its authoritative checker. Full runtime suites were not gratuitously repeated for this docs/test-only delta; their earlier outcomes remain historical, not rerun claims. Parent independent verification is still required before readiness is asserted. Signed commit and enabled-hook results are recorded in the repair handoff.

## Deferred work

None identified.

## Contract amendments received

"to clarify we don't want any legacy code/workflow router, no backwards compat, clean break"

Audit the final tree for obsolete router paths, run-as-router admission, old schemas/state fields/guidance, compatibility aliases/adapters/fallback parsing. Preserve both providers and direct-user/internal execution exceptions. Supervisor's failed/blocked checkpoint interpretation remains an interpretation, not a user amendment.
