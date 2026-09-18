---
title: "SDK"
description: "Embed Atomic in a Node.js application."
---

> Atomic can help you use the SDK. Ask it to build an integration for your use case.

# SDK

The SDK provides programmatic access to atomic's agent capabilities. Use it to embed atomic in other applications, build custom interfaces, or integrate with automated workflows.

**Example use cases:**
- Build a custom UI (web, desktop, mobile)
- Integrate agent capabilities into existing applications
- Create automated pipelines with agent reasoning
- Build custom tools that spawn sub-agents
- Test agent behavior programmatically

See [examples/sdk/](https://github.com/bastani-inc/atomic/tree/main/packages/coding-agent/examples/sdk) for working examples from minimal to full control.

## On this page and its reference

This page covers the SDK quick start, its core concepts, and one complete example. Options, resource loaders, return types, run modes, and exports live in the [SDK API reference](/sdk/reference).

For a custom host that runs background work, see [Owner-bound task supervisor](/sdk/reference#owner-bound-task-supervisor-s1), [Supervised command SDK](/sdk/reference#supervised-command-sdk), and [Task transcript references](/sdk/reference#task-transcript-references).

Not sure the SDK is the right integration mode? Compare it with RPC and JSON mode on [Programmatic use](/programmatic).

## Quick Start

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@bastani/atomic";

const modelRuntime = await ModelRuntime.create();

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

`ModelRuntime` is the canonical asynchronous provider runtime when an integration wants provider-owned credentials, dynamic catalogs, and native providers in one object:

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@bastani/atomic";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});
```

`ModelRuntime.create()` accepts custom `authPath`, `modelsPath`, credential storage, and runtime auth overrides, plus the model-catalog options `allowModelNetwork`, `modelRefreshTimeoutMs`, `modelsStorePath`, and `modelsStore` (see [Model catalog persistence and refresh](/sdk/reference#model-catalog-persistence-and-refresh)). `ModelRegistry` and `AuthStorage` remain available as Atomic's synchronous compatibility facades. Use `readStoredCredential(provider, authPath?)` for a lightweight read of one stored provider credential.

Extensions supplied directly to SDK sessions can use the exported `InlineExtension` type. Extension APIs and event types include native `registerProvider(Provider)`, `registerEntryRenderer`, `entry_appended`, `before_provider_headers`, and `agent_settled`.

The package root also exports `buildContextEntries`, `sessionEntryToContextMessages`, and `CompactionEntry` for converting durable session branches into model context. The equivalent active-session operation is `sessionManager.buildContextEntries()`.

## Installation

Install `@bastani/atomic` as a project dependency with npm, pnpm, or Bun:

With npm:

```bash
npm install @bastani/atomic
```

With pnpm:

```bash
pnpm add @bastani/atomic
```

With Bun:

```bash
bun add @bastani/atomic
```

Atomic does not require package install scripts. If you want to disable dependency lifecycle scripts during the Atomic install, you can add `--ignore-scripts` to the install command.

The SDK is included in the main package. No separate SDK package is needed.

## Pi client

`@bastani/atomic/client` re-exports `@earendil-works/pi-client`. Pi 0.85 replaced the experimental `RemoteSession` lease API with its service-addressed Chord client; use the upstream client and agent service APIs for remote sessions.

## Experimental remote sessions

Use [Pi client](#pi-client) for the current remote-session API.

## Experimental Harness factory

For the current supported integration, start with [createAgentSession()](#createagentsession) and the [SDK API reference](/sdk/reference).

## Core Concepts

### createAgentSession()

The main factory function for a single `AgentSession`.

`createAgentSession()` includes Atomic's shipped workflows, subagents, MCP, web access and Intercom, plus their bundled resources. It uses normal user, project and configured-package discovery when no `resourceLoader` is supplied. A custom loader supplies your resources; the factory adds shipped builtins without changing the loader's options. Services still need their existing configuration and credentials.

Use `builtins: { "web-access": false, intercom: false }` to disable specific shipped packages and their resources. Omitted keys remain enabled, including with `builtins: {}`. Tool selection is separate: `tools: []` and `noTools: "all"` expose no tools, including Intercom; `noTools: "all"` also overrides a nonempty allowlist. `excludedTools` wins over selection. Suppression survives reload. See [tool precedence](/sdk/reference#tools) for `defaultTools` and `noTools: "builtin"`.

Creation finishes extension startup before returning. Pass `extensionBindings` when startup hooks need your host bindings. Later `session.bindExtensions(...)` updates those bindings without replaying `session_start`; reload starts a new extension generation. Missing shipped assets reject with an error whose `code` is `BuiltinUnavailable` and whose message names the package. Reinstall the package rather than continuing with a partially available session.

```typescript
import { createAgentSession, SessionManager } from "@bastani/atomic";

// Minimal: defaults with DefaultResourceLoader
const { session } = await createAgentSession();

// Custom: override specific options
const { session } = await createAgentSession({
  model: myModel,
  tools: ["read", "bash"],
  // Or keep defaults and remove specific tools:
  // excludedTools: ["ask_user_question"],
  sessionManager: SessionManager.inMemory(),
});
```

### Human input without a terminal

Pass `extensionBindings.humanInput` to answer extension dialogs and `ask_user_question` in a Node host. `HostInput` requires all five methods: `confirm`, `select`, `input`, `editor` and `questionnaire`. `QuestionParams` and `QuestionnaireResult` are exported from `@bastani/atomic`; questionnaire answers retain their question indices, answer kinds, selections, previews and notes.

Each callback receives a `HostInputOptions` argument with a runtime-generated `requestId`, the originating `sessionId`, and an `AbortSignal`. Stop presenting the question when the signal aborts. Return an actual boolean from `confirm`, a supplied choice or `undefined` from `select`, and a string or `undefined` from text dialogs. Empty strings, whitespace and choice order are preserved. Malformed replies reject with `InvalidHostInput`; false, cancellation and rejected callbacks never approve an action.

```typescript
import { createAgentSession, type HostInput } from "@bastani/atomic";

async function attachApplication(humanInput: HostInput) {
  const { session } = await createAgentSession({
    extensionBindings: {
      humanInput,
      onDiagnostic: ({ level, source, message, sessionId }) => {
        console.log({ level, source, message, sessionId });
      },
    },
  });

  // Cancel current work and any outstanding ordinary questions.
  await session.abort();
  // Withdraw input while keeping the session available for noninteractive work.
  await session.bindExtensions({ humanInput: null });
  // Reattach the application's callbacks when it is ready to answer again.
  await session.bindExtensions({ humanInput });
  return session;
}
```

At creation, omitted `humanInput` means no input unless `uiContext` supplies a dialog bridge. Explicit callbacks take precedence over that bridge. On later binding, omission preserves the adapter; `null` withdraws it and cancels pending ordinary questions. Rebinding does not repeat startup hooks. Abort, reload and disposal invalidate pending replies, including late successful replies from callbacks that ignore cancellation.

Extension authors should check `ctx.hasHumanInput` for questions and `ctx.hasUI` for rendering. Existing `ctx.ui.confirm/select/input/editor` calls use the host adapter. Dialog timeouts cancel requests. Without an adapter, ordinary dialogs reject with `HumanInputUnavailable`; `ask_user_question` retains its compatible `{ answers: [], cancelled: true, error: "no_ui" }` details. `ui.custom` still needs a presentation host and is not part of `HostInput`.

Workflow input uses these same callbacks, including stage questionnaires and nested workflows. Requests include `workflowRunId` and `workflowStageId`; use them with `requestId` to associate your application's question with the correct run. Keep the workflow definition unchanged when switching hosts: author semantic `ctx.ui` calls, not terminal-specific branches.

A durable workflow approval stays pending when input is unavailable, cancelled or invalid. Withdrawing the adapter does not approve it or discard the run. Bind a new adapter to present a live pending request again; it receives a fresh request ID, and late answers to the withdrawn request cannot authorize work. To continue a saved run in another session, keep its definition and durable storage available, bind the new host, and use the existing `/workflow resume <run-id>` command or workflow tool's `resume` action. Rebinding alone does not reopen a saved run. See [workflow operations](/workflows/operations) for inspection, graceful quit and resume.

This also applies when no adapter was bound at creation: normal workflow launch preserves the required gate and returns its run identity. Inspect workflow status, then bind an authorized host or submit a validated answer. Headless CLI launches use the same execution defaults; they skip input pickers and do not wait for terminal completion. Explicit runtime execution restrictions remain enforced.

Only an actual `true` confirms a primitive approval. Questionnaire readiness keeps its existing choices: staying on the stage does not advance it. Missing input never bypasses an approval or exhausted budget; obtain approval before explicitly resuming with a raised budget.

`onDiagnostic` receives session-attributed operational diagnostics. Existing errors and tool results remain available without a callback. Third-party extensions can still write directly to the console; the callback does not intercept their output.

### Workflow and subagent children

Children use the invoking session's model/auth runtime, settings, agent directory, human-input callbacks and diagnostic sink. A child model or fallback choice does not switch to global credentials. Explicit child `cwd` wins, then a supplied child `sessionManager.getCwd()`, then the invoking session's directory. Relative child working directories resolve from the invoking session, without changing the process working directory.

Omitted or `undefined` child options retain inherited configuration, including individual builtin flags and host bindings. Use `humanInput: null` to withdraw input explicitly; empty arrays and other explicit values keep their normal meanings, subject to the parent's capability ceiling.

Child tool selections can narrow the parent's selection, not expand it. Disabled builtin packages, excluded tools, empty allowlists and `noTools: "all"` remain suppressed in children and fallback attempts. Enable a needed capability on the parent before launching a child. Workflow stages and subagents still exclude recursive workflow tooling; subagents retain the single-level delegation limit.

Callbacks may be shared, but request and diagnostic `sessionId` values identify the originating child. Workflow questions also carry their run/stage identity. Group overrides retain the normal Intercom authorization rules. Disabling or excluding Intercom does not create a substitute supervisor grant. Reopening conversation history does not restore child authority.

An explicit child `extensionBindings.humanInput` overrides the inherited host, including for durable stage questionnaires. Setting it to `null` leaves those questions pending; rebinding the parent cannot answer on that child's behalf. Rebind the child to an authorized adapter to continue. Without a child override, pending stage questions follow parent host withdrawal and reattachment.

You may reuse the same adapter object when explicitly rebinding a child, even after the parent switches hosts. That child selection survives reload. An empty binding object does not select a new host or restore inheritance.

The inherited `isFallbackModelAllowed` predicate also applies when a workflow replaces its stage session to try a fallback. A rejected candidate is not executed. This predicate restricts fallback choices, not an explicitly selected primary model.

### AgentSession

The session manages agent lifecycle, message history, model state, compaction, and event streaming.

```typescript
interface AgentSession {
  // Send a prompt and wait for completion
  prompt(text: string, options?: PromptOptions): Promise<void>;

  // Queue messages during streaming
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;

  // Controlled queue-pause gate
  readonly queuedMessagesPaused: boolean;
  pauseQueuedMessages(): void;
  resumeQueuedMessages(): Promise<boolean>;

  // Subscribe to events (returns unsubscribe function)
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;

  // Session info
  sessionFile: string | undefined;
  sessionId: string;

  // Model and thinking control
  setModel(model: Model): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  cycleModel(): Promise<ModelCycleResult | undefined>;
  cycleThinkingLevel(): ThinkingLevel | undefined;

  // State access
  agent: Agent;
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;

  // In-place tree navigation within the current session file
  navigateTree(targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }): Promise<{ editorText?: string; cancelled: boolean; aborted?: boolean; summaryEntry?: BranchSummaryEntry }>;

  // Verbatim line compaction
  compact(options?: Partial<VerbatimCompactionParameters>): Promise<VerbatimCompactionResult>;
  abortCompaction(): void;

  // Abort current operation
  abort(): Promise<void>;

  // Cleanup
  dispose(): Promise<void>;
}
```

Always `await session.dispose()` in `finally`. Disposal immediately refuses new work, cancels and drains owned operations, settles questions, shuts down extensions and releases session leases. Repeated calls await the same outcome. A `ShutdownFailed` error contains component failures in `errors`; cleanup still attempts the remaining components. Caller-supplied managers and model runtimes remain borrowed, and other sessions remain usable. `abort()` cancels current work without destroying the session.

`compact()` serializes older context to numbered lines, asks the session model for JSON deleted ranges, validates them, and mechanically reconstructs a durable verbatim transcript string. It appends a `compaction` entry with `details.strategy: "verbatim-lines"`; the recent tail remains ordinary messages. The model never authors replacement context text.

`session.navigateTree()` rejects during streaming, compaction, or branch summarization rather than queueing the navigation. The active branch stays unchanged. Wait for the operation to finish before retrying.

Session replacement APIs such as new-session, resume, fork, and import live on `AgentSessionRuntime`, not on `AgentSession`.

### createAgentSessionRuntime() and AgentSessionRuntime

Use the runtime API when you need to replace the active session and rebuild cwd-bound runtime state.
This is the same layer used by the built-in interactive, print, and RPC modes.

`createAgentSessionRuntime()` takes a runtime factory plus the initial cwd/session target. The factory closes over process-global fixed inputs, recreates cwd-bound services for the effective cwd, resolves session options against those services, and returns a full runtime result.

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@bastani/atomic";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});
```

`AgentSessionRuntime` owns replacement of the active runtime across:

- `newSession()`
- `switchSession()`
- `fork()`
- clone flows via `fork(entryId, { position: "at" })`
- `importFromJsonl()`

Important behavior:

- `runtime.session` changes after those operations
- event subscriptions are attached to a specific `AgentSession`, so re-subscribe after replacement
- if you use extensions, call `runtime.session.bindExtensions(...)` again for the new session
- creation returns diagnostics on `runtime.diagnostics`
- if runtime creation or replacement fails, the method throws and the caller decides how to handle it

```typescript
let session = runtime.session;
let unsubscribe = session.subscribe(() => {});

await runtime.newSession();

unsubscribe();
session = runtime.session;
unsubscribe = session.subscribe(() => {});
```

### Prompting and Message Queueing

`PromptOptions` controls prompt expansion, queueing behavior while streaming, and prompt preflight notifications:

```typescript
interface PromptOptions {
  expandPromptTemplates?: boolean;
  images?: ImageContent[];
  streamingBehavior?: "steer" | "followUp";
  source?: InputSource;
  preflightResult?: (success: boolean) => void;
}
```

`preflightResult` is called once per `prompt()` invocation:

- `true` when the prompt was accepted, queued, or handled immediately
- `false` when prompt preflight rejected before acceptance

It fires before `prompt()` resolves. `prompt()` still resolves only after the full accepted run finishes, including retries. Failures after acceptance are reported through the normal event and message stream, not through `preflightResult(false)`.

The `prompt()` method handles prompt templates, extension commands, and message sending:

```typescript
// Basic prompt (when not streaming)
await session.prompt("What files are here?");

// With images
await session.prompt("What's in this image?", {
  images: [{ type: "image", data: "...", mimeType: "image/png" }]
});

// During streaming: must specify how to queue the message
await session.prompt("Stop and do this instead", { streamingBehavior: "steer" });
await session.prompt("After you're done, also check X", { streamingBehavior: "followUp" });
```

**Behavior:**
- **Extension commands** (e.g., `/mycommand`): Execute immediately, even during streaming. They manage their own LLM interaction via `pi.sendMessage()`.
- **File-based prompt templates** (from `.md` files): Expanded to their content before sending or queueing.
- **During streaming without `streamingBehavior`**: Throws an error. Use `steer()` or `followUp()` directly, or specify the option.
- **`preflightResult(true)`**: Means the prompt was accepted, queued, or handled immediately.
- **`preflightResult(false)`**: Means preflight rejected before acceptance.

For explicit queueing during streaming:

```typescript
// Queue a steering message for delivery after the current assistant turn finishes its tool calls
await session.steer("New instruction");

// Wait for agent to finish (delivered only when agent stops)
await session.followUp("After you're done, also do this");
```

Both `steer()` and `followUp()` expand file-based prompt templates but error on extension commands (extension commands cannot be queued).

`pauseQueuedMessages()` is a synchronous admission gate. It moves existing raw steering/follow-up entries into a hold before an abort boundary and keeps later context-bearing arrivals—including trigger-turn custom messages, batches, interrupts, `sendUserMessage()`, and ordinary `prompt()` calls—queued without starting a provider turn. Content blocks, optional data, duplicate identities, raw text, message types, and the existing order within each queue kind are retained. Non-trigger custom messages remain history-only and do not invent a turn.

`resumeQueuedMessages()` releases that hold exactly once but does **not** itself start or continue a model turn. Its promise resolves to `true` only when raw held steering/follow-up work was released, and to `false` when no held raw work existed. The caller must use its existing explicit resume action (for example, the interactive chat submission or workflow resume boundary) to drive execution. `clearQueue()` clears the paused flag when it explicitly removes the final unowned held item; if a protected or interrupt-owned item remains, the gate stays paused.

### Agent and AgentState

The `Agent` class (from `@earendil-works/pi-agent-core`) handles the core LLM interaction. Access it via `session.agent`.

```typescript
// Access current state
const state = session.agent.state;

// state.messages: AgentMessage[] - conversation history
// state.model: Model - current model
// state.thinkingLevel: ThinkingLevel - current thinking level
// state.systemPrompt: string - system prompt
// state.tools: AgentTool[] - available tools
// state.streamingMessage?: AgentMessage - current partial assistant message
// state.errorMessage?: string - latest assistant error

// Replace messages (useful for branching or restoration)
session.agent.state.messages = messages; // copies the top-level array

// Replace tools
session.agent.state.tools = tools; // copies the top-level array

// Wait for agent to finish processing
await session.agent.waitForIdle();
```

### Events

Subscribe to events to receive streaming output and lifecycle notifications.

```typescript
session.subscribe((event) => {
  switch (event.type) {
    // Streaming text from assistant
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // Thinking output (if thinking enabled)
      }
      break;
    
    // Tool execution
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    case "tool_execution_update":
      // Streaming tool output
      break;
    case "tool_execution_end":
      console.log(`Result: ${event.isError ? "error" : "success"}`);
      break;
    
    // Message lifecycle
    case "message_start":
      // New message starting
      break;
    case "message_end":
      // Message complete
      break;
    
    // Agent lifecycle
    case "agent_start":
      // Agent started processing prompt
      break;
    case "agent_end":
      // Agent finished (event.messages contains new messages)
      break;
    
    // Turn lifecycle (one LLM response + tool calls)
    case "turn_start":
      break;
    case "turn_end":
      // event.message: assistant response
      // event.toolResults: tool results from this turn
      break;
    
    // Session events (queue, compaction, retry)
    case "queue_update":
      console.log(event.steering, event.followUp);
      break;
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
    case "summarization_retry_scheduled":
    case "summarization_retry_attempt_start":
    case "summarization_retry_finished":
      break;
  }
});
```

A subscriber that rebuilds the assistant message from these deltas must
accumulate them into its own message object. `message_start` reports the
message the model is about to stream, but an in-process subscriber receives the
provider's live partial rather than a snapshot of it, and the provider keeps
appending to that same object as the stream runs. Appending a delta to it adds
text the provider already added. A subscriber that attaches part-way through a
turn missed the deltas that came before it and can seed itself from
`session.agent.state.streamingMessage`, which holds the message currently being
streamed, if any.

## Options Reference

Moved to [SDK API reference](/sdk/reference#options-reference).

### Directories

Moved to [SDK API reference](/sdk/reference#directories).

### Model

Moved to [SDK API reference](/sdk/reference#model).

#### Model catalog persistence and refresh

Moved to [SDK API reference](/sdk/reference#model-catalog-persistence-and-refresh).

### API Keys and OAuth

Moved to [SDK API reference](/sdk/reference#api-keys-and-oauth).

### System Prompt

Moved to [SDK API reference](/sdk/reference#system-prompt).

### Tools

Moved to [SDK API reference](/sdk/reference#tools).

#### Bash tool behavior

Moved to [SDK API reference](/sdk/reference#bash-tool-behavior).

#### Waiting for existing shell tasks

Moved to [SDK API reference](/sdk/reference#waiting-for-existing-shell-tasks).

#### PowerShell tool behavior

Moved to [SDK API reference](/sdk/reference#powershell-tool-behavior).

#### Tools with Custom cwd

Moved to [SDK API reference](/sdk/reference#tools-with-custom-cwd).

### Custom Tools

Moved to [SDK API reference](/sdk/reference#custom-tools).

#### Structured output final results

Moved to [SDK API reference](/sdk/reference#structured-output-final-results).

### Extensions

Moved to [SDK API reference](/sdk/reference#extensions).

### Skills

Moved to [SDK API reference](/sdk/reference#skills).

### Context Files

Moved to [SDK API reference](/sdk/reference#context-files).

### Slash Commands

Moved to [SDK API reference](/sdk/reference#slash-commands).

### Session Management

Moved to [SDK API reference](/sdk/reference#session-management).

### Settings Management

Moved to [SDK API reference](/sdk/reference#settings-management).

## ResourceLoader

Moved to [SDK API reference](/sdk/reference#resourceloader).

## Return Value

Moved to [SDK API reference](/sdk/reference#return-value).

## Complete Example

```typescript
import { getModel } from "@bastani/pi-ai/compat";
import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@bastani/atomic";

// Create a runtime with custom credential storage and no models.json.
const authStorage = AuthStorage.create("/custom/agent/auth.json");
const modelRuntime = await ModelRuntime.create({ credentials: authStorage, modelsPath: null });

// Runtime API key override (not persisted). setRuntimeApiKey updates auth state;
// the scoped refresh updates that provider's catalog. getAuth, getRequestAuth, and
// stream/complete options also accept `signal`; request-auth setup is cancelled with
// the caller, uses one 15-second preparation bound per request, and does not keep
// waiting after the model stream has opened.
if (process.env.MY_KEY) {
  const providerId = "anthropic";
  const authController = new AbortController();
  await modelRuntime.setRuntimeApiKey(providerId, process.env.MY_KEY, { signal: authController.signal });
  await modelRuntime.refresh({ providers: [providerId], signal: authController.signal });
}

// Inline tool
const statusTool = defineTool({
  name: "status",
  label: "Status",
  description: "Get system status",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `Uptime: ${process.uptime()}s` }],
    details: {},
  }),
});

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("Model not found");

// In-memory settings with overrides
const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
});

const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: "/custom/agent",
  settingsManager,
  systemPromptOverride: () => "You are a minimal assistant. Be concise.",
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: "/custom/agent",

  model,
  thinkingLevel: "off",
  modelRuntime,

  tools: ["read", "bash", "status"],
  customTools: [statusTool],
  resourceLoader: loader,

  sessionManager: SessionManager.inMemory(),
  settingsManager,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Get status and list files.");
```

## Run Modes

Moved to [SDK API reference](/sdk/reference#run-modes).

### InteractiveMode

Moved to [SDK API reference](/sdk/reference#interactivemode).

### runPrintMode

Moved to [SDK API reference](/sdk/reference#runprintmode).

### runRpcMode

Moved to [SDK API reference](/sdk/reference#runrpcmode).

## RPC Mode Alternative

For subprocess-based integration without building with the SDK, use the CLI directly:

```bash
atomic --mode rpc --no-session
```

See [RPC documentation](/rpc) for the JSON protocol.

The SDK is preferred when:
- You want type safety
- You're in the same Node.js process
- You need direct access to agent state
- You want to customize tools/extensions programmatically

RPC mode is preferred when:
- You're integrating from another language
- You want process isolation
- You're building a language-agnostic client

## Exports

Moved to [SDK API reference](/sdk/reference#exports).

## Owner-bound task supervisor (S1)

Moved to [SDK API reference](/sdk/reference#owner-bound-task-supervisor-s1).

### Supervised command SDK

Moved to [SDK API reference](/sdk/reference#supervised-command-sdk).

### Task transcript references

Moved to [SDK API reference](/sdk/reference#task-transcript-references).
