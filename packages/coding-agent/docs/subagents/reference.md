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

Atomic supplies the task, agent name and description, available provider-qualified models, supported efforts, and the actual text of the model-selection and evaluation guides shipped with your installed version. The agent's system prompt is not attached as routing metadata; for a self-contained agent with no task, it remains the task fallback. Include requirements that should influence model selection in the task. You do not need to read or attach the guides yourself. The router uses task-relevant evidence and cost/latency tradeoffs, not an unconditional benchmark winner or maximum effort. Benchmark measurement effort does not prescribe execution effort.

The shared [`routerModel`](/settings#routermodel) setting chooses the model **making the decision**, not the child model. An explicit setting wins; otherwise Jev credentials saved through `/login typesafe-ai` or supplied by `TYPESAFE_AI_API_KEY` select Jev, then the current chat model is the fallback. Neither routing nor child fallback changes the parent chat model or the `structured_output` tool.

Routing makes one bounded logical decision: an initial attempt plus up to three repair retries for malformed or schema-invalid answers, all within the same 30-second deadline. A valid answer stops repairs. Jev compares large eligible sets through multiple tournament requests. The result is exactly `{ model, effort }`: an eligible provider/model ID and one supported effort, or `null` when the model has no configurable reasoning. A supported `"off"` is distinct from `null`. The available catalog reflects configured authentication, not proof of valid credentials, quota, or entitlement.

Missing shipped guides, no eligible candidates, unrepaired invalid model/effort pairs, changed availability, authentication/provider errors, timeout, and cancellation stop before the child starts. Input, provider, cancellation and stale-catalog failures are not repaired; no provider fallback or duplicate child launch occurs during routing. Correct the reported problem and retry explicitly, or select a concrete model. Jev includes every eligible pair in batches of at most 255, retains three per batch, and compares finalists within the shared deadline. No constraints or settings changes are needed merely to exceed 255 pairs. Tournaments and repairs can increase latency and usage, and grouping can affect the winner. Context remains unchanged; a provider context rejection still stops routing. See [structured decision limits](/sdk/structured-decisions#provider-behavior-and-limits).

After a valid decision, normal execution fallback handling applies. Fallbacks keep their own effort rather than inheriting the router's selected effort. Task metadata retains the original routing decision separately from the model and effort actually used after fallback. Choose a router provider permitted to receive the task and agent name/description, and do not put secrets in them.

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

Agents can define ordered `fallbackModels` for retryable provider or model failures such as rate limits, quota/usage-limit exhaustion (for example a provider reporting `The usage limit has been reached`, or `usage_limit_reached`/`insufficient_quota` codes), auth problems, unavailable models, network timeouts, or 5xx errors. Atomic tries the requested primary model first, then configured fallbacks, and finally appends the current user-selected model as the last fallback candidate when available. The main chat and workflow stages share one failure classifier, so auth, model-availability, request-incompatibility, and transport signals are handled consistently. Cancellations, safety refusals, and task/tool failures are never retried on another model.

A candidate that cannot serve the current request — for example an HTTP 400/413/422 bad/unprocessable/payload-too-large request, an unsupported tool or parameter, a context-length/context-window overflow, or a `too large` / `invalid_request` error — is treated as request/context incompatible and the fallback sequence advances to the next candidate rather than stopping. This means that if none of the configured candidates are applicable to the request, Atomic falls back to the currently selected user model instead of failing outright.

Model fallback decisions use structured provider and attempt causes. There is no per-attempt idle watchdog, no child wall-clock kill cap, and no timeout-regex classification: a quiet provider response is allowed to finish, and only an explicit termination or provider failure supplies a retryable cause. Numeric process exit codes are not used as an outcome discriminator.

For ordinary concrete-model calls, registry availability checks record a skipped model attempt when a known provider has no configured auth. Unknown/custom providers are still attempted, and the current user-selected model appended as the final fallback is not filtered out by this pre-admission check. Automatic routing additionally applies its eligible-model constraints to every fallback, including the current chat model.

Fallbacks do not retry ordinary task failures, validation failures, tool failures, cancellations, or workflow-code errors. Because a fallback may send the same prompt and context to a different provider, choose models that match your cost, privacy, and data-handling requirements.

Each candidate can also carry its own reasoning effort — see [Reasoning levels](#reasoning-levels).

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
