# Task supervision and terminal state

Relocated from `packages/coding-agent/docs/background-tasks.md`: native observation timing, completion receipts, Windows containment, stage pause sequencing, footer watchers, and task settlement recovery. User controls and tool examples stay in that guide.

## Observation and settlement

Native observation timers run independently of JavaScript. A zero-budget wait may already have backgrounded by the next snapshot, before JavaScript awaits it. Synchronous registration does not promise an observable foreground interval. The elapsed result keeps the same wait/task identity and execution continues. Native `wasBackground` stays set after a designated wait yields, including later foreground waits and settlement.

Execution outcome and cleanup are distinct. Terminal execution does not prove reaping; shell output draining finishes as part of cleanup and failures remain explicit. `TaskSupervisor.taskSettlement(task)` from `@bastani/atomic-natives` retrieves an authentic terminal receipt without another wait, supporting recovery when bounded journals no longer contain completion events. Session-history completion intents/acknowledgements reuse identity across delivery retries; structured receipts stay in message details, not raw chat JSON.

## Owner pause and Windows containment

Stage pause blocks admission immediately and cancels queued agents before active cancellation frees slots. Shell setup already in flight may briefly launch; pause waits for those admissions, cancels the shells, and confirms cleanup. Failure is reported rather than a successful pause. Stage generations, sibling stages, and main owners remain separate. Pausing keeps the message generation open for queued user/Intercom messages on resume but never resurrects cancelled execution.

Windows owned shells use supervised pipes or ConPTY and establish Job Object containment before execution resumes. Failed containment refuses launch. Legacy WSL `bash.exe` stdin transport cannot be adopted because Windows jobs do not supervise Linux guest processes; running Atomic inside WSL uses POSIX execution.

## Footer watchers

Alternate-folder Git branch watchers are shared by chat footers and released when the last viewer closes or changes folders. Closing `/tasks` alone retains its chat footer and other open chats keep their updates. Live transcripts consume child session events; shell output refreshes on state updates, including updates during a previous read, without resetting a reader's older-page position.

## Focused viewport routing

Relocated from `packages/coding-agent/docs/keybindings.md`, TUI Fullscreen Viewport. The installed pi-tui 0.85.1 renderer handles character/word/line selection, including slash paths and kebab-case names. Focus changes and non-drag clicks clear transient state. Generic SGR release ends drags. Mouse tracking reduces under tmux, Zellij, and GNU Screen.

Fullscreen bindings outrank editor bindings under main-editor focus. Focused custom components receive viewport actions first: true consumes, false/undefined/void falls through in process. Remote correlated replies fall through on false, failure, or timeout; undefined after disposal drops because focus ownership ended. Mouse wheel/click follows the same route. Reserving question overlays deliberately release transcript actions during nested text input.
