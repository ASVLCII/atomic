---
title: Project instructions
description: Give Atomic durable, repository-specific instructions with AGENTS.md.
---

# Project instructions

**Outcome:** Atomic loads your repository's conventions automatically in every session.

**Prerequisites:** [First session](/getting-started/first-session) is complete.

## Give Atomic project instructions

Atomic loads context files at startup. Add an `AGENTS.md` file to tell it how to work in a project:

```markdown
# Project Instructions

- Run `bun run typecheck` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

Atomic loads:

- `~/.atomic/agent/AGENTS.override.md`, `AGENTS.md`, or `CLAUDE.md` for global instructions (legacy `~/.pi/agent/` also works)
- `AGENTS.override.md`, `AGENTS.md`, or `CLAUDE.md` from parent directories and the current directory

An `AGENTS.override.md` file replaces the other context files in its directory. Restart Atomic, or run `/reload`, after changing context files.

## Verify Atomic loaded them

With `AGENTS.md` saved, run `/reload` (or restart Atomic), then ask:

```text
What project instructions are you following in this repository?
```

The answer should restate your rules, such as the `bun run typecheck` line above, rather than give generic advice. If it does not, check that:

- The file is named `AGENTS.md`.
- It is in the directory where you started Atomic or one of its parents.
- No `AGENTS.override.md` in the same directory replaces it.

## Next step

Continue to [Interactive use](/usage), then [Configuration](/guides/configuration).
