# Authentication implementation and security checks

Relocated from `packages/coding-agent/docs/security.md` (“No Built-in Sandbox”, “Credential Export”) and `providers.md` (“Subscriptions”, “Token Refresh”, “API Keys”, “Endpoint routing for COPILOT_GITHUB_TOKEN”). User guides retain trust boundaries, login/logout actions, token thresholds, export exits, and privacy warnings.

## Credential export safeguards

The following two source bullets are retained verbatim as implementation and test evidence, not user setup instructions:

- **The value is not loggable in transit.** Internally the credential is carried in a wrapper that throws if anything tries to interpolate, serialize, or inspect it, so it cannot reach a log line, a session transcript, or an error message. The wrapper is tested under both Node and Bun, since the published binary is Bun-compiled and `Bun.inspect` is a different formatter.
- **One egress, enumerated.** `credentialPayload` is the only source function that opens the wrapper, and it returns one payload only to `emitCredential`, which performs the guarded real-stdout write. Tests enumerate both allowed `Secret.take()` call sites and *every* call that puts a non-literal value on real stdout, so a new one has to be added to the list and reviewed. The tests carry negative controls for a planted third `take()` call and two planted egress modules. No RPC response type carries a credential either — that is asserted against `src/modes/rpc/rpc-types.ts` directly, because the RPC login reply once echoed the API key the host had just typed in.

These guarantees stop at the explicit stdout export. Downstream shells and programs handle ordinary secret text. Preserve the distinction between exit 8, no bytes written, exit 9, partial secret to discard, and a completed payload followed by drain failure, which remains exit 0 with stderr diagnostics.

## OAuth ownership and refresh

Direct and isolated sessions share the provider-owned OAuth lifecycle. Engine-only extensions expose safe display metadata to the frontend; executable provider functions and credentials remain in the engine. The engine acquires, transactionally persists, and deletes credentials. Catalog refresh is separate bounded work, not part of successful credential commit.

Refresh runs under the `auth.json` lock and rechecks expiry after acquiring it. Sessions sharing the file therefore refresh once; a later session observes the rotated token. The public refresh threshold remains fewer than five minutes of validity.

Login updates the active stored-auth projection against the loaded model snapshot immediately after persistence. Cache restoration, ambient availability, and catalog requests must not delay login completion. Logout removes the projection immediately after deletion, then a bounded local probe preserves availability supplied by environment/runtime credentials. Credential-generation checks reject refresh results started before a newer login/logout. Existing OAuth records retain their schema across the pi-ai model-runtime migration.

## Provider source map

The prior guide directed maintainers to `findEnvKeys()` and `getEnvApiKey()` in `node_modules/@bastani/pi-ai/dist/env-api-keys.d.ts`, with the private map in `dist/env-api-keys.js`. It also claimed the monorepo had no `packages/ai`; repository structure can change, so inspect the actual checkout before relying on that historical location claim. Environment-token Copilot routing and exported helpers moved into `@bastani/pi-ai`. Raw `github_pat_`, `ghp_`, `gho_`, and `ghu_` credentials use developer-CLI integration identity; exchanged `tid=` OAuth tokens retain OAuth headers. Caller headers still win.

## Sandbox rationale

Atomic operates on local source trees and invokes host toolchains, shells, package managers, credentials, and extension code. A partial in-process sandbox would imply a security boundary it could not enforce across those dependencies. Real isolation belongs at an OS or virtualization/container boundary; project trust is only an input-loading guard.
