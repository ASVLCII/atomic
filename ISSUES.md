# Known unresolved issues

## PostgreSQL stack CI failures outside #3095's repair

- #3092 runtime-resolver bundling failure and #3093 nested pending-prompt regression are inherited and assigned to the parent; their assertions remain unchanged.
- Run 35188751755 also records a Windows Intercom reconnect timeout on the first attempt, absent on retry. Stack attribution is unestablished; no Intercom change is justified here.

## SDK parity verification

- Packed Node declaration, runtime, durable resume and builtin ownership coverage for #3105 is recorded in `docs/sdk-parity-3105-h.md`. The prior TS1543 model-catalog declaration closure failure is resolved at the shared generator boundary.
- Child inheritance and owner-isolation evidence remains in `docs/sdk-parity-3105-e.md`; routing/rebind/questionnaire/host-parity evidence remains in `docs/sdk-parity-slice-d.md`.
