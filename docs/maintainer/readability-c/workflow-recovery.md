# Workflow recovery regression checks and release incident

Relocated from `packages/coding-agent/docs/workflows/operations.md`, “Recovering an uncaught tool abort”. The two shell examples below moved verbatim. They are maintainer validation instructions, not commands run by this documentation change. Public recovery guidance retains same-ID inspection/resume, checkpoint requirements, and warnings against repeating external effects.

## Load a patched runtime

To load a locally patched runtime from its checkout:

```bash
npm ci --ignore-scripts
npm run build
# From the workflow's original invocation directory, use this build explicitly:
node /absolute/path/to/patched-checkout/packages/coding-agent/dist/cli.js
```

Start a fresh process from the original invocation directory. `/workflow reload` refreshes definitions, not an installed runtime. The workflows package ships raw TypeScript and has no separate build step; the root build bundles it into the coding-agent.

## Offline regression coverage

```bash
npm run test:integration -- test/integration/workflow-tool-abort-resume.test.ts test/integration/workflow-tool-frontier-consumption.test.ts test/integration/workflow-tool-node-quit-cli.test.ts
```

These checks cover public pause/resume, typed recovery and rejection, a fresh DBOS adapter, and the built Node CLI with a fixture provider. The CLI fixture uses isolated in-memory storage, not the production database or a release workflow. They cannot approve a historical recovery action.

## Historical release incident

This is the retained incident record, not a statement that its external state was rechecked during relocation.

Run `877a91c7-ed68-4ace-9895-cf2555d9b154`, `publish-release`, stopped at `wait-required-ci`, node `tool:h09e55b6c3ff8718bdf7066c90323715f`, after `prepare-changelog-branch` and `validate-commit-push-open-pr`. Read-only investigation found completed checkpoints and the targeted-abort terminal error, but no typed unfinished-tool checkpoint for that node. The patch therefore cannot safely resume this exact retained record automatically; it does not import chat/status snapshots or edit the database.

The supported explicit route is operator reconciliation followed, only if authorized, by a separately named recovery-only workflow containing the verified remaining operation. Inspect the original run and current external state; carry reviewed outputs as explicit inputs, never fabricated checkpoints. Do not include completed preparation, commit, push, or PR creation callbacks, or relaunch `publish-release` from the beginning.

At the time of the incident note, PRs #2862 and #2863 had been admin-merged and publication of `0.9.18-alpha.6` remained on hold. Do not merge, tag, publish, or resume that live release without separate authorization. Neither the regression fixtures nor this relocated note grant it.
