# Provider routing, catalog refresh, and message serialization

Relocated from `packages/coding-agent/docs/models.md`, `models/reference.md`, `providers.md`, and `sdk/structured-decisions.md`. Configuration precedence, compatibility flags, limits, and operator recovery remain public. These notes explain implementation choices rather than defining additional supported provider APIs.

## Catalog refresh

pi.dev catalog caches persist the ETag and send `If-None-Match`. An empty `304 Not Modified` is successful revalidation: keep the cached body and update its check time. Freshness compares catalog data rather than trusting package file mtimes; newer bundled data beats an older persisted overlay. Preserve the last usable snapshot independently for each failed provider.

The terminal enforces its own 15-second selector deadline even when lower-level work rejects or ignores cancellation. In isolated sessions that deadline covers credential reload as well as catalog work. Closing a selector cancels refresh; expiry replaces `Refreshing model catalogs…` with cached-model timeout/error status. Credential generations prevent stale results from undoing login/logout.

Opening `/model` reloads the active agent directory's one `models.json`, then rebuilds provider definitions, overrides, dynamic catalogs, and isolated-engine state. No project `.atomic`/`.pi` layering or legacy agent-directory fallback is implied. Overrides retained at load time also apply when an extension registers the matching model later.

## Codex fast routing

Fast route metadata, not the suffix, final payload tier, or caller flag, selects first-party Codex routing. The ChatGPT endpoint uses `originator: codex_cli_rs` and `x-codex-routing-hint: model=<base-upstream-model>;tier=priority` over HTTP/SSE and WebSocket. Credential resolution preserves that identity only at the first-party endpoint. A renamed `openai-codex-responses` provider or proxy does not gain it.

Fallback, reconnect, and HTTP retry reuse the route identity. Switching normal/fast routes drops cached sockets before reuse. Standard OpenAI API calls send only the tier. Normal models retain `originator: pi` and no routing hint even when standalone callers set `serviceTier: priority`. The same rules cover `modelRuntime.stream()`, `complete()`, `streamSimple()`, and `completeSimple()`.

Atomic cannot enforce route-owned payload fields through extension-owned stream functions, including native registrations, and does not synthesize fast variants there. Exact provider/custom/extension IDs beat derived duplicates. Provider-owned Vercel `openai/gpt-6-astra-fast` remains an ordinary model with no `fastRoute`; generation consumes the live record rather than preserving a handwritten mirror after withdrawal.

## PDF transport

Anthropic documents PDF support on all active Claude models through vision. Atomic only advertises PDF on Anthropic Messages and Bedrock Converse, where document serialization exists. Other mirrors retain text/image and emit visible placeholders for unsupported documents. Both request builders hardcode PDF rather than deriving the format from media type, so reject anything other than `application/pdf` instead of mislabelling it. Bedrock citations are required for full visual PDF understanding; without them the provider extracts text.

## Preserved thinking

Anthropic signs `thinking` and `redacted_thinking` for model identity, and Fable 5.1 also binds them to `system`, `tools`, and every prior message. First-party API adjudication permits the originating model or newer models and drops unreadable blocks without billing. Replaying signed blocks unchanged preserves upward model-switch reasoning; the old conversion into visible assistant text both lost usable reasoning and destabilized later prefixes.

Fable 5.1 prefix mismatch returns 400 by default for organizations created on or after August 31, 2026. Send `thinking-binding-controls-2026-08-01` with `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` on every applicable request, including no-reasoning turns. The header alone leaves the error default. Record reported drops as `anthropic_input_transformations` diagnostics with counts, reasons, and paths.

Client `preserve_recent` compaction serializes retained tails into one boundary message rather than replaying signed structured assistant/tool messages. No signed thinking survives a boundary. This implements Anthropic's keep-tail remedy of retaining text/tool-use and dropping thinking through transcript structure, not a separate stripping pass. `drop_block` handles live prefix changes between boundaries, not compaction safety.

Fable 5.1 catalog generation includes published fallback targets Opus 4.8 and Opus 5. Mid-response decline emits a `fallback` block; retain its exact position and reattribute message usage to the serving model. On replay, drop the declining model's preceding thinking, redacted thinking, and unexecuted client tool calls. Preserve all visible text and everything after the marker. Missing/moved markers invalidate surrounding thinking. A turn without a boundary is unaffected.

Scope both capabilities to first-party `anthropic` on `anthropic-messages`, not API shape alone. Bedrock, Vertex, compatible proxies, opencode zen, Copilot, and Vercel mirrors do not inherit first-party signature handling. Custom transports can explicitly opt in using the documented compatibility flags.

## Structured decision transport

Jev uses `POST https://api.typesafe.ai/v1/systemone`, wire model `jev-latest`, Bearer authentication, shared state, and typed Choice questions. It is not an OpenAI chat-completion or arbitrary JSON-schema endpoint. Generic decisions are one-shot; routers permit an initial attempt plus three malformed/schema-invalid answer repairs within one deadline. Authentication/provider failure, cancellation, and stale-catalog rejection are not repaired.

Choices above 255 use stable batches, top-three retention by validated probabilities, original-order tie breaking, further shrinking rounds, and a final comparison. Never compare probabilities across batches. `retainForFinal` preserves one original abstention key without displacing batch winners. All original options participate; decode sees original keys only after all questions succeed. Grouping can change the winner and repeats unchanged state, affecting billed tokens and latency. Those behavioral limits remain in the public SDK guide.

Context packing estimates serialized JSON characters divided by four, not Jev tokenizer counts. Jev documents 32k for state plus longest question and 64k for state plus all questions. Estimates neither trim state nor reject indivisible context; send it once and fail on actual HTTP 422. Response bodies are bounded to 1 MiB. Probability/type/usage validation does not add a confidence threshold.
