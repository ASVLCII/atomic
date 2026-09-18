# SDK builtin parity, slice B

Goal: apply exact builtin/tool suppression without caller-option mutation or reload resurrection. Scope is contract B and issue #3105 section 8.1 B; later slices are not acceptance requirements.

## Acceptance matrix

| Requirement | Current-checkout oracle | Evidence |
| --- | --- | --- |
| Omitted builtins, empty map, omitted keys and true enable shipped defaults | `sdk-builtin-parity.test.ts` default and builtin selection cases | Passed |
| Each false package removes its extension/resources, not coding defaults | Per-family cases and all-disabled custom discovery case | Passed before and after reload |
| Custom discovery remains caller-owned; builtin identity dedup/order retained | Inherited custom/repeated-root tests plus disabled custom loader snapshot | Passed; caller extension array unchanged |
| `tools: []` exposes no tools | Tool matrix | Passed |
| `noTools: "all"` exposes none, even with nonempty tools | Explicit combined regression and matrix | RED then GREEN |
| `noTools: "builtin"` suppresses only coding defaults; explicit tools still win | Tool matrix and default-tools root suite | Passed |
| `defaultTools` affects only initial coding defaults, including empty setting | Tool matrix and root default-tools suite | Passed, custom/static/dynamic extension assertions retained |
| Exclusions win over allowlists, including Intercom/custom tools; unknown exclusions ignored | Tool matrix | Passed before and after reload |
| No mandatory Intercom activation bypass; trusted collision rules retained | Matrix, nine trusted Intercom tests | Passed, including broker status and spoof rejection |
| Caller options/arrays remain unchanged; preserve explicit order | Frozen option arrays/map and snapshot tests; allowlist order assertions | Passed |
| Suppression survives reload | All selection tests exercise ready → reload → ready | Passed; exclusions remain absent from registry |
| Existing actual AgentSession result/startup/rollback behavior preserved | Existing slice A parity and affected package suites | Passed |
| User guidance and behavior release notes | SDK, CLI, settings, extension and Intercom/workflow guides; coding-agent Unreleased breaking note | Updated, released sections untouched |
| Independent installation/build, check and affected tests | Commands below | Installation/initial build by predecessor; current build/check and tests passed |
| Signed conventional commit, attribution, normal hooks, clean tree | Commit receipt | Recorded at handoff |
| No child push/PR/merge/release; correct checkout | Git branch/status | `feat/3105-sdk-b`, local work only |

## Decisions and state

The supervisor resolved the only precedence ambiguity: literal `noTools: "all" activates no tools` overrides an explicit allowlist. The existing `builtin` mode keeps its default-only semantics. This deliberate breaking change is documented. `builtins` is an optional `Partial<Record<AtomicBuiltin, boolean>>`; the exported union has exactly the five specified names. No new result wrapper, schema or payload normalization was introduced. Deduplication remains limited to shipped package composition and existing active-tool selection behavior.

Creation selects package identities and copies the suppression map into the custom composition wrapper. Ready sessions may reload into a new generation; disabled resources/extensions and excluded tool names remain absent. Enabled packages still load resources with no active tools. Missing enabled assets keep `BuiltinUnavailable`; disabled descriptors are not required. Existing startup failure/rollback and same-generation binding behavior remain covered by slice A tests. Child capability inheritance and generation lifecycle redesign remain E/F work.

## Validation

Commands run from the designated checkout:

```sh
npm run build
npm run check
npm run test --workspace=@bastani/atomic -- test/sdk- test/herdr-reload.test.ts test/interactive-deferred-startup-first-prompt.test.ts test/interactive-engine-resource-readiness.test.ts test/mandatory-intercom-session.test.ts test/mandatory-intercom-extension.test.ts test/agent-session-services-model-paths.test.ts test/resource-loader- test/main-deferred-startup.test.ts test/startup-project-trust.test.ts test/interactive-deferred-startup.test.ts test/interactive-startup-resource-ordering.test.ts test/interactive-startup-resource-gate.suite.ts test/agent-session-dynamic-provider.test.ts test/agent-session-dynamic-tools.test.ts test/agent-session-runtime-events.test.ts test/session-cwd.test.ts test/args.test.ts test/settings-manager.test.ts test/system-prompt.test.ts
npm run test:unit -- test/unit/default-tools-setting.test.ts test/unit/workflow-reload-render.test.ts test/unit/workflow-session-boundary-preserves-runs.test.ts test/unit/durable-dbos-session-replacement.test.ts
node packages/coding-agent/test/fixtures/sdk-builtin-composition.mjs
qlty metrics --functions packages/coding-agent/src/core/builtin-resource-loader.ts packages/coding-agent/src/core/sdk.ts
```

Package coverage: 425 passed in 36 files, including 31 SDK parity tests, no skips. Root affected coverage: 34 passed in four files, no skips. Built Node fixture prints `SDK builtin composition: PASS` and `SDK builtin suppression: PASS`, then exits normally. This is built workspace proof, not slice H packed installation proof. No browser/TUI is needed to prove this SDK selection policy; existing CLI startup suites were executed.

Logs: `/tmp/sdk-b-build.log`, `/tmp/sdk-b-check.log`, `/tmp/sdk-b-affected.log`, `/tmp/sdk-b-unit-green.log`, `/tmp/sdk-b-node.log`, `/tmp/sdk-b-qlty.log`. Qlty 0.642.0 used existing configuration for scoped metrics; it supplements repository Biome/typecheck, not an independent lint claim.

## Regression history and limits

Expected REDs: predecessor `/tmp/sdk-b-red-1.log` showed mandatory Intercom under `noTools: "all"`; `/tmp/sdk-b-red-all-allowlist.log` showed explicit tools overriding all; `/tmp/sdk-b-red-disabled.log` showed disabled packages still loaded. All now have durable passing public regressions.

The first root focused run had five stale default-tools expectations. Parent-arranged read-only debugger confirmed these reflected slice A's newly default builtin families and B's removed Intercom exception, not a runtime failure. Updated exact expected sets without skipping cases or removing registry/default/custom-tool assertions; rerun passed. Test import and Theme source-path type errors were corrected before successful build/check. A duplicate `--run` invocation was corrected before actual test execution.

Final follow-up validation: `npm run build` and `npm run check` passed again (`/tmp/sdk-b-final-build.log`, `/tmp/sdk-b-final-check.log`). Final SDK parity plus trusted Intercom run passed all 40 tests (`/tmp/sdk-b-final-parity.log`), including creation with missing assets explicitly disabled. The rebuilt Node fixture passed again (`/tmp/sdk-b-final-node.log`). Scoped Qlty smells reported none (`/tmp/sdk-b-smells.log`).

Repeated session tests report existing process `beforeExit` MaxListeners warnings. No forced exit or listener-limit suppression was used. Awaited lifecycle work remains slice F. Baseline tracked `ISSUES.md` entries are unrelated and preserved.

Deferred: later slices C–H, existing unrelated issues, packed consumer and remote platform coverage. No additional feature work was added.

## Contract amendments received

- "make sure that you create PRs and loop until CI is green, then you can merge if so"
- "and there is no addressable greptile feedback"

These are parent-owned requirements for the eventual cumulative PR. This child may not push, create a PR or merge. Merge requires exact-head green CI, applicable protection/review gates and no remaining actionable Greptile feedback; a stale review or aggregate score is insufficient.

## Consolidated review repair (five blocking findings)

| Batch findings (in consolidated order) | Root cause and disposition | Durable evidence |
| --- | --- | --- |
| 1, 3, 5: caller resources on another Windows drive | Resolved: `win32.relative()` can return a drive-qualified absolute path; both containment predicates now reject `isAbsolute(child)` | `sdk-builtin-windows-paths.test.ts` injects real `node:path.win32` semantics into composition; extensions, skills, prompts and themes on another drive, same-drive unrelated paths and prefix siblings survive creation/reload, with caller arrays unchanged |
| 2, 4: disabled alternate shipped root | Resolved: suppression previously considered only the preferred discovery winner; it now enumerates all verified Atomic candidate roots using the existing manifest-name/required-entry checks | `sdk-builtin-parity.test.ts` exercises preferred roots and explicit `dist/builtin/subagents` through the public factory; extensions/resources stay absent after reload and caller arrays retain identity |

Preferred enabled discovery and descriptor order remain unchanged. No basename-based recognition or arbitrary caller-package discovery was added. Existing missing-assets, deduplication, startup/rollback, tool-selection and trusted Intercom tests remain passing. Baseline `ISSUES.md` is unchanged; the resolved B defects are tracked here rather than left as open issues. Existing guides/changelog already describe suppression and caller preservation, so these corrections require no additional migration guidance.

Both reviewer reproductions ran before repair: `/tmp/b-review-win-red.log` records the cross-drive false positive, and `/tmp/b-review-runtime-red.log` records `1 !== 0` for the alternate dist extension. Durable failing regressions are captured in `/tmp/b-review-windows-test-red.log` and `/tmp/b-review-dist-test-red.log`. The latter focused RED selected two cases (other cases were not selected); final runs below select whole suites and have no skips. A first 120-second parity run exceeded the command budget; the complete rerun passed 33 tests in 145.90 seconds (`/tmp/b-review-parity-green.log`). A theme fixture initially lacked required color values; corrected fixture validation is included in the final affected run.

Repair validation (all successful):

- `npm run build`: `/tmp/b-review-build.log`.
- `npm run check`: `/tmp/b-review-check.log` (repeated after final edits).
- The affected package command above, plus `test/builtin-packages test/builtin-extension-entry-labels test/native-builtin`: **431 passed in 38 files**, no skips, `/tmp/b-review-affected.log`; the `test/sdk-` filter includes both SDK parity and injected Windows regression files. Existing filenames matched by added filters, rather than nonexistent suites, determine coverage.
- The root affected command above: **34 passed in four files**, no skips, `/tmp/b-review-unit.log`.
- `node packages/coding-agent/test/fixtures/sdk-builtin-composition.mjs`: both composition and suppression PASS, `/tmp/b-review-node.log`.
- `node /tmp/sdk-b-evidence-probe.mjs`: unchanged reviewer runtime probe, **five scenarios PASS**, `/tmp/b-review-runtime-green.log`.
- `node /tmp/3105-b-risk-windows-green.mjs`: reviewer source-extracted probe adapted to supply the new `isAbsolute` import and require correct results instead of expecting a defect; **four cases PASS**, `/tmp/b-review-win-green.log`. The original defect-expecting probe remains unchanged. This and the durable injected scenario run locally on macOS, not native Windows.
- `qlty metrics --functions packages/coding-agent/src/core/builtin-resource-loader.ts packages/coding-agent/src/core/builtin-packages.ts` and `qlty smells` on those same paths: `/tmp/b-review-qlty-metrics.log`, `/tmp/b-review-qlty-smells.log`; no smells reported. Existing Qlty configuration unchanged; authoritative lint/typecheck remains `npm run check`.

Signed conventional repair commit uses normal hooks; raw hook/commit output is retained at `/tmp/b-review-commit.log`, with SHA/signature/clean-tree verification in `/tmp/b-review-commit-receipt.log`. Exact commit SHA is returned in the handoff rather than self-embedded in the commit. Existing `beforeExit` MaxListeners warnings remain visible and unsuppressed. No forced process exit was added. Built workspace Node proof is not packed-install proof; C–H, native Windows/remote CI and cumulative PR/Greptile/merge gates remain explicitly deferred to the parent.

## Review round 2: resolved flag snapshots

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Completion reviewer: preserve false flags when snapshotting | Resolved | Public factory inherited getter regression, creation and reload |
| Evidence reviewer: preserve accessor flags | Resolved, same root cause | Unchanged `getter.mjs` now reports `loaded: []` |
| Risk reviewer: inherited/nonenumerable flags | Resolved, same root cause | Public factory nonenumerable regression, creation and reload |

Object spread copied only own enumerable properties. The constructor now reads each present supported flag into its private snapshot, including inherited and nonenumerable values. Absent keys remain absent; values are not normalized. Public types, caller descriptors/prototype, Windows containment and alternate shipped-root suppression are unchanged. Both regression cases freeze caller input and verify its descriptors/prototype remain unchanged. A built Node supplement also changes caller values after creation and confirms reload uses the captured values.

Validation commands and results (logs under `/tmp/b-review-r2-`):

- `node /tmp/3105-b-evidence-r2/getter.mjs`: reproduced `1 !== 0` before repair (`getter-red.log`); passed after rebuild (`getter-green.log`).
- `npm run test --workspace=@bastani/atomic -- test/sdk-builtin-parity.test.ts -t 'false flags survive reload'`: both variants RED then GREEN (`tests-red.log`, `tests-green.log`); 32 unrelated cases unselected, not suppressed.
- `npm run build`: passed (`build.log`). `npm run check`: passed (`check.log`); initial test formatting failure retained in `check-format-red.log`, corrected without changing assertions.
- Exact affected package command from the earlier repair (validation command above plus `test/builtin-packages test/builtin-extension-entry-labels test/native-builtin`): **433 passed in 38 files**, no skips (`affected.log`), including both new cases and Windows/dist-root regressions.
- Root affected command above: **34 passed in four files**, no skips (`unit.log`).
- `node packages/coding-agent/test/fixtures/sdk-builtin-composition.mjs`: composition and suppression PASS (`node.log`).
- `node /tmp/b-review-r2-flag-shapes.mjs`: inherited getter and nonenumerable creation plus caller-mutation/reload scenarios PASS (`flag-shapes.log`).
- `node /tmp/sdk-b-evidence-probe.mjs`: all five reviewer scenarios PASS (`runtime.log`). `node /tmp/3105-b-risk-windows-green.mjs`: all four injected win32 cases PASS (`windows.log`).
- `qlty metrics --functions packages/coding-agent/src/core/builtin-resource-loader.ts` and `qlty smells packages/coding-agent/src/core/builtin-resource-loader.ts`: passed, no smells (`qlty-metrics.log`, `qlty-smells.log`); Qlty 0.642.0, existing configuration unchanged. Supplemental analysis, not a replacement lint gate.

Temporary round-2 issue entry was tracked then removed after successful validation; baseline `ISSUES.md` is unchanged. No new user guidance or changelog is needed for this correction to the documented suppression contract. Normal signed commit/hook output: `/tmp/b-review-r2-commit.log`; receipt: `/tmp/b-review-r2-commit-receipt.log`. Existing unsuppressed `beforeExit` listener warnings remain. Local built-workspace and injected-win32 evidence is not native Windows, packed-install or remote CI proof. Parent-owned exact-head CI/protection/Greptile and eventual PR/merge gates remain deferred; no push, PR, merge or release was performed.
