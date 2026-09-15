# Known issues (tracked, not fixed in the active Intercom interrupt slice)

## U1 — A workflow-inheriting child shares its parent stage's pending-ask ledger

**Status:** pre-existing on base `cb13229bebe30ea7cb65689569569494b4bc651c`; deliberately out of scope for `fix/subagent-intercom-active-steering` per independent review. No repair attempted.

**Symptom:** an in-process child launched from a workflow stage exposes the parent stage's unanswered Intercom asks through its own public `intercom({ action: "pending" })`, and a bare `reply` in the child can resolve against a question that was addressed to the parent.

**Root cause (inspected, unchanged files):**

- `packages/subagents/src/runs/inprocess/runner.ts` passes the parent's `orchestrationContext` to the child session unchanged.
- `packages/intercom/workflow-reply-tracker.ts` (`bindWorkflowReplyTracker`) selects the shared `messageAdmission.extensionState` reply ledger for any session whose orchestration context is a workflow stage, without excluding a typed child (`subagentPolicy.executionEnded` present).
- `packages/intercom/lifecycle.ts` binds that shared ledger at startup and on every `turn_start`.

**Exact reproduction (scripted model, real broker and public tool handlers):**

```sh
PATH="$PWD/.artifacts/setup/runtime/bun-darwin-aarch64:$PATH"; npx vitest --run --config .artifacts/review/vitest.config.ts --reporter=verbose -t "pending" .artifacts/review/public-broker.test.ts
```

The probe creates a parent endpoint and a child endpoint that both carry the same typed workflow-stage context (the child additionally carries `subagentPolicy.executionEnded`), holds the parent in a native tool, asks the parent's exact ID from an owned peer, then calls `pending` on the child. Observed (`.artifacts/review/public-broker-trusted.log`, `final-falsification.log`):

```text
WORKFLOW_CHILD_PENDING **Pending asks:**
- pending-peer · <exact ask ID> · 0s ago · PRIVATE-PARENT-QUESTION
```

Expected: `No unresolved inbound asks.`

**Limits:** reproduced on the candidate tree against unchanged base files, not by executing the full base tree. It does not demonstrate a cross-group transport bypass or a successful wrong-recipient reply through the broker; those stronger claims were not established.

**Suggested repair (later scope):** exclude typed child executions from parent-generation reply-ledger binding/preservation; retain generation sharing only for replacement sessions of the same workflow-stage conversation. Add a parent-plus-two-children public pending/reply isolation regression.

## #3073 — optional upstream PostgreSQL module closure remains unresolved

The missing standalone aliases are repaired by materializing the existing manifest during standalone staging. Required extracted `postgres`, `pg_ctl`, and `initdb` entrypoints and isolated macOS/Linux lifecycle checks pass. Installation now checks those entrypoints before promotion; npm keeps manifest-based first-use hydration.

The broader full-image requirement is **not satisfied**: upstream `@embedded-postgres/darwin-arm64@18.4.0-beta.17` contains `lib/libpq-oauth-18.dylib` importing `@loader_path/../lib/libcurl.4.dylib`, but contains no libcurl payload. This optional module is not loaded by the required entrypoints/lifecycle. Do not rewrite Mach-O load commands, substitute system libcurl, or re-sign/supply dependencies without authorization.

Repeat the negative diagnostic against a standalone staged or extracted macOS runtime:

```sh
node --input-type=module -e 'import {validateRuntimeDependencies as validate} from "./scripts/postgres-runtime-dependencies.mjs"; validate(process.argv[1])' /path/to/postgres-runtime
```

Expected current failure: `incomplete PostgreSQL dependency closure: lib/libpq-oauth-18.dylib -> @loader_path/../lib/libcurl.4.dylib` (exit 1). The diagnostic scans supported Mach-O images, including optional modules; it does not validate ELF/PE. Regression: `node --test scripts/postgres-runtime-dependencies.test.mjs`. Required native-loader preflight is deliberately separate from this failing all-image diagnostic. Full closure/readiness remains unresolved, not waived.
