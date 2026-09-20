# RPC transport implementation notes

Relocated from `packages/coding-agent/docs/rpc/protocol.md` under `set_thinking_level`, `bash`, and `message_update`. Public request/response examples, correlation, event ordering, and client actions remain in the protocol guide.

## Thinking acknowledgement ordering

Isolated persistence reads the effective level and provider/model target through an internal client path, while public `RpcClient.setThinkingLevel(level)` remains a one-argument `Promise<void>`. Persist against the ACK target, not the host's model at callback time. Later `model_changed` must not re-key the override, and later `thinking_level_changed` must remain effective even when an older ACK settles afterward.

## Bash context conversion

Direct RPC Bash returns `BashResult` immediately on completion and appends exactly one `BashExecutionMessage` to the initiating session, even if replacement completed while the command ran. The stored message has no event of its own. On the next prompt, context conversion maps it to a user message with the “Ran command” text and fenced output shown in the public protocol example. Multiple commands contribute context to that initiating session's next prompt, not the replacement session.

## Delta-only assistant updates

`message_update` intentionally omits cumulative message snapshots and `assistantMessageEvent.partial`. Repeating the full snapshot on each frame would make bytes per turn grow quadratically with turn length. Clients reconstruct from start/deltas/end; final message is authoritative. The cumulative usage field remains independent and can stay zero until a provider reports final usage. Only explicit provider end-turn signals produce the optional top-level `endTurn`.
