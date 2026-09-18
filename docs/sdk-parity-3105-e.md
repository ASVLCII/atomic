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

## Deferred work

F must fix public `await session.dispose()` leaving DBOS ready and keeping Node alive. H must demonstrate normal packed-consumer exit without manual DBOS cleanup or forced exit. No lifecycle success is claimed here.

## Contract amendments received

- "make sure that you create PRs and loop until CI is green, then you can merge if so"
- "and there is no addressable greptile feedback"

Those are parent-owned cumulative PR gates. This child must not push, create a PR, merge, release, or deploy. Merge requires exact-head green CI, applicable protection/review gates, and no actionable Greptile feedback.
