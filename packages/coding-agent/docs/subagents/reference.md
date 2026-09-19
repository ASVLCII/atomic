---
title: Subagent reference
description: Fallback model resolution and reasoning-level contracts.
---

# Subagent reference

## Automatic model selection

Set `model: "auto"` to choose a concrete model and supported reasoning effort for a task before the child starts:

```ts
subagent({
  agent: "worker",
  task: "Implement the approved fix and run its focused regression tests.",
  model: "auto",
});
```

The same value works on individual parallel tasks and in an agent definition's `model` field. A concrete call override wins over an agent's `auto` default. Omitting `model` keeps normal inheritance; it routes only when the effective agent model is `auto`. Each parallel task receives its own decision.

Workflow stages also support [prompt-based `model: "auto"`](/workflows/authoring#automatic-stage-model-selection), using the same decision provider and evaluation guidance. Stage model selection is separate from choosing which workflow to launch.

Put requirements that should influence model selection in the task. Atomic supplies the task, agent name and description, available provider-qualified models, supported efforts, and the model-selection and evaluation guides shipped with your installed version. You do not need to attach the guides yourself.

The agent's system prompt is not routing metadata. For a self-contained agent with no task, it remains the task fallback. The router weighs task-relevant evidence, cost, and latency rather than always choosing a benchmark winner or maximum effort. Benchmark measurement effort does not prescribe execution effort.

The shared [`routerModel`](/settings#routermodel) setting chooses the model making the decision, not the child model. Selection follows this order:

1. An explicit setting.
2. Jev, when credentials are saved through `/login typesafe-ai` or supplied by `TYPESAFE_API_KEY`.
3. The current chat model.

Neither routing nor child fallback changes the parent chat model or the `structured_output` tool.

Routing has one 30-second deadline for an initial attempt and up to three repair retries for malformed or schema-invalid answers. A valid answer stops repairs. The result is exactly `{ model, effort }`: an eligible provider/model ID and one supported effort, or `null` for a model with no configurable reasoning. A supported `"off"` is distinct from `null`. The catalog reflects configured authentication, not proof of valid credentials, quota, or entitlement.

The child does not start if guides are missing, no candidates are eligible, model/effort pairs remain invalid, availability changes, or authentication/provider errors, timeout, or cancellation occur. Input, provider, cancellation, and stale-catalog failures are not repaired. Routing never falls back to another provider or launches a duplicate child. Correct the reported problem and retry explicitly, or select a concrete model.

For large eligible sets, Jev uses tournament requests within the same deadline. Every eligible pair enters a batch of at most 255; three per batch reach the finalist comparison. Exceeding 255 pairs needs no constraints or settings changes. Tournaments and repairs can increase latency and usage, and grouping can affect the winner. Context is unchanged, so a provider context rejection still stops routing. See [structured decision limits](/sdk/structured-decisions#provider-behavior-and-limits).

After selection, normal execution fallback applies. Each fallback keeps its own effort, not the router's selected effort. Metadata records the original decision separately from the model and effort actually used.

Choose a router provider permitted to receive the task and agent name/description. Do not put secrets in them.

### Hard model constraints

For automatic routing, optional `modelConstraints` on a call, parallel task, or agent definition restricts eligible choices and execution fallbacks. All applicable restrictions must hold; a call cannot widen an agent's restrictions. Omit this object to use the full available catalog.

| Field | Meaning |
| --- | --- |
| `allowedModels` | Exact provider/model IDs permitted to receive the task |
| `maxInputCost`, `maxOutputCost` | Maximum catalog price in USD per million input or output tokens, not a total spending cap |
| `minContextWindow` | Minimum advertised context window in tokens |
| `requiredInputs` | Required input types, `"text"` or `"image"` |
| `allowedEfforts` | Permitted supported effort values, including `null` for non-reasoning models |

Unknown keys and invalid limits fail validation. An empty eligible set stops the launch. These constraints do not turn a concrete model call into an automatic one. The catalog does not establish a latency SLA or a provider's privacy guarantees. Express hard provider restrictions through `allowedModels`; describe softer preferences in the task.

## Fallback models

Define ordered `fallbackModels` to recover from retryable provider or model failures. Atomic tries:

1. The requested primary model.
2. Configured fallbacks, in order.
3. The current user-selected model, appended when available.

Retryable causes include rate limits, quota/usage-limit exhaustion, auth problems, unavailable models, network timeouts, and 5xx errors. Quota signals include `The usage limit has been reached`, `usage_limit_reached`, and `insufficient_quota`. Main chat and workflow stages share one classifier for auth, model availability, request incompatibility, and transport failures.

A request-incompatible candidate also advances the sequence. Examples include HTTP 400/413/422 bad, unprocessable, or payload-too-large requests; unsupported tools or parameters; context-length/context-window overflow; and `too large` / `invalid_request` errors. The chain can therefore reach the current user-selected model when no configured candidate can serve the request.

Fallback does not retry safety refusals, ordinary task or tool failures, validation failures, cancellations, or workflow-code errors.

Decisions use structured provider and attempt causes, not numeric process exit codes or timeout-regex classification. There is no per-attempt idle watchdog or child wall-clock kill cap. A quiet provider response can finish; only an explicit termination or provider failure supplies a retryable cause.

For concrete-model calls, a known provider without configured auth is recorded as a skipped attempt. Unknown/custom providers are still attempted, and this pre-admission check never filters out the final current user-selected model. Automatic routing additionally applies its eligible-model constraints to every fallback, including that model.

A fallback may send the same prompt and context to a different provider. Choose models that meet your cost, privacy, and data-handling requirements. Each candidate can carry its own [reasoning effort](#reasoning-levels).

## Reasoning levels

Set the reasoning (thinking) effort for each model candidate with a `model_name:thinking_effort` suffix on `model` and on every `fallbackModels` entry. Valid efforts are `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max` — the same shorthand used by `atomic --model sonnet:high`. `xhigh` and `max` are used only when the selected model's capability map supports them.

```markdown
---
name: deep-reviewer
description: Adversarial reviewer for risky diffs
tools: read, search, bash
model: anthropic/claude-sonnet-4:high
fallbackModels: openai/gpt-5:medium, anthropic/claude-haiku-4-5:off
---
```

Because the effort travels with each model string, every primary and fallback candidate is self-contained: a fallback can run at a different effort than the primary, so a high-effort primary degrades gracefully to a cheaper, lower-effort fallback.

**Migrate off the legacy `thinking` field.** The separate `thinking:` frontmatter field is deprecated. It still works as a default for any candidate that has no suffix, and a suffix always wins, but new agents should encode the effort directly on `model` and `fallbackModels`:

```diff
-model: openai/gpt-5.5
-fallbackModels: anthropic/claude-opus-4-8
-thinking: xhigh
+model: openai/gpt-5.5:xhigh
+fallbackModels: anthropic/claude-opus-4-8:xhigh
```

`fallbackThinkingLevels` exists only as an optional compatibility helper: it is aligned by index to `fallbackModels` and supplies a fallback candidate's effort only when that fallback entry has no suffix. Prefer suffixed model strings instead. Attempt metadata reports the resolved model and the effective reasoning effort used for each attempt.

## Owner-bound task projection

Host adapters can construct an `OwnerTaskStore` from their existing supervisor and owner lease, check the `store.connect()` result, then call `bindOwnerTaskStore(session, store)` for that exact live session. Binding does not create or connect an owner. The store observes snapshot/cursor reconciliation and notifies already-mounted chats even when the producer binds lazily. Disposing the view does not cancel the owner. Reattachment uses existing identities rather than replaying launch tools.

Native task snapshots retain `wasBackground` once a designated observation yields, so a fresh projection can distinguish completed background work from foreground-only commands. Trusted hosts recover authentic command settlement receipts independently of the bounded event journal. Neither recovery path registers a new wait or restarts execution.

Main and workflow-stage chats use below-prompt background counts instead of persistent task rows in the transcript. Session replacement clears the previous owner's status before a replacement store binds. A workflow question retains the background count below its input area. Completion notifications use the same shared renderer in both chats.

Custom `ChatSessionHost` adapters can still use live task rows; set `taskRowsInChat: false` for footer-only status. Those rows show agent labels, state, duration, and bounded activity previews. Display-colliding labels get a stable short suffix derived from the task ID. Retention is at most 64 reports and 8 KiB of encoded preview records per task; omitted previews are labelled rather than presented as a complete transcript.

This is a host integration API above the SDK task foundation. Existing subagent and command producers are not automatically migrated by binding a projection. Full task transcript retrieval and `/tasks` navigation are separate integrations; unavailable transcript content is not inferred from activity reports.
