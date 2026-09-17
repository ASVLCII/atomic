---
title: Structured decisions
description: Make a bounded structured decision without starting an agent session.
---

# Structured decisions

Use `inferStructuredOutput()` from `@bastani/atomic` when an SDK integration needs one semantic decision before it performs an action. It returns a schema-validated value, the requested and responding model identities, and input/output token counts. It does not execute tools, start a session, or authorize an action.

`inferStructuredOutput()` takes an explicit inference model and never reads `routerModel`. The `structured_output` tool continues to use its session's model. Neither API changes the selected chat model. [Model-invoked workflow launches](/workflows/operations#model-invoked-launch-routing) and [subagent `model: "auto"`](/subagents/reference#automatic-model-selection) use the shared router entrypoint below.

## Select the inference model

For a general structured-output call, pass `model: { kind: "chat", fullId, model }` with a concrete model from the current registry, or `model: { kind: "jev", fullId: "typesafe-ai/jev" }`. Setting `routerModel` or exporting a TypeSafe key does not change this explicit selection.

`inferRouterDecision()` is the shared entrypoint for prerequisite model-invoked workflow and subagent-auto routing. Only this entrypoint consults `routerModel` in [settings.json](/settings#routermodel). It takes `settings`, `modelRegistry` and the invocation-time `currentModel` instead of an explicit inference `model`. Resolution is:

1. A nonempty explicit, exact `routerModel` value.
2. Otherwise `typesafe-ai/jev` when `TYPESAFE_AI_API_KEY` is nonempty.
3. Otherwise the chat model supplied as `currentModel` at invocation time.

An invalid explicit router selection fails instead of falling back. `auto`, model patterns, reasoning suffixes, and surrounding whitespace are not supported. Ordinary models must exist in the current configured catalog; their usual provider authentication applies. Catalog presence and an environment key do not prove live access, quota, or entitlement. The resolver never changes the chat model, the `structured_output` tool's model or saved defaults.

Extension tools can read the owning session's current routing setting with `ctx.getRouterModel()`. Pass `settings: { getRouterModel: () => ctx.getRouterModel() }`, `modelRegistry: ctx.modelRegistry` and `currentModel: ctx.model` to `inferRouterDecision()`. This preserves in-memory settings and project-trust behavior instead of loading a separate settings instance.

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

Ordinary models receive one `structured_output` result tool with the supplied schema. Atomic uses provider-aware serialization, requests strict sampling where supported, and validates the returned arguments without coercing values or removing extra fields. Use `additionalProperties: false` for closed objects. Providers without strict sampling must still return valid arguments. `toolChoice: "auto"` also supports models that reject forced tool use. A prose-only response, extra tool call, truncated response or invalid result fails without a repair prompt.

Ordinary requests set `maxRetries: 0`, use HTTP/SSE rather than WebSocket transport fallback, and disable configured Anthropic server-side fallbacks for this request only. Custom provider implementations must honor these options and must not introduce their own inference retries or fallback requests.

[TypeSafe Jev](/providers#typesafe-jev) accepts shared state and typed questions instead of JSON-schema generation. Atomic sends all questions in one direct HTTP request without automatic retries. Question IDs are correlation keys, not instructions seen by Jev, so put complete semantics in each question's `instructions`. Describe the speculative premise of a conditional question and consume its answer only when that premise applies.

Jev accepts at most 255 options per Choice. Atomic rejects larger sets before dispatch; it never truncates candidates or adds a shortlist request. Select an ordinary inference model when the complete set exceeds this limit, using `routerModel` for prerequisite routing or the explicit `model` argument for general SDK calls. Jev response bodies are limited to 1 MiB. Atomic validates answer types, choices, probability distributions and usage, but does not impose a confidence threshold or treat ordinary-model confidence as calibrated.

## Cancellation and failures

The default deadline is 30 seconds, covering authentication, transport and response reading. `timeoutMs` must be a positive integer no greater than 2147483647; zero does not disable it. Ordinary output is bounded by `maxTokens`, default 4096. Pass an `AbortSignal` to cancel. Cancellation or timeout rejects the call, and late responses cannot produce an accepted result or invoke the Jev mapper.

No result is returned for missing state, invalid configuration, malformed output or provider failure. Keep action admission after the awaited result and check cancellation again at that boundary. Fix configuration or context before making a new explicit attempt. There are no semantic repairs, provider probes, recursive agents or hidden fallback inferences.

Provider dispatch and response-reading failures return generic diagnostics rather than raw upstream errors, which may contain private input or credentials. Check provider configuration and connectivity before an explicit retry. Cancellation and timeout remain distinct errors.

For Jev, HTTP 401 means check `TYPESAFE_AI_API_KEY`; 422 means check the state/question contract; 429 and 529 mean wait before an explicit retry. Error messages omit upstream response bodies because they may echo private input.
