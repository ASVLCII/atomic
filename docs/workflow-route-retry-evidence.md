# Workflow route retry investigation

## Outcome

The reported missing-retry defect was not reproduced on base `233b6def5`. The new public-tool tests pass without changing runtime code. A malformed Jev response causes another actual request, up to three retries after the initial request. No route result is returned while a request is pending. Four malformed responses produce the reported error, after four actual fetch invocations.

This is diagnostic and regression-test work, not a shipped behavior fix. No validator, retry budget, schema, renderer, user guide or changelog was changed. The user subsequently authorized this evidence-backed outcome rather than an invented fix.

## What `probability_mass` means

`packages/coding-agent/src/core/structured-output/jev.ts:69-82` validates each Choice separately. After checking matching option keys and finite probabilities in `[0, 1]`, it rejects a distribution when `abs(sum - 1) > 1e-6`. That is the exact trigger for `probability_mass`, not low confidence or disagreement between questions. The test deliberately returns a distribution summing to `0.5`.

Authoritative TypeSafe references, read on 2026-09-19 via [llms.txt](https://docs.typesafe.ai/llms.txt):

- [Choice response structure](https://docs.typesafe.ai/primitives/choice.md): `choice` is the highest-probability option; the full distribution includes every option and "The sum of all values is 1."
- [API Choice answer](https://docs.typesafe.ai/api.md): probabilities are "floats that sum to 1". The shown decimal examples satisfy this constraint.
- [JavaScript ChoiceResponse](https://docs.typesafe.ai/sdk/javascript/api/interfaces/ChoiceResponse.md): probabilities are numbers keyed by label. It does not specify a rounding allowance or require client normalization.
- [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md): warns against arithmetic identities between separate questions, including a Noul and its negation. It does not withdraw the within-Choice sum guarantee. Numeric-task limitations are not evidence that malformed Choice distributions are valid.
- [JavaScript RetryPolicy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy.md): defaults to two retries after the initial attempt for configured connection, timeout and HTTP errors, with backoff. This is distinct from malformed-output repair.

No explicit serialization precision, rounding tolerance or client renormalization contract was found in these references. They do not demonstrate that Atomic rejects valid responses. Weakening validation or normalizing missing mass would therefore be unsupported.

The historical responses, request IDs, per-attempt timings and exact running revision are unavailable. The reported outer tool calls, including a later successful manual repeat, do not establish internal request counts or the numeric cause of those historical failures. This investigation does not claim to reproduce the provider's original response or prove a provider defect.

For a future occurrence, collect the running revision, response model, per-attempt request IDs/timings and sanitized numeric distributions with neutral option labels. Preserve the original numeric precision. Do not attach authorization headers, keys, task text or sensitive option names. Those observations can distinguish rounding from substantial missing mass without exposing credentials.

## Retry layers and state transitions

History inspection (`git log -p -- packages/coding-agent/src/core/structured-output/index.ts`) identifies `9ae74fb0d05b807fa7a65352578138a070bd0aa9`, "fix(routing): repair invalid decisions within a shared deadline", as the existing repair implementation.

- `inferRouterDecision` passes three repairs to `inferDecision`. The initial attempt is index zero. Only `InvalidDecisionOutputError` enters the repair path. The attempts share one monotonic deadline and cancellation signal.
- Jev uses direct `fetch`, not the TypeSafe SDK. Chat structured inference sets `maxRetries: 0`. No outer public-tool retry loop is added. Generic structured inference remains one-shot.
- Pending inference transitions to another pending attempt after malformed output, to reservation after a valid named decision, or to failure after the fourth malformed response. Cancellation, timeout, nonretryable HTTP/transport errors and explicit limits terminate without spending the remaining repair allowance.
- The workflow tool awaits routing before `reservations.register`, then returns a reservation without launching. Failures return an empty execution ID. Cancellation rejects instead of converting to a failed route result. Running the empty ID is rejected.
- Overflow Choice tournaments can require multiple HTTP requests per logical decision attempt. The four-fetch assertions here use a registry fitting one request, not a universal four-HTTP-call cap for oversized candidate sets. Existing provider-contract tests cover overflow and wire limits.

## Acceptance and evidence

| Contract clause | Current-checkout evidence |
|---|---|
| Initial attempt plus up to three actual retries, no premature error | New `workflow-route-retries.test.ts` holds each fetch response separately and verifies the public result remains pending, with exact invocation counts |
| Recovery before exhaustion | Parameterized public-tool scenarios recover on fetch 2, 3 and 4 |
| Truthful final exhaustion | Fourth response is held pending; only after release does the test compare the entire historical JSON output character-for-character |
| Cancellation | Abort during the second request rejects with the original cancellation reason; late valid and invalid replies do not trigger another fetch or launch |
| No failed-attempt reservation or launch | Pending and terminal checks verify empty run store/jobs and uncalled workflow body; exhaustion returns empty ID and a run using it fails. Registration occurs only after routing succeeds in `workflow-tool.ts:173-187` |
| Preserve nonretryable errors, deadline, explicit budget/security and fail-closed behavior | Existing router repair, structured-output provider-contract and workflow-router suites pass; production code unchanged |
| Avoid nested provider budgets | Existing SDK retry suite passes; Jev direct fetch and chat `maxRetries: 0` retained |
| Diagnose probability semantics, precision and SDK policy | TypeSafe references and exact validator condition above; no demonstrated contract mismatch; historical numeric cause unknown |
| Preserve named interfaces, optional fields, duplicates, ordering and raw input | No public API edits; existing workflow-route-providers tests verify verbatim evidence, duplicate documents and optional/empty context |
| Use designated checkout/branch and preserve concurrent schema/render work | Only a new test file and this evidence note; no worktree, schema or render changes |
| Review actual history and relevant docs | Prior setup investigation read workflow/model/structured-decision docs; focused history and source checks above independently confirm existing policy |
| Deterministic durable evidence | New tests run through the public workflow tool, router and Jev adapter with controlled HTTP responses; not mocks of route decisions |
| User-facing docs and Unreleased fix entry | No shipped behavior changed; no actionable usage change or truthful fix entry warranted. User amendment permits diagnostic/test-only completion |
| Local commit, hooks, signature, attribution; no PR submission | Commit uses repository hooks, SSH signing and `Assistant-model: GPT-6-Astra`; commit ID and final clean status belong in the execution receipt |

Exact historical output retained in the test:

```json
{"action":"route","workflowType":"","workflowId":"","status":"failed","error":"Malformed Jev structured decision response (probability_mass). Routing output repair exhausted after 4 attempts."}
```

Validation on this checkout:

```sh
npx vitest --run --project unit test/unit/workflow-route-retries.test.ts test/unit/router-output-repair.test.ts test/unit/structured-output-routing.test.ts test/unit/structured-output-sdk-retries.test.ts test/unit/workflow-route-providers.test.ts test/unit/workflow-router.test.ts test/unit/structured-output-provider-contracts.test.ts test/unit/workflow-registered-run.test.ts
npm run check
qlty smells --include-tests test/unit/workflow-route-retries.test.ts
```

The focused suite passed 236 tests in 8 files, including six new tests. `npm run check` passed after scoped formatting of the new file. Qlty 0.642.0 checked one file with no smells; the unchanged route-provider baseline reported existing duplication. Qlty metrics parsed zero test files, so no metrics claim is made. Existing Qlty configuration was preserved. Initial Qlty invocations combining explicit paths with `--all` or `--upstream` were rejected; only the successful scoped smells check is quality evidence.

These are executable public-tool scenarios with deterministic transport fixtures, not live-provider, full-host TUI or cross-platform evidence. No UI implementation changed. Repository-wide unit/integration suites were not rerun for this test-only change. Initial dependency installation and build passed in the preceding setup investigation; this follow-up independently ran the checks above.

## Contract amendments received

- "reference https://docs.typesafe.ai/llms.txt to figure out what causes probability_mass, not only retry symptoms."
- The supervisor relayed user authorization for an evidence-backed diagnostic/test PR if no production defect is demonstrated: preserve diagnosis, do not invent missing retries or weaken validation, complete public-route tests and documentation-based investigation, disclose unavailable historical probabilities, and do not add a false shipped-fix changelog.

## Deferred

Historical numeric diagnosis needs a sanitized real response and runtime revision. No production defect is asserted. Unrelated setup-document release-age drift was observed in the preceding investigation and left untouched.
