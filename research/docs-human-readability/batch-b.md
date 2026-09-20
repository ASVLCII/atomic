# Editorial batch B

Parent attribution: GPT-6-Astra.

## Scope and method

Independently enumerated every `.md` and `.mdx` below `packages/coding-agent/docs` whose relative POSIX path sorts `>= models.md` and `< subagents.md`. Result: **31 Markdown pages, no MDX pages; 26 revised and 5 reviewed unchanged**. Nested paths were included, not just top-level pages.

Fully read every owned page through `read`, including all examples, tables, warnings, and historical sections. The full read of `sdk/reference.md` exceeded the tool's 50,000-character limit, so it was read in contiguous ranges: 1–653 and 654–1122. Every other page returned its complete contents in its full-page read. Short later reads only renewed edit snapshot tags; they did not replace the full reads. No sampled or omitted sections were treated as reviewed.

Also read `AGENTS.md`, `packages/workflows/skills/unslop/SKILL.md`, `DESIGN.md`, `PRODUCT.md`, `progress.md`, and the installation guide. Applied the direct, precise product voice and the skill's dense-sentence guidance. Existing headings were kept despite the skill's general preference for sentence case, because the assignment explicitly protects headings and anchors.

## Page-by-page disposition

Paths below are relative to `packages/coding-agent/docs`. Read ranges refer to the original pages, before editorial changes. Every row confirms a full read.

| Page | Full read | Disposition and concrete reason | Preservation decisions |
| --- | --- | --- | --- |
| `models.md` | Yes, 1–214 | Revised. Separated the single-file configuration rule, catalog refresh, deadline, and credential-generation behavior into readable paragraphs. | Kept path precedence exclusions, the 15-second bound, cached fallback, and the unsupported-default diagnostic contract. |
| `models/artificial-analysis-index.md` | Yes, 1–89 | Revised. Replaced the abstract introduction with a direct explanation of benchmark purpose. | Kept the historical-status note, dates, source weighting, and all benchmark claims. No live refresh implied. |
| `models/evals.md` | Yes, 1–471 | Revised. Shortened the introduction and separated retrieval provenance, normalized Elo, and non-hallucination definitions. | All measured values, tables, Mermaid fences, dates, formulas, and significance caveats remain. |
| `models/model-selection.md` | Yes, 1–147 | Revised. Broke the long snapshot note into pricing, uncertainty, effort, and historical-selection bullets. | Retained all four alternate Best-view configurations, seven excluded configurations, prices, access warning, and dated evidence. |
| `models/pareto-efficiency.md` | Yes, 1–90 | Revised. Separated Best-view membership from highest-effort dominance and other non-frontier rows. | Retained exact unrounded rates, costs, effort identities, and view-specific qualification. |
| `models/reference.md` | Yes, 1–623 | Revised. Split PDF support into capability, transport, and media-type rules; shortened the sampling-parameter merge explanation. | Kept placeholder behavior, Bedrock citation requirement, PDF-only validation, last-wins ordering, and the exact three stripped keys. |
| `packages.md` | Yes, 1–171 | Revised. Removed a repeated package definition and split self-update behavior from installation eligibility. | Kept exact-version pinning, release-note timing, manual fallback, Windows quarantine cleanup, and security warning. |
| `packages/authoring.md` | Yes, 1–88 | Revised. Removed runtime-resolution detail from the directory-list bullet and gave it separate paragraphs. | Kept all supported suffixes, singular alias, import specifiers, host-module resolution, and manifest exception. |
| `packages/reference.md` | Yes, 1–43 | Revised. Explained inherited-resource adjustment separately from ordinary project precedence. | Kept `autoload: false`, include/exclude behavior, identity rules, and filtering example. Does not imply rewriting global settings. |
| `programmatic.md` | Yes, 1–29 | Revised. Turned the three integration-mode descriptions into a scan-friendly list. | Kept process lifetimes, structured-event behavior, permission prompts, and SDK control scope. |
| `prompt-templates.md` | Yes, 1–107 | Revised. Shortened prerequisites and the choice between templates, skills, and extensions. | Kept discovery paths, argument syntax, all fenced templates, and linked alternatives. |
| `providers/reference.md` | Yes, 1–23 | Revised. Shortened unknown-stop and pending-stream rules without hiding failures. | Kept raw reason reporting, existing successful mappings, terminal-state requirement, and credential order. |
| `providers.md` | Yes, 1–505 | Revised. Split login instructions by flow and separated refresh timing from shared-file locking. | Kept remote paste fallback, extension callback support, engine credential boundary, five-minute threshold, and concurrency behavior. |
| `quickstart.md` | Yes, 1–182 | Revised. Replaced onboarding meta-prose and split image-paste instructions by platform and clipboard behavior. | Kept onboarding order, runtime prerequisites, every redirect heading, Alt+V on Windows, and tmux/terminal caveats. |
| `reference/cli.md` | Yes, 1–252 | Revised. Put partial-secret output, completed output, and JSON status into separate paragraphs. | Kept exit 9 discard requirement, exit 0 drain behavior, stderr diagnostics, and all command/flag tables. |
| `reference.md` | Yes, 1–49 | Reviewed unchanged. This is already a concise, grouped index of exact references and platform setup links. | All labels, routes, headings, and inline contract names remain untouched. |
| `rpc/examples.md` | Yes, 1–64 | Reviewed unchanged. Two short source pointers lead directly to a complete client example; rewriting would add churn. | Complete Node client fence and source destinations untouched. |
| `rpc/extension-ui.md` | Yes, 1–198 | Reviewed unchanged. Method-by-method request/response structure is easy to scan, with concise limitations and defaults. | Kept timeout/cancellation rules, no-op methods, expansion-state exception, and all JSON examples. |
| `rpc/protocol.md` | Yes, 1–1341 | Revised. Split bash ordering from session ownership; separated entry retrieval from durable cursor instructions. | Kept request IDs, exactly one terminal response, replacement isolation, strict-after cursor semantics, and every wire example. |
| `rpc.md` | Yes, 1–424 | Revised. Split unsupported-default failure, recovery, and ordinary fallback into separate paragraphs. | Kept correlated errors before user/model events, non-prompt availability, null-cycle exception, framing rules, and all compatibility headings. |
| `sdk/reference.md` | Yes, 1–1122 in contiguous ranges | Revised. Converted the successful structured-output call's effects into bullets. | Kept schema/runtime support conditions, capture/details/file sinks, termination, and persistence opt-out. Full task-supervisor reference was read and retained. |
| `sdk/structured-decisions.md` | Yes, 1–120 | Revised. Separated Jev context estimates, overflow recovery instructions, and response validation. | Kept 32k/64k limits, estimate-not-guarantee caveat, no trimming/retry, HTTP 422, 1 MiB limit, and no confidence threshold. |
| `sdk.md` | Yes, 1–820 | Revised again after the prior pass. Shortened introduction and live-partial warning; split host input, disposal, reload rollback, replacement continuation, and queue-pause contracts. | Kept permission semantics, cleanup failures, borrowed ownership, deadlock warning, pause data/order guarantees, explicit resume requirement, and all code fences. |
| `security.md` | Yes, 1–73 | Revised. Separated declined trust, pre-trust extensions, and borrowed-resource trust. | Kept all protected paths, first-decision ownership, arbitrary-code warning, no-sandbox boundary, and credential-export guarantees. |
| `session-format.md` | Yes, 1–467 | Revised. Split compaction rebuild into boundary construction, tail representation, and resumed state. | Kept full tool text, retained images, null-tail behavior, post-boundary messages, planner-free resume, and all JSONL/type examples. |
| `sessions.md` | Yes, 1–169 | Revised. Split custom-directory inheritance and overrides; shortened the summary-generation exclusions. | Kept explicit stage-directory precedence, default global-store behavior, silent failures, cancellation, and opt-out. |
| `settings.md` | Yes, 1–516 | Revised. Split deferred startup by phase, list unsupported-default behavior by mode, and separate fallback retries from persistent session selection. | Kept trust persistence exception, readiness gate, eager-loading cases, model default exceptions, same-turn fallback, and every settings table/example. |
| `shell-aliases.md` | Yes, 1–13 | Reviewed unchanged. The page already gives one cause, one configuration example, and one path-adjustment instruction. | Alias execution snippet and legacy path untouched. |
| `skills/authoring.md` | Yes, 1–95 | Revised. Converted dense writing guidance into actionable bullets. | Kept completion/stop rules, references directory, reasoning privacy, validation guidance, and nested fences verbatim. |
| `skills/reference.md` | Yes, 1–60 | Reviewed unchanged. Compact field table and validation lists already distinguish warnings, ignored files, and rejected skills. | Kept specification link, limits, frontmatter examples, and collision precedence. |
| `skills.md` | Yes, 1–194 | Revised. Removed a repeated definition and separated qlty commands, skill behavior, installation, and offline limits. | Kept executable-content warning, commands and install literals, first-use network requirement, feedback privacy caveats, and stage-chat rules. |

## Preservation and validation

- Ran scoped `git diff --check` over the independently enumerated 31 pages: passed.
- Compared every owned page against `HEAD` with a read-only Python audit: all fenced blocks were byte-for-byte equal, including nested fences and Mermaid. Heading sequences, explicit anchor tags, link destinations, and sets of inline code literals were also equal.
- Inspected the complete owned diff in two scoped `git diff` calls. Clarified Windows paste wording and inherited package resources during that inspection; their final edit diffs were also inspected.
- No runtime files, released changelogs, or out-of-scope guides were edited. The only non-owned-doc writes were this evidence file and the explicitly requested batch-B section in `progress.md`.
- No commits, pushes, pull requests, worktrees, or nested delegation. Runtime tests and browser rendering were not run for this prose-only pass.

## Deferred issues and boundaries

This is an editorial pass, not a factual/API reconciliation or benchmark refresh. The following pre-existing issues were left unchanged rather than silently choosing new behavior:

- `sdk/reference.md` says workflow/subagent routing is not enabled yet, while `sdk/structured-decisions.md` documents its use. Reconcile against runtime in a separate task.
- `reference/cli.md` and `security.md` say print exports accept only provider/model flags, while the CLI reference also documents `--min-expiry` for bearer export. Preserve the existing contract text until verified.
- `models/reference.md` places a thinking-token-cap paragraph under request-wide cost tiers. Moving it would be structural work beyond this narrow pass.
- `sdk.md`'s complete example does not show disposal despite the surrounding disposal guidance. Fenced examples were explicitly protected and remain verbatim.
- `skills/authoring.md` contains `bun install` inside protected example fences. It is consumer example text, not an instruction executed during this task.
- Superseded by the authoritative amendment below: maintainer/test-history relocation is complete for this batch, not deferred.
- Dated benchmark data, model access claims, and cross-page technical inconsistencies were not refreshed. No recommendation or runtime default was changed.

## Authoritative audience amendment

Applied the user's exact direction: “Note for the docs change: repository directive that this user-facing documentation stay concise and avoid internal implementation and debugging details. Move those mechanics to maintainer documentation and retain observable behavior and operator actions here”. This section supersedes the initial pass's blanket literal-retention policy and relocation deferral. Earlier page dispositions and checks describe that earlier pass, not the final amendment.

Read `AGENTS.md`, the unslop skill, the initial ledger, and all 31 current owned pages. Long pages were read in contiguous ranges; truncated combined output was followed by smaller reads. Reassessed whole pages, including examples, compatibility sections, benchmark methodology, lifecycle sections, and existing redirect headings. Twenty pages changed in this amendment; eleven retained their task-start contents after audience review. The user guides are 39,052 UTF-8 bytes shorter than the task-start snapshot.

### Audience review for every page

Paths are relative to `packages/coding-agent/docs`. “Retained” means no additional amendment edit, not necessarily unchanged from HEAD. Destination names below are relative to `docs/maintainer/readability-b/`.

| Page | Audience disposition after full read | Relocation or retention decision |
| --- | --- | --- |
| `models.md` | Revised refresh and reload prose to observable status, cached fallback, and operator action. | Deadline enforcement, credential generations, and rebuild mechanics → `provider-runtime.md#catalog-refresh`. Kept every configuration example, 15-second bound, source precedence, and unsupported-default behavior. |
| `models/artificial-analysis-index.md` | Revised maintainer refresh section to a dated-source warning and link. | Issue attribution, refresh policy, and shared-data suggestion → `benchmark-maintenance.md#refresh-procedure`. Historical benchmark definitions and role table remain useful source interpretation. |
| `models/evals.md` | Revised chart-refresh procedure and obsolete-index history. | Browser/Recharts extraction → `benchmark-maintenance.md#refresh-procedure`; naming history → `#retrieval-history-and-naming`. Retained all measurement tables, Mermaid charts, formulas, units, confidence caveats, and external experiment methodology. These explain model-choice evidence, not Atomic test infrastructure. |
| `models/model-selection.md` | Revised retrieval-history and provider-generation walls into dated limits, catalog checks, and selection guidance. | Browser verification scope and generation observations → `benchmark-maintenance.md#retrieval-history-and-naming` and `#provider-generation-observations`. Kept measurement/production-effort separation, account caveats, all recommendation rows, and exact model identities. |
| `models/pareto-efficiency.md` | Revised historical frontier narrative to current dated disposition and pricing caveat. | Earlier frontier membership and price corrections → `benchmark-maintenance.md#frontier-history`. Kept Best versus highest-effort distinction, unrounded dominance values elsewhere on page, off-peak exception, and role/diversity guidance. |
| `models/reference.md` | Revised PDF builder detail, preserved-thinking serialization narrative, and ETag mechanics. | → `provider-runtime.md#pdf-transport`, `#preserved-thinking`, `#catalog-refresh`. Kept public compatibility fields, payload controls needed by custom-provider authors, override precedence, fallback marker warning, provider restrictions, and every example. |
| `packages.md` | Revised Windows update mechanics and stage-loader construction. | → `resources-and-ui.md#package-loading`. Kept exact-version installs, manual fallback, trust, resource inheritance, explicit loader override, package sources, destructive git reconciliation warning, and filters. |
| `packages/authoring.md` | Revised in-memory host resolution into supported imports. | → `resources-and-ui.md#package-loading`. Kept public manifest examples, dependencies, suffixes, aliases, and workflow discovery exception. |
| `packages/reference.md` | Retained. | Filtering syntax, inherited-resource adjustment, and npm/git/local identity rules are concise operator configuration contracts; no maintainer-only passage found. |
| `programmatic.md` | Retained. | Short integration-mode comparison and reference links are public entry guidance; no implementation relocation needed. |
| `prompt-templates.md` | Retained. | Locations, format, expansion, arguments, and loading rules are all actionable template usage. Examples stay intact. |
| `providers/reference.md` | Retained. | Pending/terminal reasons, failure visibility, and credential order are public provider/client contracts, not debugging history. |
| `providers.md` | Revised OAuth ownership/lock prose, auth projections, Codex socket/header mechanics, source-map note, and Jev transport overview. | → `authentication.md#oauth-ownership-and-refresh`, `#provider-source-map`; `provider-runtime.md#codex-fast-routing`, `#catalog-refresh`, `#structured-decision-transport`. Kept auth variables, endpoints and headers users configure, subscription constraints, credential lifetimes, cancellation, cloud examples, and Workers binding SDK example. |
| `quickstart.md` | Revised tmux image-paste explanation to the reliable key and caveat. | Terminal protocol/forwarding differences → `resources-and-ui.md#terminal-input-and-layout`. Kept onboarding path, install/runtime prerequisites, all examples and redirect anchors. |
| `reference/cli.md` | Revised fullscreen wall into input, selection, and exit actions. | Mouse-dispatch implementation → `resources-and-ui.md#terminal-input-and-layout`. All flags, exits, credential-discard/drain distinctions, environment snapshot contracts, and examples remain public. |
| `reference.md` | Retained. | A concise navigation index; source/maintainer destinations are links, not embedded internal prose. |
| `rpc/examples.md` | Retained. | The Node client is a public usage example even though one linked complete example resides under `test/`; no test-harness discussion or runtime mechanics to relocate. |
| `rpc/extension-ui.md` | Retained. | Dialog request/response JSON, no-op methods, timeout defaults, and state limitations are needed by RPC client and extension authors. |
| `rpc/protocol.md` | Revised isolated ACK plumbing, compaction implementation, Bash conversion prose, and streaming complexity rationale. | → `rpc-transport.md`; planner mechanics → `session-lifecycle.md#compaction-reconstruction`. Kept ACK-target ordering guidance, acceptance versus completion, correlation, exactly one terminal response, cursor semantics, all wire examples/types and errors. |
| `rpc.md` | Retained. | Starting, framing, saved-default recovery, Python example, and compatibility redirects are public client guidance. No internal algorithm wall remains here. |
| `sdk/reference.md` | Revised raw native-supervisor material and repeated lifecycle mechanics. | Native admission, journals, report identity, cleanup/platform internals, transcript adapter, S1 history and fake-runner evidence → `task-supervision.md`. Lifecycle mechanics → `session-lifecycle.md`. Retained exported `AgentTaskHost` usage, authorization boundary, observation versus execution, cleanup obligations, all SDK examples, tool options, and public loader/model APIs. |
| `sdk/structured-decisions.md` | Revised the token-estimation formula into a limit caveat and link. | Formula → `provider-runtime.md#structured-decision-transport`. Kept public tournament behavior because candidate grouping affects results/costs; kept schemas, `retainForFinal`, one-shot versus repair policy, context/deadline/response limits, cancellation, and diagnostic actions. |
| `sdk.md` | Revised full lifecycle subsections, not just introductory paragraphs. | Drain coverage, rollback permutations, re-instantiation, and replacement publication mechanics → `session-lifecycle.md`. Kept awaited disposal, shutdown errors, cleanup registration, deadlock warning, old-capability restrictions, strict/ordinary reload distinction, ownership, host input, child inheritance, queue contracts, and every public example. |
| `security.md` | Revised sandbox design rationale and credential wrapper/test history. | → `authentication.md#sandbox-rationale` and `#credential-export-safeguards`. Retained trust paths, pre-trust extension authority, no-sandbox warning, containment actions, export guarantees and downstream-secret risk. |
| `session-format.md` | Revised repository-layout aside and compaction reconstruction explanation. | → `session-lifecycle.md#compaction-reconstruction`. Kept public persisted schemas, archival record examples needed by parsers, null-tail behavior, context results, workflow classification, SessionManager methods, and all examples. |
| `sessions.md` | Revised resumed-context implementation and cooperative picker scheduling. | → `session-lifecycle.md#compaction-reconstruction` and `#resume-picker-scheduling`. Kept resume/summary behavior, old-session caveat, storage precedence, workflow recovery, keyboard actions, and branch semantics. |
| `settings.md` | Revised trust-safe startup, cooperative scheduling, managed onboarding markers, renderer/editor mechanics, telemetry measurement interpretation, wrapper lookup, and renderer-version attribution. | → `resources-and-ui.md`. Kept every settings key, supported values, privacy data/destinations/opt-outs, configuration precedence, prompts/readiness behavior, editor failure semantics, and all examples. |
| `shell-aliases.md` | Retained. | The short `bash -c` explanation directly explains why aliases need the supplied configuration. Not an internal implementation wall. |
| `skills/authoring.md` | Retained. | Consumer skill structure, frontmatter, concise instruction rules, and worked examples belong in public authoring docs. Protected `bun install` examples remain untouched. |
| `skills/reference.md` | Retained. | Validation rules, frontmatter limits, warning versus rejection, and collision precedence are public author contracts. |
| `skills.md` | Revised bundled source location and stage attachment/pause mechanics. | → `resources-and-ui.md#stage-chat-skills`. Kept discovery, commands, qualified selection, permissions, input ownership, literal-queue recovery, host admission requirement, feedback privacy, and qlty installation/offline behavior. |

### Destination inventory and preservation

Seven cohesive maintainer files were created: `authentication.md`, `benchmark-maintenance.md`, `provider-runtime.md`, `resources-and-ui.md`, `rpc-transport.md`, `session-lifecycle.md`, and `task-supervision.md`. Each records its source sections. Most mechanics were condensed without changing their technical constraints. The two credential-wrapper/egress evidence bullets moved verbatim from `security.md` to `authentication.md#credential-export-safeguards`.

No fenced example was moved or rewritten. All public code, JSON, TypeScript, shell, nested skill, session-format, and Mermaid blocks remain byte-for-byte equal to both task-start contents and HEAD. Maintainer-only inline examples and identifiers are retained in the destination topic. Historical S1 “later slices” claims are labelled as chronology rather than presented as current product availability.

### Amendment validation

- Independently enumerated exactly 31 Markdown pages in the required relative-path range; no MDX pages.
- Read-only Python preservation review passed for every page: identical fenced blocks against task-start and HEAD; identical heading order and explicit anchor tags against task-start.
- All newly added GitHub maintainer links resolve to existing local destination files and heading anchors. Remote published availability is not claimed before these uncommitted files are integrated.
- Scoped `git diff --check` passed for the 31 pages, destination directory, and this ledger. Reviewed edit diffs and corrected transient line-range mistakes before the final preservation audit.
- The final audience scan distinguished public SDK/protocol/schema details from private ownership, serialization, scheduling, source-location and test history. No runtime or changelog edits, commits, pushes, PRs, new worktrees, or delegation were performed.
- This child did not write `progress.md` or another batch. Other workers changed out-of-scope guides concurrently; no global-cleanliness claim is made and none of their changes was reverted.
- Runtime tests and browser rendering were not run for this documentation-only amendment.

### Remaining factual follow-ups

Relocation is not deferred. The earlier API/factual discrepancies remain separate work: SDK router availability wording; credential-export `--min-expiry` versus “only provider/model” wording; the thinking-token paragraph under cost tiers; the complete SDK example's missing disposal; and Google's Gemini 3.7 MINIMAL/catalog discrepancy. The old SDK compaction prose said JSON ranges while RPC said bare `start,end`; both historical descriptions are recorded in maintainer context notes, while public SDK prose now describes only the stable operation and persisted result. No wire format was selected or changed. Benchmarks, prices, entitlement, and third-party URLs were not live-revalidated.
