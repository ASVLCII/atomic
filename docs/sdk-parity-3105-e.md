# SDK parity slice E

Goal: preserve parent session configuration and capability ceilings in workflow and subagent children, including fallback replacement, without changing existing authorization boundaries.

## Frozen acceptance matrix

| Requirement | Verification |
| --- | --- |
| E: owner-scoped host callbacks and diagnostics, model/auth/settings, resource configuration | Public factory child tests in both parity suites; distinct parent contexts |
| E: parent-disabled builtins/tools cannot return; explicit empty selections remain empty | SDK inheritance matrix and real child execution |
| E: fallback/replacement retains configuration and restrictions | Child fallback regression and affected existing fallback suites |
| E: cwd is relative to invoking parent; explicit group overrides inherited group | Child adapter behavioral tests and existing group/cwd suites |
| E: fresh child identity/owner; no ambient supervisor authority or disabled-Intercom grant | Existing authorization suites plus disabled-Intercom child regression |
| E: workflow recursive-tool exclusion and single-level child depth remain | Workflow adapter and subagent admission regressions |
| E: preserve A-D and raw values/order; no new errors or normalization | Both complete parity files plus affected suites |
| Per-slice: vertical red-green regression, #3105 attribution | Recorded failing command and subsequent passing command |
| Per-slice: actionable guides and Unreleased notes | Diff inspection |
| Per-slice: build, check, supplemental qlty, focused tests | Exact commands/results recorded below |
| Per-slice: signed conventional attributed commit, clean checkout | Git signature/status inspection |

Constrained choices: retain actual AgentSession identity. Inherit callbacks/managers by reference, not serialization. Omitted child selection inherits; empty selection remains empty. Explicit child choices narrow parent restrictions. Preserve ordered tool inputs and raw host text. No extra validation errors. Fresh child session/owner/admission identity is never copied from the parent.

States: parent ready -> child admission -> child ready -> execution -> terminal inspection. Fallback creates/reconfigures a child without widening its inherited ceiling. Withdrawal changes future host bindings, never grants permission. Existing rejected depth/group/admission transitions stay rejected; cancelled executions do not resume. Awaited owned shutdown is assigned to F, not claimed by E.

## Evidence

Initialization: parent ran `npm ci --ignore-scripts` and `npm run build` successfully at baseline `09e8ad084d0b62124b38833c3d43c9a1f8d97a21`. Logs: `/tmp/atomic-sdk-e-evidence/setup-install.log` and `setup-build.log`.

Implemented in the existing session factory, extension runtime/context, workflow stage and in-process subagent adapters. The owner-bound resolver passes configuration by reference and intersects tool/package selection. Typed children suppress only the recursive workflow extension, retaining enabled package resources. The workflow broker remains the owner of durable questionnaire waiters; child session identity travels through its existing presentation path. No new control plane or process execution path was added.

Evidence directory: `/tmp/atomic-sdk-e-evidence/` (Node 26.8.2, Bun 1.4.2, local macOS).

- RED logs: `red-child.log` (missing resolver), `red-workflow-child.log` (excluded bash restored), `red-subagent-child.log` (lost provider credentials), `red-selection.log` (coding-tool suppression widened), `red-group-ceiling.log` (mandatory Intercom exception), `red-child-origin.log` (root rather than child session identity).
- Subsequent focused green logs: `green-child.log`, `green-workflow-child.log`, `green-subagent-child.log`, `green-selection.log`, `fallback-child.log`, `child-isolation2.log`, `affected-repair.log`. Real subagent inference is a deterministic in-process provider, not live paid inference. Both primary and fallback see only the parent's `read` tool.
- `npm run build` and `npm run check`: passed (`build-final.log`, `check-final.log`). Check includes root and package typechecks and shrinkwrap verification.
- Coding-agent SDK parity plus affected questionnaire, stale-context, UI-prompt and model-runtime/endpoint files: 71 tests across six files passed (`agent-final.log`), including all 52 SDK parity tests. The normal config excludes `extensions-runner.test.ts`; an explicit temporary config ran all 32 tests successfully (`extensions-explicit.log`). No test exclusion was added to the repository.
- `npm run test:integration -- test/integration/sdk-builtin-host-parity.test.ts`: all 29 tests passed (`host-final.log`), including the existing built non-TTY Node/same-authored-workflow probes. The existing supplemental runtime shutdown remains disclosed, not treated as public-dispose success.
- Eighteen affected unit files: all 145 tests passed (`affected-unit-final.log`). The command is printed in the log and covers in-process admission/resources, depth, group precedence, subagent and stage fallback, stage resources, pending ledger isolation and supervisor authorization. No tests skipped in these full-file runs.
- Supplemental `qlty metrics --no-upgrade-check --functions` and `qlty smells --no-upgrade-check` ran on the child resolver, builtin composition and supervisor bridge (`qlty-metrics.log`, `qlty-smells.log`). The resolver had no reported smell. Existing composition complexity/return-count findings were not a reason to expand scope; qlty is not claimed as complete lint/security coverage.

## Regressions repaired and assertion migration

The first full host run exposed six D questionnaire regressions: direct inherited callbacks bypassed broker publication and workflow identity. A narrow private stage-questionnaire route, installed before startup, preserves durable pending/rebind semantics and child attribution. All original cases remain and now also reject root-session attribution. The sibling SDK fixture verifies distinct callbacks, diagnostic sinks, cwd, settings and replacement/reload behavior.

The affected suites also exposed child workflow-extension resurrection through default composition. It is now suppressed at the typed child boundary, including reload, without removing enabled workflow resources. Existing single-level depth tests remain unchanged and pass.

Changed stale assertions are explicit contract migrations, not relaxed tests: workflow explicit allowlists now assert only the listed tools rather than adding mandatory Intercom; `noTools: all` asserts no tools rather than executing Intercom; custom package-tool allowlists exclude Intercom; restricted stages have no Intercom group while `noTools: builtin` still does. The old loader-omission test now asserts A's default builtin composition (omission is not explicit disable) and separately asserts no recursive workflow tool. Every old mandatory-access assertion directly contradicted #3105's no-bypass suppression rule.

U1 from the prior tracked issues file is resolved: typed child executions no longer bind/preserve their parent workflow stage's pending-ask ledger. Parent, two-child, replacement and child-first cleanup regressions pass. The supervisor-supplied debugger evidence is `/tmp/3105-u1-{red,red-cleanup,final-green}.log`; its new pending/reply tests use controlled transport, not a claim of new real-broker cross-group proof. Existing group and supervisor-registry tests also passed in the E gate.

The tracked `ISSUES.md` remains because unrelated unresolved issues predate E; only resolved E/U1 entries were removed. Build/check/test logs retain the existing `beforeExit` listener warning without suppression. Signed commit and clean-tree evidence are recorded in the worker receipt.

## Consolidated E review repair (baseline `c02d826df`)

Frozen goal: respect the effective child host or withdrawal without removing durable broker ownership, persistence, detach/rebind or child identity; enforce inherited model restrictions on controller-selected fallback replacements without narrowing explicit primaries or widening candidates.

The four P1 review entries reduce to two repaired causes:

1. Stage questionnaires previously bypassed the child's host bridge. The broker now retains a live, non-persisted child binding reference alongside its existing waiter. Explicit overrides and withdrawals take precedence, including over an attached parent renderer. Inherited requests still follow parent detach/rebind. Binding changes invalidate only the applicable requests; retired owner bridges cannot dispatch child callbacks.
2. The controller previously promoted fallback candidates into unmarked replacement primaries. It now marks fallback attempts, and the existing adapter checks the composed inherited predicate before creating that session. Forbidden candidates never reach inference; a later permitted candidate can run, and explicit primary semantics are unchanged.

`test/integration/sdk-builtin-host-parity.test.ts` contains real factory/Store/StageUiBroker/host-consumer regressions for child override, initial null, later withdrawal, inherited parent rebind, explicit-child independence from parent rebind, attached-renderer precedence, and fallback replacement. No test replaces the failing runtime boundary. Model responses are deterministic local inference fixtures, not live provider verification.

Evidence in `/tmp/atomic-sdk-e-evidence/`:

- Original reviewer probes reproduced both defects: `repair-precedence-before.log` (parent answered both override/null; child callback never called) and `repair-fallback-before.log` (forbidden inference; predicate called zero times).
- Persisted RED→GREEN: `repair-precedence-red.log`, `repair-precedence-green.log`, `repair-fallback-red.log`, `repair-fallback-green.log`; attached renderer and owner-local rebinding refinements: `repair-attached-red.log`, `repair-owner-rebind-red.log`, `repair-owner-green.log`.
- First complete gates exposed duplicate retired-owner callbacks (`repair-host-full.log`) and close-notification access to stale contexts (`repair-agent-full2.log`). Both were repaired, not suppressed; subsequent complete host and coding-agent gates passed (`repair-host-final.log`, `repair-agent-final.log`). The first combined command's coding-agent invocation exceeded its outer shell budget; its incomplete output is retained as `repair-agent-full.log`, not counted as a pass.
- The copied reviewer scripts `stage-precedence-after.mjs` and `stage-fallback-after.mjs` change only contract expectations: child answers, null pending until child rebind, and forbidden fallback refusal. Their built-Node runs pass (`repair-precedence-after.log`, `repair-fallback-after.log`). Originals remain unchanged.
- Final current-repair gates: 35 host tests (`npm run test:integration -- test/integration/sdk-builtin-host-parity.test.ts`), 71 coding-agent tests in six files, 32 extension-runner tests under the existing temporary explicit config, and 225 unit tests in 25 files all passed; `repair-{host,agent,extensions,unit}-final3.log` retain results and file lists. No tests were suppressed. The original reviewer scripts also reran: precedence exits 1 because it asserts the old parent answer but gets the correct child answer; fallback exits 1 because the forbidden replacement is now rejected before inference. Adapted contract assertions both exit 0 (`repair-final3-*.mjs.log`).
- Supplemental qlty metrics/smells ran on host input and workflow wiring. Complexity/return-count findings are advisory, not clean lint/security claims. Repository build/check remain mandatory. No qlty configuration or suppression changed.

Only resolved E entries were removed from `ISSUES.md`; unrelated warnings and F/G/H boundaries remain. The reviewer-reported pi-ai TS1543 strict declaration closure issue is H, not repaired or independently verified by this E change.

### Final build/check: controlled external catalog condition

Unmodified `npm run build` and `npm run check` failed in `repair-{build,check}-final2.log`: live models.dev omitted `kimi-for-coding`, so generation deleted the tracked `kimi-coding` shard and unchanged provider import failed TS2307. `repair-generated-drift.patch` records the entire AI drift: only `packages/ai/src/models.generated.ts` and `packages/ai/src/providers/kimi-coding.models.ts`. Those two files were restored from HEAD; no generator/provider behavior was changed.

With supervisor approval, final `npm run build` and `npm run check` both exited 0 using `NODE_OPTIONS=--import=/tmp/atomic-sdk-e-evidence/catalog-preload.mjs` (`repair-{build,check}-final3-controlled.log`). The preload delegates every fetch normally, then replaces only `models.dev/api.json`'s `kimi-for-coding` entry. Other providers remain live. This is controlled-catalog validation, **not an unconditioned live build/check pass or a provider repair**.

Fixture provenance: copied preexisting `packages/ai/dist/providers/data/kimi-coding.json` before rebuilding to `kimi-coding-built-source.json`; SHA-256 `202d4b9a3e3327cebb01626fb1818f92627e59800f27858902c4ce69105f0bd7`. Evidence-only `construct-catalog-fixture.mjs` flattens its API groups, preserves ID/name/reasoning/input/cost/limits, translates cache cost and limit names to models.dev shape, and sets `tool_call: true` for the four known coding models. The resulting `kimi-models-dev-fixture.json` hash is `a68861a52b2f3a78ace276cd07a48f00841627a080a7add5f623f4d20bcf9b2d`; constructor hash `bb2d646b70a2743d0a910cc09924065f8ec86402f9c7f6706627a7596d4ae9e9`; preload hash `d9567fdd85148f966d04f9529fee1f998e61478de5b6642a6dd31b51b4831677`. All are retained in the evidence directory and `catalog-hashes.log`. This reconstructs generator input from local built values, not a historical raw API snapshot. Ordinary commit hooks use the same disclosed preload, without skips. Final tracked AI diff is empty. Live-catalog stability and exact-head parent CI remain outstanding external gates.

## Adapter-reference reuse review repair (baseline `1801e068d`)

Frozen goal: preserve explicit child host intent independently of adapter identity, with omission/empty inheritance, null withdrawal, reload, durable broker ownership and child identity unchanged. All three latest P1 findings describe this same cause.

The session now records explicit human-input binding revisions, carries them into reloaded runners, and notifies the existing host bridge even for same-reference binding. Workflow routing compares this intent against creation's inherited binding, not against the original adapter object. No public host contract, provider fallback policy or lifecycle boundary changed.

Durable #3105 regressions extend the production factory/Store/Broker matrix with parent A → B then child null → A, direct child A, explicit A followed by reload, and omitted/empty child bindings followed by reload. They assert the selected answer, exactly one callback, no parent presentation, and child/run/stage identity. Existing withdrawal, pending/rebind and explicit-child independence cases remain intact.

Evidence in `/tmp/atomic-sdk-e-evidence/`:

- `node /tmp/sdk-e-r2-rebind.mjs`: failed before repair (`r3-review-red.log`); passes against rebuilt production code (`r3-review-green.log`), calling only the original child-selected adapter. Independent source reviewer config passes all four tests (`r3-source-review-green.log`).
- Targeted matrix: three new cases failed with the parent's answer (`r3-durable-red.log`); all nine pass (`r3-durable-green2.log`). An intermediate revision-baseline hypothesis failed and was corrected; retained in `r3-durable-green.log`.
- Full host parity: 39 tests pass (`r3-host-full.log`). Full SDK parity and five affected coding-agent files: 71 tests pass (`r3-agent-full.log`). Explicit excluded-runner config: 32 pass (`r3-runner-full.log`). Affected unit files: 225 tests in 25 files pass (`r3-unit-full.log`, exact command in `r3-unit-command.log`). Existing listener warnings remain unsuppressed.
- Supplemental qlty 0.642.0 metrics/smells completed for host input, session binding and workflow wiring (`r3-qlty-{metrics,smells}.log`); complexity/return-count advisories remain, not a full lint/security claim. No qlty configuration changed.

### Authorized prerequisite: live catalog rename

The parent explicitly amended the earlier no-generator-edit boundary to authorize a minimal, separately signed prerequisite repair. Fresh **unmodified** build/check first failed TS2307 (`r3-{build,check}-unmodified.log`). Live Node `fetch` returned HTTP 200: the old `kimi-for-coding` key is absent; `kimi-code-plan-cn` serves the existing `.com` coding endpoint and `kimi-code-plan-global` is distinct (`r3-live-kimi.json`). Recent generator history is retained in `r3-generator-history.log`.

Prerequisite commit `38cc339fe` selects the renamed `.com` catalog, falling back to the legacy key, while retaining provider ID, authentication, Anthropic transport and existing metadata conversion. No models are invented, no provider is removed, and no unrelated bulk refresh is committed. Deterministic generation reproduces the missing imported shard with the new key while legacy generation passes (`r3-kimi-red.log`); both then pass (`r3-kimi-final.log`). Seven relevant generation/provider/auth/compatibility files pass all 60 tests (`r3-ai-tests.log`).

After the prerequisite, **unmodified** `npm run build` and `npm run check` both exit 0 (`r3-build-fixed.log`, `r3-check-fixed.log`), with `NODE_OPTIONS` removed, no preload, and no generated tracked AI drift. This supersedes the earlier external-catalog gate failure for this candidate. Prerequisite commit normal hooks also pass unmodified (`r3-prerequisite-commit.log`). F public disposal, G services and H packed strict declarations/normal exit remain deferred; cumulative exact-head CI and Greptile/conditional merge remain parent-owned.

Final candidate unmodified build/check reran successfully after all repair edits (`r3-build-final.log`, `r3-check-final.log`). Both signed commits use normal hooks with no catalog preload or skipped check; final signature/status evidence belongs to the repair receipt.

## Optional configuration / child cwd repair (baseline `fbd15305e`)

Frozen goal: preserve explicit child cwd (relative to its invoking parent), then supplied child manager cwd, then parent cwd; treat optional `undefined` as inheritance without changing literal values, raw data, host intent, fallback restrictions or capability/owner boundaries.

All seven consolidated findings are resolved by two changes in `child-session-options.ts`: cwd precedence (entries 1, 5, 7) and undefined-safe shallow option/builtin/binding merges (entries 2, 3, 4, 6). Only undefined is filtered; object/array/callback values are not cloned or normalized. Existing tool intersection, exclusions, builtin ceiling and fallback predicate composition are unchanged. No new schema, API or provider changes.

The inherited-field audit covered cwd, agentDir, modelRuntime, settingsManager, model, thinkingLevel, fallbackModels, isFallbackModelAllowed, builtins, tools, noTools, excludedTools, customTools and extensionBindings (humanInput and onDiagnostic). The public factory regression exercises model/settings/custom-tool/input/diagnostic behavior and compares resolved configuration, including borrowed identities and ordered duplicate fallback entries. A second factory regression covers manager cwd and explicit empty/dot cwd. Four production workflow-adapter cases cover omission, undefined configuration, manager cwd and explicit parent-relative cwd. Existing null withdrawal, explicit-host reuse/reload, fallback, owner/group/depth and empty-tool cases remain unchanged.

Evidence in `/tmp/atomic-sdk-e-evidence/`:

- Before edits, `node /tmp/sdk-e-risk-boundaries.mjs` fails with all three assertions (undefined host, undefined model, manager cwd); `node /tmp/sdk-e-risk-stage.mjs` prints the same incorrect production adapter state (`r4-{boundary,stage}-red.log`). The adapter probe itself exits zero because it prints observations; persisted assertions now cover those observations. Both original scripts pass/correctly report inherited state after the build (`r4-{boundary,stage}-green.log`).
- Vertical factory regressions: `r4-cwd-red.log` then `r4-cwd-green.log`; `r4-undefined-red.log` then `r4-config-green.log`. The intermediate `r4-undefined-green.log` exposed a fixture assumption: settings returns a fresh fallback array on each read. The fixture now supplies an explicit ordered duplicate fallback array to test borrowed-reference preservation rather than incorrectly requiring settings snapshots to share identity.
- Unmodified `npm run build` and `npm run check`, with no NODE_OPTIONS/preload, pass (`r4-build.log`, `r4-check.log`). No generated AI drift or provider changes.
- Complete SDK parity plus five affected files: 73 passed in six files (`r4-agent-full.log`), including all 54 SDK cases. Complete host parity: 43 passed (`r4-host-full.log`). Existing explicit runner configuration: 32 passed (`r4-runner-full.log`). Existing 25-file affected unit command: 225 passed (`r4-unit-full.log`; exact file list in `r3-unit-command.log`). Additional session-manager/shared-model/windows-path and parent-config suites pass (`r4-config-suites.log`, `r4-parent-config.log`). No required acceptance was skipped or softened; test-name filters were used only for red/green iteration.
- Supplemental qlty 0.642.0 metrics and smells on the resolver both exit zero, with no smells reported (`r4-qlty-{metrics,smells}.log`). Configuration unchanged; this is not full lint/security coverage.

Only these resolved E issues were removed from tracked `ISSUES.md`; unrelated warnings and F/G/H items remain. Public disposal/DBOS cleanup, services, genuine packed strict declarations and normal exit are not claimed. Cumulative PR exact-head CI, Greptile and conditional merge remain parent-owned.

## Deferred work

F must fix public `await session.dispose()` leaving DBOS ready and keeping Node alive. H must demonstrate normal packed-consumer exit without manual DBOS cleanup or forced exit. No lifecycle success is claimed here.

## Contract amendments received

- "make sure that you create PRs and loop until CI is green, then you can merge if so"
- "and there is no addressable greptile feedback"

Those are parent-owned cumulative PR gates. This child must not push, create a PR, merge, release, or deploy. Merge requires exact-head green CI, applicable protection/review gates, and no actionable Greptile feedback.
