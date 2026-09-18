---
title: Structured decisions
description: Make a bounded structured decision without starting an agent session.
---

# Structured decisions

Use `inferStructuredOutput()` from `@bastani/atomic` when an SDK integration needs one semantic decision before it performs an action. It returns a schema-validated value, the requested and responding model identities, and input/output token counts. It does not execute tools, start a session, or authorize an action.

`inferStructuredOutput()` takes an explicit inference model and never reads `routerModel`. The `structured_output` tool continues to use its session's model. Neither API changes the selected chat model. [Model-invoked workflow launches](/workflows/operations#model-invoked-launch-routing) and [subagent `model: "auto"`](/subagents/reference#automatic-model-selection) use the shared router entrypoint below.

## Select the inference model

For a general structured-output call, pass `model: { kind: "chat", fullId, model }` with a concrete model from the current registry, or `model: { kind: "jev", fullId: "typesafe-ai/jev" }`. Setting `routerModel` or exporting a TypeSafe key does not change this explicit selection.

`inferRouterDecision()` is the shared entrypoint for prerequisite workflow selection and automatic subagent/workflow-stage model selection. Only this entrypoint consults `routerModel` in [settings.json](/settings#routermodel). It takes `settings`, `modelRegistry` and the invocation-time `currentModel` instead of an explicit inference `model`. Resolution is:

1. A nonempty explicit, exact `routerModel` value.
2. Otherwise `typesafe-ai/jev` when Jev credentials are configured through `/login typesafe-ai` or `TYPESAFE_AI_API_KEY`.
3. Otherwise the chat model supplied as `currentModel` at invocation time.

An invalid explicit router selection fails instead of falling back. `auto`, model patterns, reasoning suffixes, and surrounding whitespace are not supported. Ordinary models must exist in the current configured catalog; their usual provider authentication applies. Catalog presence and an environment key do not prove live access, quota, or entitlement. The resolver never changes the chat model, the `structured_output` tool's model or saved defaults.

Extension tools can read the owning session's current routing setting with `ctx.getRouterModel()`. Pass `settings: { getRouterModel: () => ctx.getRouterModel() }`, `modelRegistry: ctx.modelRegistry` and `currentModel: ctx.model` to `inferRouterDecision()`. This preserves in-memory settings and project-trust behavior instead of loading a separate settings instance.

Pass the full `ModelRegistry` to use saved Jev credentials with either decision API. Its provider-auth methods preserve normal credential resolution and logout behavior. Minimal custom adapters that omit `getProviderAuth` and `getProviderAuthStatus` retain environment-only Jev support. Never copy a resolved key into decision state.

### Router repair attempts

`inferRouterDecision()` allows an initial attempt plus **up to three repair retries** when an answer is malformed or fails the decision schema. This applies to ordinary models and Jev, with all attempts sharing the same deadline (30 seconds by default), state, candidates, and selected provider. A valid answer stops retries immediately; a valid `none` is not retried. Repairs may increase latency and provider usage, but never start a workflow or child before final validation.

Input/configuration errors, authentication or provider failures, cancellation, timeout, and stale-catalog rejection are not repaired. There is no provider fallback or retry of an admitted action. Generic `inferStructuredOutput()` remains one-shot; it does not gain router repairs.

## Prepare a decision

Supply both the ordinary result schema and Jev Choice questions so either provider path can serve the same request. Instructions describe the judgment. Named `state` fields contain the actual task, relevant conversation, explicit constraints, reference text and complete candidate identities. Paths and URLs may identify a source, but do not replace its content. Exclude secrets before building state.

```typescript
import { Type } from "typebox";
import {
  inferStructuredOutput,
  ModelRegistry,
  ModelRuntime,
  type StructuredOutputModel,
} from "@bastani/atomic";

const modelRuntime = await ModelRuntime.create();
const modelRegistry = new ModelRegistry(modelRuntime);
const model = modelRegistry.getAvailable()[0];
if (!model) throw new Error("Choose a configured chat model before making this request.");
const inferenceModel: StructuredOutputModel = {
  kind: "chat", fullId: `${model.provider}/${model.id}`, model,
};

const schema = Type.Object(
  { category: Type.Union([Type.Literal("question"), Type.Literal("none")]) },
  { additionalProperties: false },
);
const result = await inferStructuredOutput({
  model: inferenceModel,
  modelRegistry,
  schema,
  instructions: "Classify whether the task asks a question. Use none for other tasks.",
  state: {
    task: "What does the timeout setting mean?",
    constraints: { permittedAction: "classify only" },
    reference: { text: "A question requests an explanation or information." },
    candidates: ["question", "none"],
  },
  jev: {
    questions: {
      category: {
        instructions: "Does the task request information or an explanation?",
        criteria: {
          question: "Requests information or an explanation",
          none: "Does not request information or an explanation",
        },
      },
    },
    decode: (choices) => ({
      category: choices.category === "question" ? "question" : "none",
    } as const),
  },
  timeoutMs: 30_000,
  maxTokens: 4096,
});
console.log(result.value.category);
```

Keep `decode` synchronous and side-effect-free. It maps validated Choice keys to exact canonical values. Do not perform inference, authorization, file writes, or launches there. Validate current policy and candidate availability again before any later action. A valid shape is not proof that the judgment is correct.

For runtime catalogs, build schema, state and Choice candidates from the same snapshot. Use one Choice per coherent judgment. Encode a model and its supported reasoning effort as one valid-pair candidate, never independent choices. Encode exact numeric limits as finite candidates and map them back without rounding. Preserve zero and omitted fields distinctly. Include a no-match outcome when applicable and handle name collisions explicitly.

## Provider behavior and limits

Ordinary models receive one `structured_output` result tool with the supplied schema. Atomic uses provider-aware serialization, requests strict sampling where supported, and validates the returned arguments without coercing values or removing extra fields. Use `additionalProperties: false` for closed objects. Providers without strict sampling must still return valid arguments. `toolChoice: "auto"` also supports models that reject forced tool use. A prose-only response, extra tool call, truncated response or invalid result fails a generic `inferStructuredOutput()` call without a repair prompt; router calls can use the bounded repairs described above.

Ordinary requests set `maxRetries: 0`, use HTTP/SSE rather than WebSocket transport fallback, and disable configured Anthropic server-side fallbacks for this request only. Custom provider implementations must honor these options and must not introduce their own inference retries or fallback requests.

[TypeSafe Jev](/providers#typesafe-jev) accepts shared state and typed questions instead of JSON-schema generation. Atomic packs independent questions together. Generic `inferStructuredOutput()` calls have no automatic retries; router calls can repair malformed or schema-invalid answers within their shared deadline. Question IDs are correlation keys, not instructions seen by Jev, so put complete semantics in each question's `instructions`. Describe the speculative premise of a conditional question and consume its answer only when that premise applies.

Choices with up to 255 options keep their normal single comparison. Larger choices use a bounded tournament: every original option participates in stable batches of at most 255; each batch retains its top three by validated probabilities, with ties resolved by original order. Further shrinking rounds precede a final shared comparison. Probabilities are never compared across batches. Multiple named questions can mix small choices and tournaments; `decode` receives original option keys only after all judgments succeed. Empty choices fail; singletons still go to the provider.

For an abstention option that must remain available, set the question's optional `retainForFinal` to one original option key. It participates normally and is also retained for the final comparison if eliminated; it does not replace any batch's top three. Workflow routing uses this for `none`.

Overflow requires multiple HTTP requests and can increase latency and billed input tokens because each request repeats the unchanged state. Returned usage sums all successful requests; `responseModel` identifies the last response. Grouping can change the winner: this tournament does not guarantee the result of an unlimited flat Choice or a globally optimal selection.

Jev documents 32k tokens for state plus the longest question and 64k for state plus all questions. Atomic uses an estimate of serialized JSON characters divided by four to pack questions and overflowing candidate batches. This is not a matching tokenizer or a guaranteed fit: actual provider limits remain authoritative. Atomic never trims state, rejects solely on the estimate, or retries a rejected request. Indivisible oversized context is sent once; an HTTP 422 stops the operation. If context is rejected, supply appropriate concise context explicitly or choose an ordinary inference model with suitable context capacity. Jev response bodies are limited to 1 MiB per request. Atomic validates answer types, choices, probability distributions and usage, without imposing a confidence threshold.

## Cancellation and failures

The default deadline is 30 seconds for the entire decision, including all router repair attempts, tournament rounds, authentication, transport and response reading. `timeoutMs` must be a positive integer no greater than 2147483647; zero does not disable it. Ordinary output is bounded by `maxTokens`, default 4096. Pass an `AbortSignal` to cancel. Cancellation or timeout rejects the whole call immediately; a failed batch yields no partial decision, and late responses cannot invoke the Jev mapper.

No result is returned for missing state, invalid configuration, unrepaired malformed output or provider failure. Keep action admission after the awaited result and check cancellation again at that boundary. Fix configuration or context before making a new explicit attempt. Only router calls have bounded invalid-output repairs; neither API runs recursive agents, provider probes or hidden fallback inferences.

Provider dispatch and response-reading failures return generic diagnostics rather than raw upstream errors, which may contain private input or credentials. Check provider configuration and connectivity before an explicit retry. Cancellation and timeout remain distinct errors.

For Jev, HTTP 401 means check `/login typesafe-ai` or `TYPESAFE_AI_API_KEY`; 422 means check the state/question contract; 429 and 529 mean wait before an explicit retry. Error messages omit upstream response bodies because they may echo private input.

Malformed Jev response errors include a static diagnostic code, without response values or routing context. For example, `probability_mass` means the returned probabilities failed the sum-to-one tolerance, `probability_keys` means the options did not match, and `choice_not_highest` means the selected option was not highest-probability. Include the code when reporting a failure. Router calls may repair these errors before returning a final failure; generic calls fail immediately. No invalid decision is accepted.
