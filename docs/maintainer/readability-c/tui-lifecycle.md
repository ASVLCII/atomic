# TUI lifecycle and host bridge maintenance

Relocated from `packages/coding-agent/docs/tui.md`, `tui/reference.md`, `usage.md`, and `workflows/operations.md`. Component signatures, examples, focus contracts, host UI APIs, and actionable ANSI capture remain public.

## Input and host ownership

Under engine isolation the component stays in the child, whose stdout is JSONL transport rather than a TTY. The host caches lines and forwards input asynchronously. Matching fullscreen keys and focused-overlay mouse input wait for a boolean child reply with bounded fallback. Consumed left-button events are mirrored to pi-tui so selection works over overlays. Non-overlay mouse events stay with pi-tui. Release events are filtered unless `wantsKeyRelease` is true.

The allowlisted autowrap setter controls the real host TTY over the engine protocol. Arbitrary child bytes are not forwarded. Hide, close, disposal, crash, and restart restore terminal modes; fullscreen pi-tui retains baseline modes. Non-isolated hosts and test seams may omit the setter.

Host-native session pickers mount `SessionSelectorComponent` locally. JSON-safe row updates, errors, close, selection, cancel, and confirmed deletion cross the boundary instead of every keypress. `/workflow resume` uses this channel. Host-native forms similarly keep keyboard handling in the editor slot; only open and final submit/cancel cross isolation. `/workflow <name>` retains older editor/custom-UI paths only for host compatibility.

The shared chat host owns reserved `/tasks` dispatch even during interrupt settlement. Stage extension commands cannot replace that view. Skill completion reuses the attached session without checkpointing on every keystroke.

## Working and compaction indicators

The default `∀` is exactly one cell, with 453 original randomized working verbs selected once per turn. The longest fits the tested 64-column layout. Every agent/SDK turn starts dark and regular at a fresh lifecycle-relative 88 ms cadence. Ten frames run dark → accent → bright/bold → accent → dark without geometry changes. Theme overrides support exact indices 0–255; omitted tones derive from selected background, accent, and text.

`NO_COLOR` keeps regular/bold cadence without foreground escapes. Reduced motion is static regular accent without a timer. Turn, terminal, error, replacement, and disposal paths stop timers. Restoring defaults after an extension override resets phase; custom frames and intervals stay verbatim, including multiline/control content.

Accepted prompt startup owns Working before the first agent event. Attaching mid-delivery paints immediately. A queued message uses the active turn's status rather than starting another lifecycle. No-turn outcomes, restore/prompt errors, and completion remove status; a stale start after the final accepted post-terminal delivery cannot revive it. Manual retry clears stale status; factual automatic retry/fallback takes precedence.

Compaction owns the row from `compaction_start` through `compaction_end`, even when Pi opens its follow-up turn early. It paints immediately in main and stage chat. Successful no-op compaction also restores Working. Cancellation stops activity; main chat reports automatic cancellation while stage chat clears transient status when abort carries no error text. Failures retain event error text. Compaction boundaries restore from durable session data, with a typed live fallback when the refreshed snapshot is unavailable.

## Startup and footer projections

Startup assembles the mark in whole-column steps, then shadow, identity, and the one-time manifesto. Narrow terminals use compact text rather than a blank region. Loaded engine extensions are listed without reloading them into the terminal host. Duplicate labels gain parent path components, then display path and a deterministic numeric suffix if necessary.

Isolated footer providers mirror `setStatus()` into the engine session and use a cached cwd-specific Git watcher. Synchronous renderers need neither per-render Git processes nor RPC. Alternate-cwd leases share resources by raw cwd; last unsubscribe releases them. Public subscription/disposal rules remain in the component guide.

`PI_TUI_WRITE_LOG` keeps its upstream name because the installed `@earendil-works/pi-tui` terminal reads it. It captures raw ANSI, not a proof that an interactive scenario passed.
