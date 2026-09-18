# SDK parity slice D acceptance matrix (#3105)

## Interface and invariants

Use existing `createAgentSession`, host bindings, workflow runtime, `ctx.ui`, store pending descriptors and resume paths. No new manager or authored gate marker. An explicit `ctx.ui.confirm` guarding `ctx.tool`, run with primitive prompt-node durability, is the durable approval gate. Ordinary dialogs with prompt nodes disabled are a separate missing-adapter probe, not a portability comparison. Stage readiness remains an approval gate.

All host comparisons and both persisted handoffs use the same definition bytes/hash, inputs, `usePromptNodesForUi`, execution mode and gate policy. Only host bindings change. Raw text, ordered choices and permitted duplicate labels must survive. Primitive confirm requires current validated boolean true; questionnaire readiness retains the existing runtime interpretation of schema-valid answers, without a new host-only answer-kind policy.

| Clause | Public-behavior evidence | Status |
| --- | --- | --- |
| Human capability independent of rendering | Default execution remains interactive without terminal UI or an initial input adapter; headless pickers/auto-attach disabled | Actual public factory confirm-only launch stays pending, then binds and continues exactly once; explicitly supplied non-interactive runtime policy still refuses input |
| Unchanged workflow across hosts | Same file/hash, input then confirm, equal results and exactly one counted tool effect using Node callbacks and real CLI dialog bridge | Pass: one authored fixture, raw text and guarded receipts equal, same hash |
| False approval on each host | Zero guarded effects, refusal distinct from success | Pass: both complete without guarded effect |
| Cancellation on each host | Zero guarded effects | Pass: withdrawal aborts current request, real CLI dialog dismisses, confirm stays pending |
| Malformed reply on each host | Runtime validation rejects, zero guarded effects | Pass: string `"true"` rejected; CLI fault injected after actual dialog, before unmodified runner validation |
| Late reply after cancel/replacement | Old request cannot settle or advance | Pass for withdrawal and late true on both hosts; Node rebind has fresh requestId with stable owning run/stage; comprehensive generation replacement remains F |
| Ordinary missing adapter | Direct non-prompt-node dialog raises HumanInputUnavailable | Pass: separately configured ordinary workflow fails with named refusal |
| Durable missing adapter | Normal `createAgentSession` without human input, `/workflow required --no-picker`, pending confirm descriptor and zero effects, then host binding | Pass: public launch regression plus built Node initially absent input; existing separate ordinary-dialog and both real disk-handoff probes retained |
| Node to CLI persisted handoff | Reopen supported runtime, restore pending descriptor, accept current answer once, no completed effect replay | Pass: fresh process and actual PostgreSQL/DBOS reopen; unchanged source/hash |
| CLI to Node persisted handoff | Same assertions and unchanged policy/definition | Pass: same persisted stage ID and descriptor semantics; fresh host request ID |
| Nested workflow/stage questionnaire | Exact questionnaire semantics through human capability, readiness gate retained | Actual factory and real nested stage pass original params (previews, raw text, order, multiSelect), raw result/notes, correct owning run/stage, and readiness approval. Cancelled/invalid/withdrawn readiness stays pending; valid stay keeps stage open with zero effects |
| Duplicate answer | One accepted settlement per pending identity | Pass: repeated host settlement/rebind leaves one effect; runtime store accepts first answer and rejects duplicate both before and after completion |
| Budget gate | No host capability bypass of existing budget refusal | Pass: exhausted run remains `budget_exceeded` with missing or nonapproving host, including rebind; zero subsequent effects. This is runtime boundary enforcement, not live-model instruction compliance |
| Built Node non-TTY | Actual built public export/factory, unchanged authored bytes and prompt policy | Pass: `sdk-host-built-node.mjs` observes identity, structured result, one receipt/effect and natural Node exit after existing public runtime shutdown; session.dispose-only lifecycle remains F |
| Dedicated terminal | Actual built CLI dialogs, keyboard and rendering | Pass: `sdk-host-terminal.mjs` under tmux/ProcessTerminal, text plus Yes/No, exit 0; not a full graph attachment UX claim |

Legal transitions: running → pending → one validated answer → running/completed; pending → detached stays pending; persisted pending → explicit runtime resume → current pending identity. False/cancelled/invalid/stale input never enters the authorized-effect branch. Completed durable effects are replayed as results, not executed again.

Round-1 repair corrects the earlier missing-adapter overstatement: that probe manually enabled prompt nodes and did not prove the normal factory launch. All three duplicate P1 findings traced to inferred `non_interactive` execution disabling background prompt nodes. Default execution is now host-independent, including CLI `-p` without an adapter. Headless launch reports an accepted background run, not terminal success; inspect status for eventual results/errors. Required gates stay pending until an authorized host or answer arrives. Explicit `NON_INTERACTIVE_WORKFLOW_POLICY` passed to runtime/dispatcher is unchanged. Rendering availability still controls pickers, printable reporting and auto-attach, not execution permission.

The new public-factory confirm regression verifies pending descriptor/run identity, zero effects before binding and one effect after repeated settlement/rebinding. The committed built Node fixture starts unbound on the unchanged authored input/confirm workflow, observes pending input, then binds and completes with one receipt/effect. Existing real PostgreSQL/DBOS fresh-process handoffs in both directions continue to prove persisted reconstruction and exactly-once checkpoint reuse; the new live-binding regression is not itself a fresh-process persistence claim.

## Validation and deferred work

Required: vertical red/green evidence, affected focused suites, SDK parity, integration host parity, build, check and scoped qlty. No test skips or relaxed budgets. Packed installation/declaration closure is slice H, child capability inheritance E, comprehensive shutdown F, service isolation G. No paid-provider proof claimed.

Parent owns one cumulative PR, exact-head green CI and actionable Greptile clearance before conditional merge. This slice does not push or open a PR.

## Earlier implementation checkpoint

The first 12 integration tests cover actual SDK factory/discovery/extension: policy plus five primitive scenarios and six real stage questionnaire/readiness scenarios. Rebind RED observed one request instead of two. A private runner/builtin bridge now observes binding changes, cancels old presentation, and issues a fresh validated request for the existing pending gate. Workflow identities are assigned internally; public HostInput types are unchanged. No polling or session_start replay is used.

Questionnaire RED reached a real stage's awaiting_input state without any host request. StagePromptAdapter now retains the original QuestionParams separately from the lossy display descriptor. The non-rendering host consumer uses the existing broker's live request identity and validated raw QuestionnaireResult, preserving previews, multi-selection, notes and ordered/raw text. Nested requests carry the child run ID. The deterministic provider substitutes inference only; child sessions, tools, store and broker are real. Fixtures explicitly disable child builtin families to keep E inheritance out of this increment.

Routing does not consume `RunOpts.ui`; the non-rendering-host guard preserves detached CLI focus. Existing readiness semantics are retained: a valid stay answer keeps the stage open; cancellation/invalid/withdrawal leaves its request pending. The final probes below complete the bounded D evidence, not review quorum or later slice acceptance.

Earlier checkpoint validation: SDK parity 46 tests; extension-runner suites 32; affected workflow/broker/readiness suites 146 in 11 files; integration 12; build/check passed. Updated milestone results follow.

## Controlled CLI and disk-handoff milestone

At this milestone the integration suite passed 20 tests. `test/fixtures/sdk-host-durable-workflow.ts` is the single authored fixture for the five same-source host comparisons and both persisted directions. Discovery loads unchanged fixture bytes; subprocess recovery uses the same workflow module loader. Inputs, primitive prompt-node mode and gate policy do not vary by host. The fixture records an unguarded completed receipt before its explicit approval and a separate guarded effect, allowing recovery to prove that completed `ctx.tool` work is not repeated.

The controlled attachment path is: workflow pending descriptor → workflow session runner/HostInput binding → presentation session runner's validated ExtensionUIContext → actual `InteractiveModeBase.createExtensionUIContext` → `showExtensionInput` / `showExtensionConfirm` / `showExtensionSelector` → actual `ExtensionInputComponent` / `ExtensionSelectorComponent`. Only the mounting surface and keyboard input are controlled. The fixture asserts both actual component types ran; signal cancellation executes the real dialog abort handler and dismisses its selector. Invalid-reply fault injection changes the result after the real dialog executes, before the unmodified runner validates it. This is adapter integration, not proof of all TUI attachment UX or terminal rendering. No production host manager, API or focus behavior changed for this milestone.

Disk recovery uses the existing disposable managed PostgreSQL helper and real DBOS backend. First host withdraws, attempts stale true, gracefully quits and flushes; its process closes normally without `process.exit`. A fresh process hydrates disk checkpoints and calls `runtime.resumeDurableWorkflow`, observes the pending confirm without an adapter, then binds the other host. Assertions cover durable stage identity, descriptor kind/message, fresh requestId, unchanged source hash, one completed receipt and one guarded effect. Existing persistence stores unresolved prompt topology/replay identity plus pending count; the runtime reconstructs the presentation descriptor from the unchanged authored source. This is not a new serialized host callback or a copied in-memory backend.

Milestone validation: integration 20/20; persistence integration 4/4; affected prompt/persistence/readiness unit tests 83/83; SDK and CLI suites 69/69; runner suites 32/32; build/check pass. The persisted subprocess fixture uses Bun as repository test infrastructure, not installed Node acceptance.

## Final D evidence and limitations

The authored source SHA-256 remains `aee794cfa82fe248928ab07ec0964752c59a0bfc8ff685f814f710f9c4c61db2`. The built Node fixture imports `@bastani/atomic` resolving to `dist/index.js` and executes built builtin assets with no Bun, CLI subprocess, source alias or packed-install claim. It reuses this same definition, text and approval policy. The actual dedicated terminal scenario separately proves text entry and Yes/No through built CLI dialog components and the runner bridge.

Initial built Node execution completed the workflow but did not exit after `session.dispose()` within 40 seconds. Inspect-only debugger attribution found the existing synchronous disposal path does not emit `session_shutdown`, leaving DBOS owners live; this predates D. The approved scoped D fixture uses the existing public `createAgentSessionRuntime` around normal `createAgentSession`, then `runtime.dispose()`, which emits shutdown and exits naturally. No forced process exit, private DBOS teardown, listener suppression or F implementation was added. F must establish owned awaited `session.dispose()` cleanup and H must prove that contract in the packed consumer without supplemental cleanup.

Validation after the round-1 missing-host repair (earlier dedicated-terminal evidence retained separately):

- `npm run build` and `npm run check`: exit 0.
- `npx vitest --run --project integration test/integration/sdk-builtin-host-parity.test.ts test/integration/workflow-prompt-tool-resume.test.ts test/integration/postgres-managed-dbos-recovery.test.ts test/integration/workflow-background-hil.test.ts`: 34 tests, 4 files, no skips; host parity contributes 26 tests.
- `npm test --workspace=@bastani/atomic -- test/sdk-builtin-parity.test.ts test/extensions-runner/ test/extensions-ui-prompt-events.test.ts test/extensions-ui-prompt-contract.test.ts test/interactive-selector-lifecycle.test.ts`: 101 tests, 10 files, no skips.
- Focused unit commands recorded in the repair progress receipt: 492 tests in 25 files plus 113 affected headless tests in 14 files, no skips. Includes explicit non-interactive dispatcher/runtime refusal, background HIL, printable accepted-run/status/error, broker/prompt/readiness/rebind/reload, persistence and budget.
- `npm run docs:check --workspace=@bastani/atomic`: 93 Markdown/MDX files and pages validated.
- Scoped `qlty check` on all changed runtime and fixture files: 0.642.0, no issues. Configuration unchanged with no plugins; this is supplemental, not substantive lint coverage. Biome/typecheck remain authoritative.
- `node test/fixtures/sdk-host-built-node.mjs`: initially pending without a host, then approved result with one effect and natural exit through existing runtime cleanup.
- Earlier `node test/fixtures/sdk-host-terminal.mjs` in dedicated tmux: `terminal-proof`, approval true, refusal false, exit 0. Terminal code unchanged in this repair; current controlled real CLI dialog and both persisted host directions reran in the unfiltered integration suite.

Traceability: C2 retains actual session/tools/events and existing runtime; C6 preserves payloads; C7/C8/C21 and §8.2.1 are covered by the matrix; C15 includes prior public-behavior REDs plus focused green gates and user guides/Unreleased notes. C9/E inheritance (including sibling ownership and capability ceilings), C10/F full lifecycle and replacement, C12/G isolation/services, and C5/C14/H packed declaration/runtime closure remain explicitly deferred. No paid inference, cross-platform execution or remote CI is claimed. Existing `beforeExit` MaxListeners warnings remain visible and undiagnosed.

Amendments retained: parent creates one cumulative PR and loops to exact-head green CI, satisfies applicable review/branch protections and clears all actionable Greptile feedback before conditional merge. This slice is ready for later review stages, not an overall-completion or merge claim.
