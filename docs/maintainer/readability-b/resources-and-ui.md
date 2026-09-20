# Resource loading and interactive UI mechanics

Relocated from `packages/coding-agent/docs/settings.md`, `packages.md`, `packages/authoring.md`, `quickstart.md`, `reference/cli.md`, and `skills.md`. Public pages retain configuration, author-facing imports, keyboard actions, and recovery guidance.

## Startup and project trust

Before asking for project trust, bind permitted user/global and explicitly authorized CLI extensions to a trust-safe session. Their `ui_prompt_start` and `ui_prompt_end` handlers observe the wait with a live context. Borrowed/project code remains blocked. Approval completes startup in the same session without reloading reporters; isolated mode asks through RPC-backed host UI, with no model request.

Normal interactive TTY startup paints the shell before background discovery of bundled extensions, skills, prompts, themes, context, and system-prompt files. Async discovery and cooperative yields keep typing, Enter, Ctrl+C, and rendering responsive. Early submission waits for readiness with the prompt spinner, not a pre-submission resource spinner. Explicit model/provider/resource inputs and non-TTY paths generally load eagerly. `enabledModels` patterns resolve again after discovery so extension providers participate without delaying first paint.

`firstRunOnboardingStartedVersion` records onboarding start when prior startup state does not identify a returning user. `onboardedVersion` is the one-time completion marker, set by returning-user detection or first-run workflow-engine explanation. Both are managed state, not user configuration.

## Package loading

Workflow SDK specifiers resolve at runtime to an in-memory host module. The same applies to supported TypeBox root, `typebox/compile`, `typebox/value`, and legacy `@sinclair/typebox` aliases. TypeScript consumers resolve the published `@bastani/atomic/workflows` export through the package; keep that author-facing distinction intact.

Workflow children launched from `-e` get fresh loaders seeded from the trusted parent resource snapshot, including packages, extensions, agent definitions, skills, prompts, themes, workflows, and borrowed project resources. Explicit stage `resourceLoader` overrides remain authoritative.

Self-update installs an exact advertised version and verifies writable package-manager ownership. Windows replacement quarantines loaded native dependencies and cleans stale quarantine directories on later attempts. A manual update command remains the fallback when eligibility cannot be verified.

Package-manager global lookup normally uses `root -g`; when `npmCommand[0]` is exactly `bun`, use `pm bin -g`. Wrapper integrations must support the invoked command shape. Configured git dependency installation uses plain `install` rather than assuming npm-specific flags.

## Terminal input and layout

Focused workflow overlays receive wheel/trackpad input first; unconsumed events reach the alternate-screen viewport. Non-overlay focus leaves pi-tui mouse handling active for scrolling, scrollbars, and selection. Clear overlay selection on hide/main-chat repaint and suppress copying across hierarchy transitions. Preserve nested stack minimum sizes during resize; stack transient notices instead of replacing visible ones.

Ctrl+G uses one asynchronous launcher across main, embedded, and extension editors. Each edit creates a private `atomic-editor-*` directory containing only `prompt.md`, removes it recursively afterward, and never scans the temp root. Successful empty edits remain empty; failures preserve original text; restart and render the TUI on return.

Native macOS Cmd+V depends on terminal forwarding. Through tmux, VS Code may forward empty bracketed paste while Ghostty may not forward Kitty `super+v`. Ctrl+V is the reliable image-paste action there. Mixed clipboard content prefers the image on Ctrl+V; Cmd+V depends on delivered gesture.

The source settings guide attributed environment overrides and LaTeX whitespace/matrix support to pi-tui 0.85.0. Version-specific implementation attribution belongs here; public settings retain the supported overrides and precedence.

## Stage-chat skills

Completion reuses an attached session rather than reattaching/checkpointing per keystroke. Concurrent attachment requests share one attachment, then read the current stage catalog. Completion supports `/skill:` and stage-cwd relative paths, not `@` mentions.

The session pause gate precedes expansion. If it closes during asynchronous attachment, queue literal text; releasing the queue does not retroactively expand it. A composer observing pause before submission resumes first, then expands. Users can restore literal commands to the editor and resubmit after resume. `sendUserMessage` must be admission-aware; never fall back to unguarded `prompt`, `steer`, or `followUp` when a custom stage host lacks it.

The bundled Herdr skill was copied from [herdr v0.9.0](https://github.com/herdrdev/herdr/blob/v0.9.0/skills/herdr/SKILL.md) into `packages/subagents/skills/herdr/SKILL.md`, beside tmux. Keep its explicit-request, `HERDR_ENV=1`, and managed-pane restrictions. Skill content does not authorize installation or control of unrelated panes.

## Version-adoption measurement

The metric is version-adoption pings divided by first-interactive-launch pings, not installs, users, MAU, or retention. Multiple eligible machines overcount; opt-outs, offline launches, and dropped best-effort requests undercount. Public docs retain destinations, transmitted fields, aggregate storage, host connection-metadata caveats, eligibility, and opt-out precedence because those are user privacy decisions.
