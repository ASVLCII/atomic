# Internal hashline diagnostics

The user-facing patch syntax, emitted warnings, recovery instructions, and error catalogue live in [Tools](../../packages/coding-agent/docs/tools.md). These internal and inactive diagnostics are kept here rather than in that guide.

## Block resolution integration

Passing an unresolved block edit to the applier is a host integration error:

```text
internal error: unresolved `replace block` edit reached the applier (resolveBlockEdits was not run).
```

## Inactive parser diagnostics

The low-level `parseTag` helper has no active caller from `edit`. It retains these literal errors:

```text
Invalid line reference. Expected a bare line number from read/search output plus the section header content-hash tag (for example [src/foo.ts#1A2B] and line "160") Received "abc"..
Line number must be >= 1, got 0 in "0".
```

`EMPTY_REPLACE` is retained but not emitted: an empty concrete replacement is accepted as deletion. Empty block replacement is still rejected.

```text
`replace N..M:` needs at least one `+TEXT` body row. To delete lines, use `delete N..M`.
```
