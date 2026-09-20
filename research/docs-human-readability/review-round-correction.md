# Consolidated review correction

## Findings and cause

Starting HEAD was `ed649a9d287a95d3c9d9caa6ec159001e18df7ad` on `docs/human-readable-guides`, in the existing checkout. Consolidated findings at review-round-latest.json lines 441–503 from completion-reviewer, evidence-reviewer and risk-reviewer all describe one P2 defect at `workflows/operations.md:432`.

`git log -p -1 -- packages/coding-agent/docs/workflows/operations.md` and the original `2175058c1` section show that the audience pass replaced an operator-action paragraph with a duplicate of the following host-invalidation explanation. The earlier semantic-preservation claim was too strong: headings, fences and literal accounting did not detect this lost state-transition guidance.

The replacement now explains that Escape aborts only active work in the retained post-mortem conversation and restores queued steering/follow-up text to the editor. Its queue stays held even after clearing or restoring visible items. Ordinary submission releases that conversation queue before a new turn. Neither action pauses, resumes or changes terminal workflow execution. The accidental host-invalidation duplicate is gone; the original following explanation remains. This resolves all three findings without adding implementation or debugging material to the user guide.

## Regression and runtime evidence

The TDD guidance was loaded before extending `verify.py`. Its focused post-mortem section check requires each action and state boundary and exactly one host-invalidation explanation. No prior checks were weakened.

- Before the doc edit, `python3 research/docs-human-readability/verify.py` exited 1. `logs/review-regression-red.txt` records all six missing action/state requirements and two host-invalidation explanations.
- After the edit, the same command passed. Output compared byte-for-byte with existing `coverage.json` using `cmp`; `logs/review-regression-green.txt` records success. No coverage artifact refresh was necessary.
- `npx --no-install vitest --run --project unit test/unit/stage-chat-view-09.test.ts -t 'Escape interrupts completed ad-hoc chat'` passed 1 selected test, with 8 unrelated tests filtered out. `logs/review-stage-chat.txt` records the run. Existing assertions at lines 308–326 cover restore-queued-message interruption, one abort, native hold, no workflow pause, completed status, then one queue release and ordinary prompt delivery. Runtime tests were not modified.

## Repeated validation

All commands below exited 0. Logs use the `logs/review-` prefix.

| Check | Result |
| --- | --- |
| `npm --workspace=@bastani/atomic run docs:check` | 92 Markdown/MDX files and 92 docs pages; `docs-check.txt` |
| `npx --no-install vitest --run --project unit test/unit/docs-information-architecture.test.ts` | 29 passed; `information-architecture.txt` |
| `python3 research/docs-human-readability/verify.py > /tmp/review-coverage.json` followed by `cmp /tmp/review-coverage.json research/docs-human-readability/coverage.json` | Preservation and unchanged coverage passed |
| Cached Mintlify `validate` | Build validation passed; `mintlify-validate.txt` |
| Cached Mintlify `broken-links` | No broken links; `mintlify-links.txt` |
| `~/.local/bin/qlty check` | No applicable modified files; `qlty.txt`. Existing config unchanged and contains no Markdown plugins. Not Markdown lint coverage |
| `prek run` with correction files staged | Applicable hooks and `npm run check` passed; `hooks.txt` |

Mintlify commands ran in `packages/coding-agent/docs` with `PATH=/opt/homebrew/opt/node@22/bin:$PATH node ~/.npm/_npx/ba80d1e8ef6a1977/node_modules/mint/index.js`. Broken-links does not independently establish anchor coverage; existing IA and preservation checks remain applicable.

## Rendered section

Started an owned Mintlify preview on port 3334 in tmux session `readability-review`. Playwright CLI session of the same name visited `/workflows/operations`, located the restored paragraph and scrolled it into view at 1440×1000 and 390×844. Both DOM receipts contain the entire restored guidance. Document width equaled viewport width at both sizes; the mobile paragraph bounds were x=20, right=370 in a 390px viewport. Screenshots were inspected and show readable wrapping without clipping of the restored paragraph.

Proof is in `browser/review-{desktop,mobile}.{txt,yaml,png}`. `browser/review-console.txt` records zero errors and the preview Socket.io connection warning. Closed only the owned browser and preview. This rechecks the affected documentation section, not runtime TUI behavior or every rendered page. The previous ten-route desktop/mobile coverage remains established in `final-validation.md`.

## Scope and remaining limits

The audit still accounts for all 92 pages: 74 revised and 18 reviewed unchanged, with 21 maintainer destinations. It still verifies 889 public fences, 16 relocated fences, headings, explicit IDs and 74 repository links. Only one public paragraph changes in this correction; other changes are the necessary check and audit evidence. No runtime, released changelog, maintainer relocation, Git identity/configuration, push, PR write or worktree change is included. The required initial commit remains an ancestor. Future PR identity remains flora131.

Tracked the defect in root `issues.md` during repair and removed it after resolution. Commit uses signing, enabled hooks, conventional docs scope and `Assistant-model: GPT-6-Astra`; the execution receipt supplies the resulting SHA, signature verification and final clean status.

The focused prose check intentionally guards this wording's actions and boundaries, not universal semantic equivalence. Future wording changes must preserve these facts and update the check deliberately. Existing deferred factual questions, physical-device limitations and pre-merge remote-link availability remain as documented in `final-validation.md`.
