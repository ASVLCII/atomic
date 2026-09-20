# Development and startup measurement

Relocated from `packages/coding-agent/docs/development.md`: Setup, Forking / Rebranding, Path Resolution, Startup timing probes, Testing, Installed package smoke test, Deterministic installs, Release security boundary, and Project Structure. Commands and fenced examples below are retained verbatim. User-facing diagnostic reporting stays in the source guide.

## Setup

```bash
git clone https://github.com/bastani-inc/atomic
cd atomic
npm ci --ignore-scripts
npm run build
```

Use npm for installs, builds, checks, and Vitest suites. Bun compiles standalone binaries and runs repository TypeScript scripts. Do not use yarn, pnpm, or `bun install`. Development wrappers retain the caller's cwd. Run scripts from the root or a package directory:

```bash
npm run test:unit
npm run build --workspace=@bastani/atomic
```

## Forking / Rebranding

Configure via `package.json`:

```json
{
  "atomicConfig": {
    "name": "atomic",
    "configDir": ".atomic"
  }
}
```

Change `name`, `configDir`, and `bin` for a fork. These control the banner, config paths, and environment variable names. The app-specific `<appName>Config` key wins over legacy `piConfig`. Atomic uses `atomic`, `.atomic`, and the `atomic` executable.

## Path Resolution

Package-manager installs, standalone binaries, and source checkouts resolve assets differently. Always use `src/config.ts`, not `__dirname`:

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

## Startup timing probes

Follow the [startup benchmark instructions](../../../scripts/perf/windows-startup/README.md). `scripts/perf/windows-startup/benchmark.ts` launches bare `atomic` in a real 120x40 ConPTY, feeds ordered output into `@xterm/headless`, and timestamps receives with `process.hrtime.bigint()`.

Accepted measurements are:

- Complete first paint: final `Atomic v<version>` identity, focused `❯ ` editor, and two identical settled frames separated by at least one 80 ms animation interval.
- `dispatchMs`: Enter write to the first byte observed by a raw TCP loopback provider.
- `spawnToDispatchMs`: exactly `startupCompleteMs + dispatchMs`.
- `launchToProviderFirstByteMs`: the contiguous launch-to-provider interval, including nonce typing and editor-echo waiting.

The request must contain the nonce and normal tool schemas. Each accepted sample must pass `/workflow list` after the timed response. The benchmark README covers artifacts, cache profiles, raw records, and summaries.

Do not use `time-to-first-frame` as settled-paint evidence or substitute `launchToProviderFirstByteMs` for the contract sum. The first-frame mark is the first requested identity frame after header mounting, not proof of terminal receipt, animation settlement, resource readiness, or provider readiness. `ATOMIC_STARTUP_BENCHMARK=1`, `--no-extensions`, and `--no-tools` are attribution controls, not the accepted full CLI path.

Internal lifecycle timing uses monotonic nanoseconds. Without an installed synchronous diagnostic sink it reads no clock, writes no output, and schedules no work. External ConPTY and TCP marks are authoritative. The partial orders are:

```text
interactive host: process-entry → interactive-engine-spawn → engine-ready
                  → tui-start → header-mounted → initialize engine-bound state
                  → chat-output-release → interactive-input-handler-ready

isolated child:   process-entry → engine-ready → engine-bound
                  → engine-resources-ready

external screen:  first-terminal-write → startup-coherent → startup-complete

first turn:       interactive-first-submit → before-provider-request
```

The header/editor mount before the host waits for `engine-bound`, so binding may arrive while the host applies a theme or requests a frame. `engine-bound` means RPC control and the mandatory minimal session are available. `engine-resources-ready` is generation-scoped and follows commit of the staged optional extensions, tools, providers, skills, prompts, and themes. Prompts, extension/model/resource commands, session replacement, and tool-dispatching RPC wait for it.

After readiness failure, `/reload` bypasses the rejected gate and starts a transactional retry; success replaces the gate. Escape cancels a waiting first submission so it cannot dispatch later. Candidate `session_start` messages remain queued until publication. Mandatory Intercom stays in the minimal runtime. Failed candidates leave host-managed settings, providers, tools, resources, subscriptions, and system prompt unchanged, restore unadmitted drafts exactly, and report the generation failure once. `sessionScopedExtensionState` objects are shared, not cloned or rolled back.

Host and child clocks must not be subtracted without external synchronization. `engine-resources-ready` belongs to the child; `startup-coherent` and `startup-complete` describe internal composition, not receipt. External VT predicates determine first paint.

Under Node 22, the host and child enable the persistent module compile cache; the host flushes it before spawning the child. Explicit `NODE_COMPILE_CACHE` and `NODE_DISABLE_COMPILE_CACHE` pass through unchanged, preserving coverage opt-out. No forced cache directory or first-run precompile step is used. SEA, V8 snapshots, and install-time precompilation were rejected because dynamic ESM, native modules, workers, and first-run requirements lack a safe portable boundary.

`ATOMIC_TIMING=1` enables older human-readable phase diagnostics. Their initial group prints before `interactiveMode.run()`; later marks do not print in ordinary sessions. Consult repository build instructions for current Bun and Windows bytecode requirements.

## Testing

```bash
npm run check                    # Typechecks and published-shrinkwrap validation
npm run test:unit                # Root unit tests
npm run test:integration         # Root integration tests
npm run test:all                 # All root test projects
npm run test:scripts             # Repository script tests under Node
npm run test --workspace=@bastani/atomic -- test/specific.test.ts
```

Root unit and integration CI runs on Linux and Windows. See [CI](../../ci.md).

```bash
npm run typecheck                 # Type-check the monorepo
```

### Installed package smoke test

After building, verify Node startup and builtin loading outside the checkout:

```bash
ATOMIC_REQUIRE_INSTALLED_NODE_SMOKE=1 npx vitest --run --project integration test/integration/installed-package-node-extensions.test.ts
```

Regenerate shrinkwrap after dependency changes with `npm run shrinkwrap:coding-agent`, then run `npm run check`.

## Deterministic installs

`packages/coding-agent/npm-shrinkwrap.json` pins the shipped dependency tree. Check it with:

```bash
bun run scripts/generate-coding-agent-shrinkwrap.mjs --check
```

## Release security boundary

Follow the [release pipeline](../../ci.md#direct-release-trigger-and-recovery). Release bases stay at `0.0.0`; `scripts/cut-release.ts` stamps only the detached tagged release commit.

## Project Structure

```text
packages/
  ai/           # Atomic's LLM provider fork
  coding-agent/ # CLI, interactive mode, and core runtime
  workflows/    # Workflow execution
  subagents/    # Subagent orchestration
  mcp/          # MCP adapter
  web-access/   # Web search and content extraction
  intercom/     # Cross-session coordination
```

The companion packages are bundled with the CLI:

```
packages/
  coding-agent/ # Atomic CLI, agent loop, providers, TUI, and core runtime
  workflows/    # First-party workflow extension bundled into Atomic
  subagents/    # Built-in subagent orchestration and reusable agents
  mcp/          # Built-in MCP adapter extension
  web-access/   # Built-in web search and content extraction tools
  intercom/     # Built-in cross-session coordination channel
```
