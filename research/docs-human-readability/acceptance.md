# Full documentation readability pass

## Contract

Review all recursive Markdown/MDX pages under `packages/coding-agent/docs` in the existing `docs/human-readable-guides` checkout. Improve dense prose, preserve technical content and navigation, and account for every page. The initial inventory contains 92 pages. The prior four-page pass is not sufficient.

## Acceptance matrix

| Requirement | Current-checkout evidence/check | Status |
| --- | --- | --- |
| Use existing checkout and branch; preserve `2175058c1e1dfd5850a61914566ab45110a65ef4` | Existing branch and ancestor checked before and after signed commit | Passed |
| Inventory and fully read every Markdown/MDX recursively, not a sample | Both complete batch-table sets reconciled by `verify.py`; worker full-read receipts retained | Passed: 92 pages |
| Revise all pages needing improvement; shorter coherent sentences/paragraphs, less repetition, useful sections/bullets; avoid cosmetic churn | `coverage.json` records actual diff status and initial/audience reasons | Passed: 74 revised, 18 unchanged |
| Account for every page as revised or reviewed/unchanged with a concrete reason outside user-facing docs | `coverage.json`, `batch-{a,b,c}.md`; no duplicate or missing rows | Passed |
| Revisit workflows/operations.md, workflows/api-reference.md, sdk.md, subagents/reference.md | Batch B/C audience records; integration technical review in `final-validation.md` | Passed |
| Preserve meaning, warnings, examples, configuration/API names, navigation/anchors | Baseline audit plus technical prose/inline-literal review in `final-validation.md`; factual disputes remain explicitly deferred | Passed within documented scope |
| Keep code examples intact unless accurate prose context requires change | 889 ordered public fences and 16 explicitly mapped maintainer fences, byte-identical | Passed |
| Docs-only plus necessary docs checks, no runtime changes or released changelog edits | Scoped diff and immutable changelog assertion | Passed |
| Run docs checks | `logs/docs-check.txt`, `logs/information-architecture.txt`; 29 tests | Passed |
| Run link/anchor checks | Docs check, IA, Mintlify broken-links, 74 locally validated repository links/anchors | Passed |
| Run Mintlify validation | Cached mint 4.2.731 on Node 22; `logs/mintlify-validate.txt` | Passed |
| Representative desktop/mobile browser checks spanning edited categories | Ten edited routes at both sizes; DOM/screenshots, overflow, mobile navigation, deep workflow anchor; `browser/` | Passed; representative, not full rendered review |
| Cohesive batches with checks and preservation review; integration owns reconciliation | Three disjoint lexical batches; repeatable integration audit and final validation | Passed |
| Read repository instructions and unslop; follow conventions, hooks and model attribution | Repository/skill reads, signed conventional commit, `Assistant-model: GPT-6-Astra`, and enabled hooks; `logs/commit-checks.txt` | Passed |
| No internal audit reports in user-facing docs | Evidence restricted to `research/docs-human-readability`; maintainer knowledge in `docs/maintainer` | Passed |
| Move internal implementation/debugging/test/maintainer explanations to repository documentation; retain public API usage, behavior, configuration and operator actions | All-page audience records, 21 maintainer destinations, relocation map and technical review | Passed |
| Commit and confirm clean tree | Signed commit, `git verify-commit HEAD`, ancestor and clean-status checks; final amended SHA in execution receipt | Passed; reconfirmed in final receipt |
| Update existing PR #3120 on the same branch, never create duplicate | Reserved for reviewer/reducer approval and later authorized handoff | Deferred; no external write |
| Concise PR coverage summary may count/link reviewed pages | 92 reviewed, 74 revised, 18 unchanged; final evidence and batch links prepared | Ready for later authorized update |

## Preservation choices and applicable risk classes

This is prose-only work, not an API or state-machine change. Existing named types, field identity, required/optional fields, duplicate handling, ordering, omitted/empty values, unusual input, raw text, configuration precedence and working-directory behavior remain as documented. Do not normalize examples or add validation/restrictions. Preserve public examples verbatim and retain original headings/anchors and link destinations where practical. The authoritative amendment permits internal paragraphs, literals and maintainer examples to move to repository documentation; record and verify each relocation rather than requiring those internals to remain in user guides. Review technical prose changes for these contract-sensitive details. No runtime behavior or new interface is introduced.

Workflow states for this work are inventory, full-page review, revision/no-change accounting, reconciliation, validation, commit, independent review, and authorized PR update. No sampled review may transition to complete; no PR write occurs during this orchestrator stage. A failed preservation or rendering check returns affected pages to revision and validation.

## Preflight

- Clean checkout at `2175058c1`, branch `docs/human-readable-guides`; required ancestor exists.
- Repository is an npm TypeScript workspace with Bun script execution, existing node_modules, built AI/coding-agent outputs, and existing Qlty configuration. Node v26.8.2 and Bun 1.4.2 are available. Validation must use a supported Mintlify Node runtime if its requirements differ.
- `AGENTS.md`, `CONTRIBUTING.md`, `DEV_SETUP.md`, package scripts, hook config, recent history and PR #3120 inspected. Requesting GitHub user is flora131; recent merged PRs are theirs. Prior documentation commit uses a valid SSH signature and the model trailer above. GitHub merge signature inspection cannot use unavailable gpg; this does not affect the verified SSH signature.
- Root npm check and pre-commit hooks remain authoritative. Qlty supplements them; its current config has no Markdown plugins, so an empty result is not Markdown lint coverage.
- No prior work receipts or review artifacts in the active goal ledger.

## Delegation

- Batch A: relative paths lexically before `models.md`.
- Batch B: relative paths from `models.md` inclusive to `subagents.md` exclusive.
- Batch C: relative paths from `subagents.md` inclusive onward.
- All edits occur in the same checkout with nonoverlapping page ownership. Each owner fully reads and accounts for every assigned page. Final integration owns checks and commit.

## Deferred observations

- Setup/contribution docs outside the requested directory contain older install/test descriptions that conflict with current AGENTS.md. They are out of scope and are not changed.
- Final checks, repairs, inline-literal decisions, browser scope, separate evals/ui ownership, and remaining factual questions are in `final-validation.md`. Remote maintainer links become available after merge, not before.
- `npm run check` passed. Qlty ran with the existing plugin-free configuration and supplies no Markdown lint coverage. Root generated progress and resolved issue tracking were removed before commit.

## Contract amendments received

Inherited user correction: 'huh, well I was kind of hoping you would do this for all the docs pages in packages/coding-agent/docs?' This is required scope, not deferred work.

Authoritative user amendment received during the initial batches, verbatim: "Note for the docs change: repository directive that this user-facing documentation stay concise and avoid internal implementation and debugging details. Move those mechanics to maintainer documentation and retain observable behavior and operator actions here".

This supersedes blanket internal-paragraph/literal retention and expands allowed documentation destinations outside the user-doc directory. Public extension/SDK API usage remains user-facing. Useful internal knowledge must be relocated, not discarded. The amendment was broadcast to all workflow stages and assigned as a complete audience-review follow-up across the same three batches. Earlier batch notes that defer maintainer relocation are superseded by this requirement.
