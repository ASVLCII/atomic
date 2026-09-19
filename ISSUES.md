# Known unresolved issues

## PostgreSQL stack CI failures outside #3095's repair

- #3092 runtime-resolver bundling failure and #3093 nested pending-prompt regression are inherited and assigned to the parent; their assertions remain unchanged.
- Run 35188751755 also records a Windows Intercom reconnect timeout on the first attempt, absent on retry. Stack attribution is unestablished; no Intercom change is justified here.
