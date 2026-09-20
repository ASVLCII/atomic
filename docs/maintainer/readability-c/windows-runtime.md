# Windows runtime and release maintenance

Relocated from `packages/coding-agent/docs/windows.md`, Install, Interactive Startup, Filesystem Watchers, and Self-Update Behavior. This is implementation and incident context, not installation guidance or fresh validation evidence.

## Installer cleanup

Each attempt owns an `atomic-install-*` staging directory. Windows may retain an executable image or file handle briefly after its process exits. Cleanup clears read-only attributes, retries a bounded number of times, and verifies absence after each attempt. Exhaustion reports the path, attempt count, and last Windows error. Cleanup failure must not replace the original installation error.

## Startup resource transactions

The isolated engine binds the mandatory minimal runtime, including Intercom, before staging workflows, subagents, MCP, web access, optional tools, provider overrides, skills, prompts, and themes. Prompt dispatch, extension and model/resource commands, session replacement, tool-aware RPC operations, and `session_start` messages wait on a generation-scoped resource-ready gate.

`/reload` creates a fresh transaction after a rejected gate. A failed candidate must not publish host-managed settings, providers, tools, resources, subscriptions, or system-prompt state. Extension-owned session-scoped objects remain shared and are not rolled back. An old generation cannot release or reject a replacement generation's submission.

## Release launcher constraints and incident

Package-manager and archive builds use the same application source. Node retains its persistent compile cache, with `NODE_DISABLE_COMPILE_CACHE=1` for coverage. Archives syntax-minify the application sidecar without shortening identifiers. Windows x64 and ARM64 launchers use bytecode, but must be compiled on Windows.

The Bun 1.4.0 safeguard remains relevant despite the embedded-bytecode alignment fix [#26299](https://github.com/oven-sh/bun/pull/26299) and integrity fallback [#31961](https://github.com/oven-sh/bun/pull/31961). Cross-compilation on a non-Windows host produced a launcher that segfaulted before user code, including on `--version`. The 0.9.18-alpha.1 payload was built on Linux and crashed while the Windows-hosted smoke build passed.

`publish.yml` builds both Windows archives on the Windows runner; Linux release packaging uses `build-binaries.sh --skip-windows`. The pinned Bun 1.4.2 probe cross-compiles `bun-windows-x64-baseline` and `bun-windows-arm64` and checks PE machine types. That proves architecture, not runtime compatibility. Full archive, TUI, workflow, tool, extension, worker, and native-addon validation still needs Windows x64 and real Windows ARM64 hardware. The source notes claimed no measured Windows speedup.

## Watchers and native-addon replacement

Canonicalize watcher paths before calling native `fs.watch`. Targets that cannot be canonicalized or retain unsafe 8.3 components such as `USERNA~1` use polling where supported. This avoids Windows/libuv path-prefix assertion crashes affecting long-running sessions, Git status, and theme reloads.

Self-update first cleans the previous `.atomic-native-quarantine` under the global package root. Loaded native add-ons move into a per-run quarantine and are copied back before invoking the package manager, allowing it to replace files that the running process would otherwise lock.
