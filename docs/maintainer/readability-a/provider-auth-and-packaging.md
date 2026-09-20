# Provider authentication and packaged runtimes

Relocated from `packages/coding-agent/docs/custom-provider/oauth.md`, `custom-provider.md` testing introduction, `getting-started/installation.md` runtime packaging, and `environment-variables.md` subprocess attribution. Public provider examples and configuration remain in those guides.

## Isolated OAuth transactions

Extension code and executable OAuth methods stay in the engine. Only JSON-safe provider descriptors (`id`, `name`, `loginLabel`, `usesCallbackServer`) cross to the terminal process; functions and acquired credentials are not serialized and extensions are not loaded again in the frontend. The engine correlates URLs, device codes, progress/info, prompts, selections, and manual codes with the login that owns them. `usesCallbackServer` allows pasted redirect URL and browser callback to race.

Credential persistence and logout serialize in the engine. After persistence succeeds, it publishes the authenticated provider against the loaded snapshot. Catalog and ambient-availability refresh run separately under the selector deadline and cannot extend the login transaction. Logout removes credentials without `refreshModels`; the local remaining-auth probe has a short deadline. The frontend applies snapshots only after transaction success. Cancellation preserves the previous credential/catalog; direct and builtin OAuth use the same semantics. Later registrations override earlier IDs.

Quiet cancellation recognizes native `AbortError`, aborted signals or exact reasons, nested abort causes, and exact legacy `Login cancelled`. Provider denial, timeout, protocol/network, malformed response, exchange, and storage failures remain errors. Catalog failure is reported by `/model`, not as rollback of a persisted login.

## Provider contract checks

The custom-provider testing guide's listed test names describe behaviors for provider authors, not files to copy from this checkout. Provider internals come from `@bastani/pi-ai`; there is no `packages/ai/test` directory here. Check streaming, usage, abort, empty responses, overflow, image limits, Unicode, missing tool results, image tool results, total tokens, and cross-provider handoff against intended provider/model pairs.

## Runtime payload selection

npm-compatible managers select the matching `@bastani/atomic-natives` leaf carrying PostgreSQL. Legacy upstream optional packages can remain but the native leaf wins. Standalone archives carry a target-selected runtime resolved from the extracted payload, including node_modules, libraries, and licenses.

Windows ARM64 ships Windows x64 PostgreSQL through Windows 11 x64 emulation, not native ARM64 PostgreSQL. It requires Visual C++ x64 v14 Redistributable; Windows 10 ARM is unsupported and hardware execution remains unvalidated.

Alpine/musl archives carry matching native search/PTY bindings plus payload-local libgcc/libstdc++. Clipboard bindings are omitted because `@mariozechner/clipboard` 0.3.9 musl packages are metadata-only stubs without `.node` payloads. Clipboard fallback uses local Linux commands and allows OSC 52 only over SSH/Mosh.

Musl archives omit glibc-linked `@embedded-postgres/*` packages and carry checksum-pinned Alpine/musl PostgreSQL 18.6 for offline durability without Docker or external Postgres. Backend provisioning failure remains a visible non-durable in-memory fallback.

## Subprocess attribution

CLI, RPC, and compiled entrypoints set `AI_AGENT=atomic`, then force it into all owned environments: shell/tools, isolated children, subagent/workflow runners, MCP, web-access, and broker. This follows upstream overwrite policy. Caller values are replaced without mutating the caller's environment object.
