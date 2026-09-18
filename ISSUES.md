# Known unresolved issues

## PostgreSQL stack CI failures outside #3095's repair

- #3092 runtime-resolver bundling failure and #3093 nested pending-prompt regression are inherited and assigned to the parent; their assertions remain unchanged.
- Run 35188751755 also records a Windows Intercom reconnect timeout on the first attempt, absent on retry. Stack attribution is unestablished; no Intercom change is justified here.

## SDK parity remaining risks (observed during slice D)

- SDK and host integration still emit `MaxListenersExceededWarning` for `beforeExit` listeners. Attribution remains unestablished; no suppression or fix is claimed.
- A built non-TTY Node workflow completed with the correct result/hash and one effect, but `session.dispose()` alone did not let the process exit within 40 seconds. Inspect-only debugger review attributed retained DBOS owner/telemetry/queue/scheduler/notifier and PostgreSQL handles to the pre-existing synchronous disposal path missing `session_shutdown`. The D fixture now uses existing public `createAgentSessionRuntime` shutdown and exits naturally; this is not a repair of public session disposal. F must implement awaited owner-scoped cleanup without harming siblings or borrowed resources; H must prove normal packed-consumer exit after public disposal with no supplemental cleanup.
- Service/global isolation remains G; packed export/type closure remains H. Resolved child inheritance and owner-isolation gaps are recorded in `docs/sdk-parity-3105-e.md`; resolved D routing/rebind/questionnaire/host-parity gaps are recorded in `docs/sdk-parity-slice-d.md`.
- H reviewer observed existing pi-ai TS1543 declaration closure failure with skipLibCheck:false; outside E.
