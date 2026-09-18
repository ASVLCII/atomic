# Known unresolved issues

## PostgreSQL stack CI failures outside #3095's repair

- #3092 runtime-resolver bundling failure and #3093 nested pending-prompt regression are inherited and assigned to the parent; their assertions remain unchanged.
- Run 35188751755 also records a Windows Intercom reconnect timeout on the first attempt, absent on retry. Stack attribution is unestablished; no Intercom change is justified here.

## SDK parity remaining risks (observed during slice D)

- F removed workflow `beforeExit` ownership and the public built Node fixture now exits naturally after `await session.dispose()`, with one guarded effect and the unchanged workflow source hash. Packed-consumer proof remains H.
- Service/global isolation remains G; packed export/type closure remains H. Resolved child inheritance and owner-isolation gaps are recorded in `docs/sdk-parity-3105-e.md`; resolved D routing/rebind/questionnaire/host-parity gaps are recorded in `docs/sdk-parity-slice-d.md`.
- H reviewer observed existing pi-ai TS1543 declaration closure failure with skipLibCheck:false; outside E.
