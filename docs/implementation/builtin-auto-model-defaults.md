# Builtin automatic model defaults

## Frozen contract

Make every builtin workflow and subagent default to `model: "auto"` through the existing router, preserving explicit selections and supported constraints. Work only in the designated feature checkout; do not change main-chat defaults or user-authored resources. Add regression tests, actionable user guides and shipped changelogs, validate, commit locally and obtain independent review. No PR or push in this stage.

## Acceptance matrix

| Literal requirement | Current-checkout evidence | Result |
| --- | --- | --- |
| All builtin workflow stages, reusable child runs, schemas and helpers default to literal `model: "auto"` | `builtin-auto-model-defaults.test.ts` inventories all nine manifest exports and model literals; `builtin-workflow-steering-propagation.test.ts` checks captured stages across eight workflows; design's existing execution test checks every stage | Passed |
| All builtin subagents default to `model: "auto"` | Loader-based inventory asserts all nine shipped definitions, no fallback chains | Passed |
| Defaults actually use the new router | `subagent-model-router-execution.test.ts` loads the shipped worker and exercises single/parallel execution without model arguments; `workflow-stage-auto.test.ts` runs a composed builtin child through the actual executor, structured router and artifact output | Passed, inference and child session responses are deterministic fixtures |
| Explicit user model selections remain effective | Concrete per-call override bypasses inference; task/chain/parallel precedence and tournament explicit ordered assignments tested | Passed |
| Explicit user effort selections remain effective | Real settings loader and builtin override merge cover inherited effort clearing via `thinking: ""` and `false`; primary effort, explicit fallback suffixes and agent/call hard constraints retain coverage | Passed after empty-clearing repair; earlier readiness missed this accepted input |
| Meaningful supported router safety/capability constraints remain | Existing cost/context/input/effort, empty eligibility, conflict, cancellation and fallback tests; preserved Goal/Ralph tool exclusions and reviewer schema identity | Passed |
| No concrete fallback pins accidentally bypass auto | Removed chains from nine agents, Goal/Ralph role configurations and design; inventory rejects builtin fallback declarations; invalid routing admits no child | Passed |
| Do not change main-chat defaults | No diff in main-chat model-default source; full unit run's main-chat fallback and router-isolation tests pass | Passed |
| Do not change user-authored resources | No `.atomic` resource edits; public steering-only helper unchanged; custom omitted model and custom-auto legacy fallback behavior tested | Passed |
| Work only in the designated separate checkout, with distinct branch before edits; independent of caching task | Parent preflight created `feat/builtin-auto-model-defaults` from clean detached `4c332f6f32abc34fb8575316deafe5c839a0985d`; all implementation commands use `/Users/tonystark/Documents/projects/atomic-auto-model-defaults` | Preserved |
| Inspect instructions, history/contributor conventions and workflow/subagent/routing docs before implementation | Parent/initial worker inspected AGENTS, CLAUDE, DESIGN, PRODUCT, CONTRIBUTING, setup/manifests, recent Git signatures and merged PRs; guide reads covered workflows, subagents, authoring/operations/builtins/API/verification/reliable-design and model-selection/evaluation references | Recorded in worker transcripts; relevant routing references rechecked during implementation |
| Add durable regression coverage | New inventory and default/override tests demonstrated failure on the old concrete/omitted defaults; effort test failed before constraint handling; existing integration wiring fixtures now supply the router rather than bypass it | Passed |
| Actionable user docs and appropriate shipped changelogs consistent | Updated guides and Unreleased entries; review repair adds provider-guide consistency regression and clarifies fallback effort precedence | Passed after correcting provider-guide omissions |
| Run appropriate repository checks and report truthful evidence/limitations | Latest narrow repair: check/build passed, 89 focused tests, 8 config-inheritance tests and 17 runtime-wiring integration tests passed | Earlier full-suite counts are historical, not rerun for this one-line repair |
| Verify and independently review | Workflow reviewers identified accepted empty thinking after the earlier repairs; real-settings red/green regression now covers it | Parent owns independent review of this correction |
| Local descriptive commit and clean tree, no PR | Signed conventional commit with `Assistant-model: GPT-6-Astra`; exact SHA and final porcelain result belong in the completion receipt | Commit performed after this note's final update |
| Parent-owned TODO-05a15d29 | Not modified by implementation worker | Parent closes after completion |

## Inventory and interface decisions

The nine workflows are `adversarial-verification`, `classify-and-act`, `fan-out-and-synthesize`, `generate-and-filter`, `goal`, `loop-until-done`, `open-claude-design`, `ralph` and `tournament`. Each entrypoint applies the internal builtin context. It covers tasks, chains and parallel stages, including Goal re-verification, shared warm-first scoring, progress scoring, repair and optional final PR stages. Nested builtin definitions apply their own context. No builtin currently creates a model stage through `ctx.stage` directly.

Correction to the initial inventory: the build's eleven entries are nine workflows plus `index` and the public steering-context helper, not two additional child workflows. Every builtin definition can be reused as a child. No workflow input schema supplies a concrete model default; tournament's optional `models` list is the caller-controlled exception.

The internal builtin context defaults only absent models. Step model wins over shared chain/parallel model; explicit values, effort, constraints and existing prompt processing remain intact. The existing exported `withSteeringPropagationContext` does not change user-workflow inheritance. Context delegation retains live getters such as `cwd`.

No public return or field shapes change. Optional fields remain optional; tournament omitted `models` leaves `model_assignment` absent, empty models produces `{}`, and duplicates/order remain intact. No new normalization, deduplication or error family was added. Router selection remains exactly `{ model, effort }`, with supported `off` distinct from `null`.

Builtin `thinking` values originate in user overrides after removal of shipped pins. The narrow primary-selection intersection applies only to `source: "builtin"`. Fallback eligibility uses only actual model constraints, so explicit candidate suffixes retain precedence over legacy thinking. The recorded primary selection is reused to build this eligibility check without another inference. Existing tests require custom user-authored auto agents' legacy thinking to remain router-controlled; that behavior is preserved. User/project builtin override precedence is unchanged. Explicit concrete primary suffixes still use the existing non-auto path.

Routing states remain pending selection, validated concrete selection, execution and terminal result. Invalid/no-eligible/stale/provider/cancelled selection starts no child. Fallback is constrained and does not reroute or change main chat. Replay/resume retain the recorded selection and revalidate eligibility. Existing workflow-stage-auto and subagent router suites exercise these transitions, including cancellation and fallback restrictions.

## Initial implementation commands and results

Environment: macOS arm64, Node `v26.8.2`, Bun `1.4.2`, qlty `0.642.0`.

- Parent preflight: `npm ci --ignore-scripts` and `npm run build`, exit 0.
- Red/green: `npx vitest run --project unit test/unit/builtin-auto-model-defaults.test.ts` initially failed on Astra versus auto, then on undefined versus auto; both passed after changes. The explicit effort test in `subagent-model-router.test.ts` failed before its routing change and passed afterward.
- Focused model/builtin/router suites: 27 files, 229 tests passed before the additional nested-child regression. The final full unit run also passes all these tests and the added nested-child/skill assertions.
- `npm run check`, exit 0. Biome, both typecheck passes and shrinkwrap check passed. Log: `/tmp/atomic-auto-check-final.log`.
- `npm run build`, exit 0, including generated model validation, native build, nine workflow bundles and companion assets. Log: `/tmp/atomic-auto-build-final.log`.
- Final `npm run test:unit`, exit 1: 9962 passed, 23 skipped, six baseline failures in five files. Log: `/tmp/atomic-auto-unit-verified.log`.
- Final `npm run test:integration`, exit 0: 1161 passed, 12 skipped, 83 files passed and two skipped. Log: `/tmp/atomic-auto-integration-verified.log`.
- `node packages/coding-agent/dist/cli.js --help`, exit 0. Log: `/tmp/atomic-auto-cli-help.log`.
- Compiled Node smoke imported `dist/builtin/workflows/builtin/index.js`, asserted nine runnable definitions and read all nine packaged agent files, asserting `model: auto` and no `fallbackModels`. Output: `Compiled Node package: 9 builtin workflows import; 9 builtin agents default to auto without pinned fallbacks.`
- `qlty smells packages/workflows/builtin/builtin-context.ts packages/subagents/src/runs/shared/model-router.ts`, exit 0, no smells. `qlty metrics --functions` on those same files completed. Logs: `/tmp/atomic-auto-qlty-{smells,metrics}.log`.
- Existing `.qlty/qlty.toml` preserved. `qlty check` reported no modified files applicable to configured checks, so it provides no plugin-lint coverage; repository Biome remains authoritative. Only built-in qlty metrics/smells are claimed.
- `git diff --check`, exit 0. No main-chat default or project-resource diff.

Provider inference and child responses are controlled fixtures, not paid live-provider execution. The nested builtin scenario runs actual composition, routing, execution admission, schema capture and artifact creation. No UI behavior changed, so a fabricated browser/TUI scenario was not used. Node compiled-package CLI/import smoke is separate from the fixture-backed routing evidence. Windows and the entire coding-agent-local suite were not run.

## Deferred baseline issues

Parent's read-only debugger reproduced six failures in unchanged files and compared their asserted sources byte-for-byte with baseline `4c332f6f3`:

- `execution-routing-guidance.test.ts`: missing source-layout wording in workflow authoring docs.
- `workflow-extension-hook-guidance.test.ts`: missing entry-file guidance wording in the same docs.
- `workflow-docs-host-portability.test.ts`: missing both-hosts wording.
- `package-metadata.test.ts`: already-absent `packages/coding-agent/docs/mcp.md`.
- `pi-0.84.2-docs-contract.test.ts`: two existing wording failures for `fullscreenExitOutput` and `pi-tui 0.85.1`.

Reproduce with `npm run test:unit -- test/unit/workflow-extension-hook-guidance.test.ts test/unit/execution-routing-guidance.test.ts test/unit/package-metadata.test.ts test/unit/pi-0.84.2-docs-contract.test.ts test/unit/workflow-docs-host-portability.test.ts --reporter=dot`. Debugger result: six failed, 95 passed; final full run confirms exactly these six remain. They do not concern model defaults and were not fixed in this change.

Setup/contributor documentation also contains stale minimum-release-age and SQLite guidance. Follow AGENTS.md and current manifests; unrelated corrections are deferred.

## Review repair and corrected claims

The latest consolidated review contained three findings with two root causes. The two provider-guide findings describe the same stale paragraphs. Both root causes are fixed; the earlier blanket claims of complete effort preservation and documentation consistency were incorrect.

1. `providers.md` still promised fixed Grok/GLM chains and Luna/Astra/Fable role defaults. Its builtin policy now describes auto and links to override/constraint instructions. Main-chat xAI, Z.AI and Baseten defaults are unchanged. The new provider-guidance test failed on the obsolete Grok-chain sentence before the edit and passes afterward; it checks all five obsolete claims and retention of session defaults.
2. Builtin legacy thinking was incorrectly included in fallback hard constraints. Primary routing still intersects that requested effort with real constraints. The existing recorded-selection path now validates fallback eligibility using only real constraints, with no second inference. The real loader/override/dispatch regression failed when `thinking: "low"` dropped `decision-test/fallback:high`, then passed after repair. Its call-level and agent-level `allowedEfforts: ["low"]` cases still remove that fallback. Existing custom-agent effort behavior and primary conflict rejection remain covered. The previous test asserting that legacy thinking alone rejects a suffixed fallback was corrected, not suppressed.

Repair checks, all in the designated feature checkout:

- `npm run test:unit -- test/unit/subagent-routed-fallback-effort.test.ts`: red, 1 failed and 6 passed; the added builtin dispatch assertion failed before repair.
- `npm run test:unit -- test/unit/builtin-auto-model-defaults.test.ts`: red, 1 failed and 7 passed; provider-guide contradiction reproduced before repair. Green, all 8 passed afterward.
- `npm run test:unit -- test/unit/builtin-auto-model-defaults.test.ts test/unit/subagent-model-router.test.ts test/unit/subagent-model-router-execution.test.ts test/unit/subagent-routed-fallback-effort.test.ts test/unit/workflow-stage-auto.test.ts`: 5 files, 87 passed. The final constraint-snapshot regression also failed before its correction, then passed; mutation during inference cannot widen fallback eligibility and inference still runs once.
- Final `npm run test:unit`: 9965 passed, 23 skipped, six previously proven baseline docs failures; 897 files passed, 5 failed. Exit 1. The default-tools timeout did not recur in either full repair run.
- `npm run check` and `npm run build`: exit 0.
- `npm run test:integration`: 1161 passed, 12 skipped; 83 files passed, 2 skipped. Exit 0.
- Compiled Node smoke imports nine workflow definitions and the subagent extension; all nine packaged agent definitions declare auto without fallback pins. Passed.
- `qlty smells packages/subagents/src/runs/shared/model-router.ts`: exit 0, no smells. `qlty metrics --functions` completed. Existing configuration preserved; qlty fmt had no applicable formatter, so repository Biome formatted the four changed TypeScript files and `npm run check` supplied lint/typecheck coverage. No plugin-lint claim.
- `git diff --check`: passed. No changes to main-chat defaults, user resources, test timeout policy or unrelated loader behavior.

Logs and diagnostic artifacts are retained in the workflow artifact directory's `repair-evidence/`, including `auto-repair-{effort-red,effort-green,docs-red,docs-green,snapshot-red,focused-final,unit-final,check,build,integration-final}.log`. The artifact directory is `/Users/tonystark/.atomic/workflows/runs/2b322c89-0b20-4343-9d51-3af0f75cece9/artifact-4f0d021e-5f71-45ed-ad9f-22123b90f6ab`.

### Default-tools timeout diagnosis

Review observed `defaultTools setting > preserves explicit tool option precedence over the setting` timing out at 30017ms. A focused passing retry alone did not identify its cause. This repair investigated its execution:

- The test constructs three real sessions sequentially; each SDK session composes mandatory builtin extensions even with a supplied resource loader. This behavior was introduced by `64e6f83b2`, before this change.
- Temporary phase instrumentation measured the three session creations at 3893ms, 3986ms and 3978ms, versus 3–4ms for each initial empty resource reload. Every session had zero messages. The test passed at 11869ms.
- A repeatable V8 CPU/precise-coverage probe passed at 14584ms. Of 14481ms profiled time, the largest entries were Jiti resolution at 5310ms and `node:fs` `statSync` at 4569ms, plus Jiti alias normalization at 589ms. Coverage recorded zero calls to `routeExecutionModel`, `routeSubagentModel` and `withBuiltinContext`. This is session-loading work, not a slow automatic model decision or child execution.
- Byte comparisons against base `4c332f6f3` confirmed the test, SDK factory, builtin resource loader, general resource loader, mandatory resource loader and package lock are unchanged. The expensive loader/dependency path predates the patch. Temporary instrumentation was removed and the original test's bytes restored.
- The full unit run now completes without the timeout. We classify the additional review failure as an existing session-loader load-sensitivity issue, not an auto-default behavior regression. The exact historical scheduler/filesystem pressure is not reconstructable and is not claimed proven. Optimizing unrelated Jiti loading is deferred; no timeout, concurrency or suite-serialization change was made.

To repeat the diagnostic from this checkout, run `python3 <artifact-directory>/repair-evidence/auto-profile-default-tools.py`. The script copies only this one test into a temporary sibling, enables Node's inspector profiler around the exact precedence case, runs the normal Vitest command with its unchanged budget, and removes the scratch test in `finally`. It writes `/tmp/auto-default-tools-profile.json` and `/tmp/auto-default-tools-coverage.json`. The retained script, profile, coverage and logs make the diagnosis inspectable without editing production files or creating another checkout.

## Empty legacy effort review repair

The next consolidated batch contained the same empty-thinking defect from all three reviewers. Earlier readiness was incomplete: the settings loader accepts and preserves `thinking: ""`, but builtin routing converted it to invalid `allowedEfforts: [""]`. The one-line correction excludes exactly the empty clearing value from the legacy primary-effort restriction. It does not normalize settings, widen actual constraints, or change custom-agent behavior.

The persistent regression in `subagent-model-router.test.ts` writes a real settings file, loads it with `readMergedSubagentSettings`, and applies it to the shipped worker over an inherited `thinking: "high"`. Empty and `false` clearing values both route successfully to a nonreasoning model with effort `null`, using one inference. An actual `allowedEfforts: ["high"]` restriction still rejects before another inference. The loader preserves the empty value; routing alone treats it as no legacy restriction.

- Red: `npm run test:unit -- test/unit/subagent-model-router.test.ts`, exit 1, 1 failed and 29 passed. The new empty-setting case threw `Invalid modelConstraints` at `model-routing-constraints.ts:57` before inference. Log: `empty-repair-evidence/auto-empty-red.log`.
- Green: same command, 30 passed before adding the already-supported `false` case.
- Final focused command: `npm run test:unit -- test/unit/builtin-auto-model-defaults.test.ts test/unit/subagent-model-router.test.ts test/unit/subagent-model-router-execution.test.ts test/unit/subagent-routed-fallback-effort.test.ts test/unit/workflow-stage-auto.test.ts`, exit 0, 89 passed. Prior suffix, constraint-snapshot, cancellation and custom-agent scenarios remain covered.
- `npm run test:unit -- test/unit/subagents-parent-config-inheritance.test.ts`, exit 0, 8 passed.
- `npm run test:integration -- test/integration/runtime-wiring.test.ts`, exit 0, 17 passed.
- `npm run check` and `npm run build`, exit 0. qlty smells and function metrics completed on the changed router with no smells. Existing qlty configuration has no formatter plugins; scoped repository Biome formatting and the check command supplied authoritative formatting/lint coverage.
- No full unit/integration rerun for this narrow repair. Earlier baseline documentation failures and loader profiling remain historical evidence; no live-provider or Windows validation is claimed.

Logs are retained under the workflow artifact directory's `empty-repair-evidence/`. User guidance explains how empty/false clears inherited legacy effort without clearing hard constraints; the existing Unreleased default-change entry now includes empty clearing compatibility. No contract amendments or deferred scope additions.

## Contract amendments received

No user-authored contract amendments received. Supervisor implementation direction allowed a builtin-only context and the smallest existing-router-compatible handling needed to preserve explicit builtin effort overrides. No scope expansion or router redesign was performed.
