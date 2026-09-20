# Batch A readability review

**Current status:** the authoritative audience amendment below supersedes the initial pass's relocation deferral and blanket literal-retention checks. The initial record is retained as history, not as the current disposition.

## Initial pass record

Parent attribution: GPT-6-Astra. Editorial work only; no runtime, package changelog, commit, push, or PR changes.

## Scope and reading

Independently inventoried all Markdown/MDX files under `packages/coding-agent/docs` whose relative POSIX path sorts before `models.md`. Scope: 40 pages, including subdirectories. Fully read every page through `read`, from its first through its last line, before editing. No page was sampled or omitted due to truncation. Also read `AGENTS.md`, `packages/workflows/skills/unslop/SKILL.md`, `DESIGN.md`, and `PRODUCT.md`; setup context includes the fully read development and getting-started pages below.

28 pages revised; 12 reviewed and unchanged. Paths in the table are relative to `packages/coding-agent/docs`. “Full” confirms a complete `read` of that page, including fences and reference sections.

## Page ledger

| Page | Read | Disposition | Specific reason and preservation decision |
| --- | --- | --- | --- |
| background-tasks.md | Full | Revised | Split stop-notification timing from duplicate/outcome handling. Kept termination confirmation, queued cancellation, and owner-close suppression. |
| build.md | Full | Revised | Shortened the opening quickstart/reference choice. Kept navigation destinations and mechanism order. |
| changelog.mdx | Full | Reviewed/unchanged | Historical release updates are dense but were left intact under the no-changelog-change constraint. Preserved all Update markup and release claims. |
| compaction.md | Full | Revised | Split planner fallback behavior from the transcript-disclosure warning. Kept every failure category and model/thinking invariants. Existing ordinary-message wording needs separate technical review. |
| compaction/reference.md | Full | Revised | Separated recent-message counting, serialization, and lossless-tail guarantees. Kept zero behavior, image marker, and absent-query default. |
| computer-use.md | Full | Revised | Removed repeated script-preparation instructions while keeping app-specific version/object checks and the change record. Authorization, scratch-copy, and output checks remain in the preceding paragraph. |
| containerization.md | Full | Revised | Replaced a hesitant opening with two direct isolation choices; shortened bind-mount explanation. Kept host-write and credential warnings. |
| custom-provider.md | Full | Reviewed/unchanged | Provider choice, example links, and next-page map already guide readers directly. Preserved compatibility headings and moved-section links. |
| custom-provider/api-reference.md | Full | Revised | Made thinking-format choices a list rather than one dense paragraph. Kept each exact request shape, alias, condition, and all interface examples. |
| custom-provider/oauth.md | Full | Revised | Separated process isolation from login-label/callback behavior. Kept credential/function transport prohibitions and callback correlation. |
| custom-provider/override.md | Full | Reviewed/unchanged | Short example-led page already states the critical no-models preservation rule plainly. |
| custom-provider/registration.md | Full | Reviewed/unchanged | Registration and unregister instructions already use focused paragraphs around examples. Kept replacement warning and auth-header conditions. |
| custom-provider/streaming.md | Full | Revised | Shortened pending-stop explanation without weakening terminal-event requirements. Kept error checks and stream examples verbatim. |
| development.md | Full | Revised | Turned the startup benchmark's four measurements into a list. Kept timing arithmetic, nonce/tool checks, and accepted-sample requirements. Maintainer-content relocation deferred. |
| environment-variables.md | Full | Revised | Put ESC timeout behavior before renderer ownership and separated defaults from troubleshooting. Kept exact names and values. |
| extensions.md | Full | Revised | Split lazy-startup explanation and listed operation-specific discovery behavior. Kept resource waits, prefix misses, retry/resume distinctions, and legacy-anchor sections. |
| extensions/api-reference.md | Full | Revised | Shortened the scoped-model immutability explanation and separated compile-time from runtime guarantees. Kept fresh frozen array, entries, models, and throwing mutations. |
| extensions/authoring.md | Full | Revised | Removed an insult and filler from path-normalization guidance. Kept the leading-@ requirement and all authoring examples. |
| extensions/events.md | Full | Revised | Shortened system-prompt inspection guidance and removed the duplicated terminate guarantee. Kept one complete guarantee and all event examples. |
| extensions/examples.md | Full | Reviewed/unchanged | Categorized lookup table is already compact and specific. Kept example filenames, API names, and links. |
| extensions/ui.md | Full | Revised | Removed repeated handleInput paragraph, retaining the more complete version and separating it from abort guidance. Kept fallback, async, and Ctrl+C caveats. |
| getting-started/authentication.md | Full | Revised | Turned empty-picker troubleshooting into two actions. Kept the separate warning that configured credentials do not prove access. |
| getting-started/first-session.md | Full | Revised | Shortened and split first-run explanation into display behavior and immediate actions. Kept prior-state versus credential distinction. |
| getting-started/installation.md | Full | Revised | Separated platform support, package/archive layout, and Windows ARM caveats. Kept the complete-payload warning, redistribution prerequisite, and unvalidated hardware status. |
| getting-started/project-instructions.md | Full | Revised | Made missing-instructions checks a short list. Kept filename, ancestor discovery, and override precedence. |
| guides.md | Full | Reviewed/unchanged | Short navigation page already separates recommended order from additional references. |
| guides/configuration.md | Full | Reviewed/unchanged | Focused settings examples and two merge-rule bullets are already clear; kept all JSON verbatim. |
| guides/intercom.md | Full | Reviewed/unchanged | Brief definition, concrete coordination cases, and three benefits need no rewrite. |
| guides/non-interactive.md | Full | Revised | Removed self-referential orientation prose and simplified RPC use cases. Kept all mode choices and reference destinations. |
| guides/subagents.md | Full | Reviewed/unchanged | Concise delegation criteria already explain when to keep work local. Kept independent-context and background distinctions. |
| guides/workflows.md | Full | Reviewed/unchanged | Short orientation gives concrete workflow cases and the normal-chat alternative. Kept command literals and durable-run claims. |
| herdr.md | Full | Reviewed/unchanged | Status table, opt-out example, and troubleshooting are already action-oriented. Kept privacy and no-reconnect-polling limitations. |
| index.md | Full | Revised | Removed broad promotional positioning and redundant navigation explanation. Kept extensibility mechanisms and installation examples. |
| intercom.md | Full | Revised | Split bundled messaging purpose from lazy connection behavior. Kept local-only scope and startup registration distinction. |
| intercom/operations.md | Full | Revised | Split transport framing from client-side ask behavior. Kept platform transports, byte count, and protocol failure handling. |
| intercom/reference.md | Full | Revised | Listed live target forms and separated precedence, workflow paths, and visibility caveats. Kept exact-target warnings and wildcard meanings. |
| json.md | Full | Revised | Listed message-update fields with their individual conditions. Kept partial stripping, optional endTurn, zero usage, and protocol-error behavior. |
| keybindings.md | Full | Revised | Split question-overlay scrolling into viewport, Notes, and short-terminal behavior. Kept every key literal and local-input exception. |
| llama-cpp.md | Full | Revised | Separated unload safety, persisted catalog behavior, and reconnect action. Kept stale-catalog fallback, surfaced router error, and no-replay guarantee. |
| mcp-servers.md | Full | Reviewed/unchanged | Already concise setup examples, ordered config precedence, and actionable troubleshooting. Kept sensitive-login URL warning and inactivity-not-total-timeout distinction. |

## Validation and preservation

- Scoped `git diff --check` passed for the 40-page inventory.
- Compared every owned page against HEAD: fenced blocks, existing heading lines, Markdown link destinations, and explicit HTML anchors are unchanged and in the same order.
- All existing unique inline-code literals remain. Duplicate prose removal intentionally reduces repeated occurrences in extension events/UI; literals themselves are unchanged.
- Inspected the owned diff. The first large diff display clipped its beginning, so reread that portion separately with a scoped diff for background-tasks, build, and compaction. The final spacing edits were inspected through edit output.
- No runtime tests or docs rendering were run; these are prose-only changes with preserved examples and navigation.
- An initial edit was refused because a parallel read's snapshot was not accepted by the edit session. A direct read/search supplied accepted snapshots; subsequent edits succeeded. No unresolved editing failure remains.

## Deferred issues and boundaries

- `compaction.md` says the recent tail remains ordinary messages, while its reference describes serialized boundary content. Do not silently resolve this technical inconsistency in an editorial pass.
- Several pages, notably compaction, development, extensions, and Intercom operations, contain maintainer-only implementation history. Relocating or deleting it would change content scope and navigation, so this pass retains it.
- Historical `changelog.mdx` entries remain unchanged. No package CHANGELOG was touched.
- Existing extension examples use Bun installation commands and legacy structures. Examples were preserved verbatim rather than normalized to repository contributor setup.
- Existing headings, including duplicate compatibility anchors and title casing, were preserved despite unslop's general style preference.
- `progress.md` is outside the explicit batch edit allowlist. Sent the parent a progress update for integration rather than modifying that shared file.

## Authoritative audience amendment

> Note for the docs change: repository directive that this user-facing documentation stay concise and avoid internal implementation and debugging details. Move those mechanics to maintainer documentation and retain observable behavior and operator actions here

Applied to all 40 pages. This worker fully reread every current page, including tables, fences, references, and compatibility sections, plus AGENTS, unslop, and this ledger. Shell displays that clipped prefixes were followed by separate reads: background/build/changelog, computer-use lines 1–100, and Intercom lines 1–44. Large extension references were read in consecutive ranges. No page was reviewed by keyword sampling alone.

The amendment changes 17 user-guide pages and adds six topic-specific maintainer documents outside the shipped docs directory. Initial uncommitted editorial work remains. All rows below refer to this amendment; “retain” means no additional change after full audience review.

### Audience disposition for every page

| Page | Disposition | Concrete audience decision |
| --- | --- | --- |
| background-tasks.md | Relocate/shorten | Keep launch/wait/kill examples, task ownership, stop confirmation, states, and inspection. Move native timers, receipts/journal recovery, Windows containment, pause sequencing, and footer watcher lifetime. |
| build.md | Retain | Customization choices and navigation serve users; no internal mechanics. |
| changelog.mdx | Immutable | Byte-identical to HEAD and amendment baseline, including historical implementation claims. |
| compaction.md | Relocate/shorten | Keep triggers, loss warnings, keepContext, fallback disclosure, cancellation, hooks, entry schema, and branch before/after example. Move range normalization, outcome algorithm, retry arithmetic, sidecar internals, request isolation, and branch algorithm diagram. |
| compaction/reference.md | Relocate/shorten | Keep exact settings, overrides, hook examples, entry/result shapes, lossless-tail and signed-reasoning behavior. Move serialization rationale, upstream comparison, format migration mechanics, and implementation locator. Keep historical resume consequences. |
| computer-use.md | Retain | App recipes, platform setup, consent boundaries, capture checks, and recovery are operator actions on users' applications, not Atomic repository testing infrastructure. All examples remain. |
| containerization.md | Retain | Isolation choices, Dockerfiles, host-access and credential warnings, and transfers are deployment guidance. |
| custom-provider.md | Clarify/relocate | Keep provider registration and behavior checklist. Move repository test-directory context; identify listed test names as suggestions rather than an existing required suite. |
| custom-provider/api-reference.md | Retain | Interfaces, request shapes, compatibility flags, cost tiers, and capability enforcement are public provider contracts. |
| custom-provider/oauth.md | Relocate/shorten | Keep callback examples, cancellation/errors, catalog APIs, credential schema. Move descriptor transport and engine transaction/publication mechanics. |
| custom-provider/override.md | Retain | Proxy examples and no-models preservation rule are public API usage. |
| custom-provider/registration.md | Retain | Registration, unregister, model replacement, API selection, and auth headers are provider-author guidance. |
| custom-provider/streaming.md | Retain | Event order, stop reasons, block/tool assembly, cost accounting, and installed reference implementations support public provider authoring. |
| development.md | Relocate | Keep diagnostic reporting and concise anchor destinations. Move source setup, rebranding, asset resolution, benchmark methodology, timing internals, tests, smoke test, shrinkwrap, release boundary, and package maps. |
| environment-variables.md | Relocate/shorten | Keep names, defaults, precedence, credentials, and session metadata/opt-out contract. Move attribution entrypoint/child inventory and upstream-policy explanation. |
| extensions.md | Relocate/shorten | Keep readiness waits, commands, recovery actions, safety keys, isolated restrictions, host picker/form APIs, and examples. Move initializer leases, watchdog teardown, ownership protocol, bootstrap mechanics, and startup implementation. |
| extensions/api-reference.md | Retain | Context methods, frozen-copy guarantees, lifecycle hazards, embedded-host obligations, and examples are supported extension/SDK contracts, not maintainer optimization notes. |
| extensions/authoring.md | Relocate/shorten | Keep state lifetimes, reload behavior, tools, rendering, all examples. Move graph hashing/native builtin bridge optimization; split terminating-tool contract for readability. |
| extensions/events.md | Relocate/shorten | Keep event order, payloads, examples, observer obligations, and public diagnostic outcomes. Move internal root projector/ownership keys and prompt transport/dispatch mechanics. |
| extensions/examples.md | Retain | Runnable example lookup, including extension-author overlay QA examples, serves consumers rather than documenting the repository test runner. |
| extensions/ui.md | Relocate/shorten | Keep all code examples, options/restrictions, input behavior, marker usage, and rendering contracts. Move row-intersection composition, APC stripping, and default animation mechanics. |
| getting-started/authentication.md | Retain | Login, model selection, and access verification are operator actions; credential presence does not prove access. |
| getting-started/first-session.md | Retain | Workflow/skill choices, launch contracts, monitoring, and cost/privacy warnings explain usage, not Atomic maintainer implementation. |
| getting-started/installation.md | Relocate/shorten | Keep install/uninstall examples, platforms, Windows ARM caveat, full-payload warning, Node/Bun workflow compatibility, clipboard setup, and durability fallback. Move native-leaf selection and musl dependency rationale. |
| getting-started/project-instructions.md | Retain | File discovery, precedence, reload, and troubleshooting are user configuration. |
| guides.md | Retain | Task-oriented navigation only. |
| guides/configuration.md | Retain | Settings examples and merge rules serve users. |
| guides/intercom.md | Retain | Short coordination orientation and operator/reference destinations. |
| guides/non-interactive.md | Retain | Integration-mode choice, stdout usage, and RPC lifecycle are consumer guidance. |
| guides/subagents.md | Retain | Delegation criteria, context, and background choices are user decisions. |
| guides/workflows.md | Retain | Workflow choice and inspect/resume commands are user operations. |
| herdr.md | Retain | Eligibility, status interpretation, opt-out, privacy, and recovery describe observable integration behavior. |
| index.md | Retain | Installation and navigation only. |
| intercom.md | Relocate/shorten | Keep messaging, escalation, interview, and handoff examples. Move typed child-admission/interception mechanics; shorten priority input without dropping side-effect warnings. |
| intercom/operations.md | Relocate/shorten | Keep states, retry/outcome actions, notifications, controls, limits. Move topology, framing, HMAC/SQLite identity authority, log implementation/history, process launch, completion handshake. Recovery table now honors existing unknown-outcome no-resend warning. |
| intercom/reference.md | Relocate/shorten | Keep targeting, memberships, queue limits, authorization boundaries, reply selection, and config examples. Move capability minting and launcher-sentinel execution mechanics. |
| json.md | Shorten | Keep public event fields and retry/result/error semantics; split dense compaction-event paragraph. No maintainer content to relocate. |
| keybindings.md | Relocate/shorten | Keep action/default tables, config examples, physical recovery keys, clipboard actions, and viewport behavior. Move renderer version/SGR/focus-routing mechanics; link author input contract. |
| llama-cpp.md | Retain | Router setup, persisted-catalog fallback, limits, and reconnect actions help diagnose local models. |
| mcp-servers.md | Retain | Setup, discovery, auth, precedence, inactivity limit, and troubleshooting serve operators. |

### Relocation map

All destinations are under `docs/maintainer/readability-a/`. Each document names its source sections. Prose was consolidated by topic, not copied into a generic archive.

| Destination | Source sections |
| --- | --- |
| development-and-startup.md | development.md: Setup, Forking / Rebranding, Path Resolution, Startup timing probes, Testing, Installed package smoke test, Deterministic installs, Release security boundary, Project Structure. All eleven original maintainer fenced examples moved verbatim. |
| compaction-engine.md | compaction.md: range validation, markers, keepContext mechanics, turn integration, planning outcomes, fresh rung, truncated parser, diagnostics, token normalization, branch traversal, request isolation. compaction/reference.md: reconstruction/signed-thinking rationale, upstream budget distinction, compatibility, serialization locator. Truncated-output fence and algorithm Mermaid moved verbatim; public before/after tree remains. |
| extension-runtime.md | extensions.md: startup leases/replay, MCP cleanup, watchdog/recovery, request ownership, private bootstrap. extensions/authoring.md: dynamic hashing and builtin loader. extensions/events.md: prompt dispatch and workflow projection. extensions/ui.md: animation and overlay composition. Public API examples stay in source. |
| intercom-broker.md | intercom/operations.md: recovery ownership, failure types, retry identity/HMAC/capacity, half-close history, IPC, bounded stderr, completion order. intercom/reference.md: supervisor capability/default launcher. intercom.md: typed admission. Broker topology Mermaid moved verbatim. |
| task-supervision.md | background-tasks.md: native timing/state, terminal receipts/journal recovery, pause ordering, Windows jobs, footer watchers. keybindings.md: renderer/SGR/focused routing. Tool examples stay in source. |
| provider-auth-and-packaging.md | custom-provider/oauth.md: descriptors/credentials, transactions, bounded logout. custom-provider.md: repository test context. getting-started/installation.md: platform selection and musl dependency rationale. environment-variables.md: attribution inventory. All public provider/install examples stay in source. |

### Amendment validation

- Compared against a pre-edit snapshot of the uncommitted checkout, preserving the initial editorial changes rather than assuming HEAD was the baseline.
- Scoped `git diff --check` passed across all 40 pages, destination directory, and ledger.
- All 40 source pages retain heading lines in order and explicit HTML anchors. Every source fence balances.
- All 267 baseline fenced blocks survive byte-for-byte: 253 in their original page and 14 relocated verbatim as mapped above. This includes all public API examples.
- Every new maintainer-document URL resolves to a local file and heading anchor. Repository URLs are intentional because destinations are outside the published docs tree.
- changelog.mdx matches both the baseline and HEAD byte-for-byte.
- Every edit diff was inspected through tool output. One incorrect event-section range initially cut into an example; immediate inspection caught it, the exact fence was restored, and full fenced-block preservation passed. A ledger overwrite initially required a direct read; the subsequent edit used that snapshot. No unresolved edit failure remains.
- Other batches changed concurrently in this shared checkout. This worker's mutations touched only the 17 owned source pages, six destination documents, and this ledger. No claim is made that unrelated files were globally unchanged.
- No runtime tests, external URL checks, or rendered docs build ran. Fence/link/anchor checks do not prove rendered appearance or runtime behavior.

### Current deferred items and boundaries

- No maintainer relocation is deferred. The earlier deferral is withdrawn.
- The compaction introduction's disputed “ordinary messages” representation was replaced with the shared preservation claim; the existing reference still describes the tail representation. No runtime verification or architectural change was made.
- Historical changelog.mdx is immutable. No package CHANGELOG, runtime file, root progress.md, or other batch ledger was edited.
- Consumer Bun install examples and legacy-compatible layouts remain verbatim; they were not normalized to contributor setup.
- Existing heading capitalization and compatibility anchors remain. A global link audit and docs rendering remain unperformed.
- No commit, push, PR, new worktree, or nested delegation occurred.
