# Builtin verification and design maintenance

Relocated from `packages/coding-agent/docs/workflows/builtins.md` and `workflows/reliable-design.md`: builtin prompt layout, Goal ledger separation, scoring cache mechanics, trend reducer, research figures, and live-design helper protocol. Public contracts, thresholds, output fields, diagrams, and custom-workflow examples remain in their guides.

## Prompt and ledger organization

Builtin model prompts use outcome-first contracts tuned for GPT-5.6, Claude Opus 5, and Claude Fable 5. Long artifacts precede final instructions; reporting stages bind claims to current evidence and bound report size. The user-facing `goal-ledger.json` omits internal turn numbers, while `goal-ledger-state.json` retains continuation state. This distinction must survive replay without duplicating ledger/receipt producer effects.

`keepContext` protects every tagged line by removing it from planner-proposed deletion ranges after planning. Retained tags allow each later compaction to rediscover protection. Tool-result tags are inert. Structured stage output passes the schema directly to the final-answer tool and captures its arguments, rather than separate prose parsing, object-root restrictions, or sidecar validation.

## Scoring prefix and scheduling

`verification-prompts` uses `SHARED HEAD ‖ VARYING TAIL`. The byte-identical head contains task, ground-truth note, candidate bodies or supplied read paths, then scale anchors. Only criterion name/description and output instruction vary in the tail. Keep candidate-specific bodies in the shared head to preserve cached-prefix reuse.

`MAX_INLINE_CANDIDATE_BYTES` is `32 * 1024` UTF-8 bytes. Inline the entire family only when every body fits. Otherwise all candidates use caller-bound paths, preserving order and duplicates. An oversized pathless family is rejected.

`warm_first_fan_out` executes the first-seen step for each prefix before releasing remaining criteria/pair slots. Observe warm failures without fail-fast, attempt the remaining phase, then rethrow; successful results retain input order.

`classify_trend` uses `window=3`, `riseDelta=1.5`, and `fallDelta=-1.5`. Compare equal leading/trailing halves of the trailing two windows, dropping an odd middle sample. Inclusive crossings yield rising/regressing; short series are flat evidence. Scores average valid repeats on the anchored 1–20 scale. These are advisory signals, never alternate approval or termination conditions.

## Research rationale retained from the source notes

The former guide referred to a “reference scan” without an identifiable source citation. Preserve these figures as historical rationale, not independently verified measurements or shipped performance promises:

- Separate-criterion scoring reported 76.4% for the best single criterion and 78.3% for a three-criterion ensemble, attributed to §4.3.
- The unanimity rationale modeled false rejection as `1−(1−p)^K` and false acceptance as `(1−p)^K`; it motivated mean aggregation with an explicit disqualifying veto.
- The discrete-judge account reported 26.7% tied pairs at K=1. With slot swaps, K=1→16 moved 74.7% to 77.5%, with variance described as O(1/K).
- Pivot best-of-3 reported 86.5% ±1.1 against 79.4% pass@1 and a 92.1% oracle ceiling; best-of-5 reported 88.0% ±0.6 against 78.7% and a 96.6% ceiling.
- Self-verification gains were +7.1 and +9.3 for those respective comparisons.
- The account used K-sample averaging in place of unavailable token logprobs, at roughly 16× calls for K=16. One pivot and K=2 was a proposed cheap custom recipe, not a claim about all builtin defaults.

Recover the original research citation before using these numbers in external claims. More candidate diversity only helps when the selector is reliable.

## Live design helper protocol

A `user-feedback-N-start` stage starts review and prints its URL. Durable `live-poll-N-M` nodes poll the helper. Only `live-generate-*`, `live-steer-*`, `live-manual_edit_apply-*`, and `live-variant_mount_failed-*` events need model stages. `live-reply-N-M` acknowledges event ID then status. Successful `variant_mounted` events are journal-only; accept, discard, and prefetch create no model stage. Timeout stays inside the poll node. Nonzero helper exit fails the workflow; only `exit` ends the loop, without a summary stage.

Atomic uses its bundled Impeccable skill because `live-poll.mjs` arguments, reply IDs/statuses, and event vocabulary are versioned and tested with the workflow. Project-vendored copies are intentionally ignored; there is no model-driven fallback.

Impeccable 4.1.1 resolves the app root once and shares a persisted manifest across helpers. Adapters support SvelteKit, Nuxt, TanStack Start, Astro, Next.js, Vite, and static HTML. Configured/generated paths must stay project-relative inside the real root and outside symlinked parents. Invalid manifests fail before chdir/write; the browser helper accepts only loopback HTTP(S).

## Repository authoring examples

The repository's `.atomic/workflows/release-docs.ts` keeps its graph at the entry point and imports deterministic helpers from `.atomic/workflows/lib/release-docs.ts`. That support directory also holds the separate publish-release helper. This is a maintainer example, not a required user layout.

The `contract-complex-leaf` test workflow wraps permissive runtime schemas in `Type.Unsafe<ComplexPacket>(...)` and `Type.Unsafe<readonly ComplexRecord[]>(...)` to preserve static types. It illustrates the static/runtime tradeoff, not runtime validation of those shapes.
