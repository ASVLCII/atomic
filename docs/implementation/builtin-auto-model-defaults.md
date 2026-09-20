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
| Explicit user effort selections remain effective | Actual builtin loader plus user/project override merge proves project `thinking: high` wins over user `low`, restricts selection/fallback and intersects hard constraints; existing suffix tests remain green | Passed |
| Meaningful supported router safety/capability constraints remain | Existing cost/context/input/effort, empty eligibility, conflict, cancellation and fallback tests; preserved Goal/Ralph tool exclusions and reviewer schema identity | Passed |
| No concrete fallback pins accidentally bypass auto | Removed chains from nine agents, Goal/Ralph role configurations and design; inventory rejects builtin fallback declarations; invalid routing admits no child | Passed |
| Do not change main-chat defaults | No diff in main-chat model-default source; full unit run's main-chat fallback and router-isolation tests pass | Passed |
| Do not change user-authored resources | No `.atomic` resource edits; public steering-only helper unchanged; custom omitted model and custom-auto legacy fallback behavior tested | Passed |
| Work only in the designated separate checkout, with distinct branch before edits; independent of caching task | Parent preflight created `feat/builtin-auto-model-defaults` from clean detached `4c332f6f32abc34fb8575316deafe5c839a0985d`; all implementation commands use `/Users/tonystark/Documents/projects/atomic-auto-model-defaults` | Preserved |
| Inspect instructions, history/contributor conventions and workflow/subagent/routing docs before implementation | Parent/initial worker inspected AGENTS, CLAUDE, DESIGN, PRODUCT, CONTRIBUTING, setup/manifests, recent Git signatures and merged PRs; guide reads covered workflows, subagents, authoring/operations/builtins/API/verification/reliable-design and model-selection/evaluation references | Recorded in worker transcripts; relevant routing references rechecked during implementation |
| Add durable regression coverage | New inventory and default/override tests demonstrated failure on the old concrete/omitted defaults; effort test failed before constraint handling; existing integration wiring fixtures now supply the router rather than bypass it | Passed |
| Actionable user docs and appropriate shipped changelogs consistent | Updated subagent guide/reference, builtin workflow guide, model-selection guide, subagent README/skill; Changed entries in coding-agent, workflows and subagents Unreleased sections | Passed |
| Run appropriate repository checks and report truthful evidence/limitations | Check/build passed; full integration passed; full unit leaves only six independently proven baseline documentation failures | See commands below |
| Verify and independently review | Writer validation below; fresh independent review is parent-owned | Independent review pending |
| Local descriptive commit and clean tree, no PR | Signed conventional commit with `Assistant-model: GPT-6-Astra`; exact SHA and final porcelain result belong in the completion receipt | Commit performed after this note's final update |
| Parent-owned TODO-05a15d29 | Not modified by implementation worker | Parent closes after completion |

## Inventory and interface decisions

The nine workflows are `adversarial-verification`, `classify-and-act`, `fan-out-and-synthesize`, `generate-and-filter`, `goal`, `loop-until-done`, `open-claude-design`, `ralph` and `tournament`. Each entrypoint applies the internal builtin context. It covers tasks, chains and parallel stages, including Goal re-verification, shared warm-first scoring, progress scoring, repair and optional final PR stages. Nested builtin definitions apply their own context. No builtin currently creates a model stage through `ctx.stage` directly.

Correction to the initial inventory: the build's eleven entries are nine workflows plus `index` and the public steering-context helper, not two additional child workflows. Every builtin definition can be reused as a child. No workflow input schema supplies a concrete model default; tournament's optional `models` list is the caller-controlled exception.

The internal builtin context defaults only absent models. Step model wins over shared chain/parallel model; explicit values, effort, constraints and existing prompt processing remain intact. The existing exported `withSteeringPropagationContext` does not change user-workflow inheritance. Context delegation retains live getters such as `cwd`.

No public return or field shapes change. Optional fields remain optional; tournament omitted `models` leaves `model_assignment` absent, empty models produces `{}`, and duplicates/order remain intact. No new normalization, deduplication or error family was added. Router selection remains exactly `{ model, effort }`, with supported `off` distinct from `null`.

Builtin `thinking` values originate in user overrides after removal of shipped pins. The narrow routing intersection applies only to `source: "builtin"`. Existing tests explicitly require custom user-authored auto agents' legacy thinking to remain router-controlled; that behavior is preserved. User/project builtin override precedence is unchanged. Explicit concrete suffixes still use the existing non-auto path.

Routing states remain pending selection, validated concrete selection, execution and terminal result. Invalid/no-eligible/stale/provider/cancelled selection starts no child. Fallback is constrained and does not reroute or change main chat. Replay/resume retain the recorded selection and revalidate eligibility. Existing workflow-stage-auto and subagent router suites exercise these transitions, including cancellation and fallback restrictions.

## Commands and results

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

## Contract amendments received

No user-authored contract amendments received. Supervisor implementation direction allowed a builtin-only context and the smallest existing-router-compatible handling needed to preserve explicit builtin effort overrides. No scope expansion or router redesign was performed.
