# Tool editing and storage maintenance

Relocated from `packages/coding-agent/docs/tools.md`: block resolution, limits, inactive errors/warnings, write coordination, native search, URL protection, and persisted-output implementation. Public patch syntax, examples, emitted warnings, conflict recovery, caps, and SDK adapter obligations remain in the guide.

## Hashline internals

Block resolution first uses native Rust tree-sitter `blockRangeAt` from `@bastani/atomic-natives`; brace/indent heuristics are the unavailable-binding fallback. The outermost node beginning at the anchor wins. Decorator behavior and explicit-range escape routes remain user-facing because they affect what gets edited.

| Constant | Value |
| --- | --- |
| `HL_FILE_HASH_LENGTH` | `4` |
| `HL_FILE_HASH_RE_RAW` | `[0-9A-F]{4}` |
| `HL_MAX_EXPANDED_RANGE_LINES` | `100_000` |
| `MISMATCH_CONTEXT` | `2` |
| `RECOVERY_FUZZ_FACTOR` | `0` |
| `HL_FILE_PREFIX`, `HL_FILE_SUFFIX`, `HL_FILE_HASH_SEP` | `[`, `]`, `#` |
| `HL_PAYLOAD_REPLACE`, `HL_RANGE_SEP`, `HL_HEADER_COLON` | `+`, `..`, `:` |

Operation keywords are `replace`, `delete`, `insert`, `block`, `before`, `after`, `head`, and `tail`. Tags are content-derived session snapshot pointers. Numeric range expansion is checked before allocating; recovery does not slide hunks onto nearby duplicates. Hunk-like explicit payload triggers `HUNK_LIKE_LITERAL_WARNING`. `edit.ts` returns the identical no-op diagnostic twice and throws on the third attempt with `STOP.`.

Atomic differs from the upstream reference by accepting empty concrete replacement as deletion and lowering unresolved `insert after block` to ordinary insertion with a warning.

Low-level diagnostics, not ordinary repair instructions:

- `Hashline Patcher requires a SnapshotStore; section tags are opaque store pointers.`
- `Tokenizer is closed; call reset() before reusing.`
- `internal error: unresolved \`replace block\` edit reached the applier (resolveBlockEdits was not run).`
- `Hashline edit for <path> did not change the file.` in a mixed no-op call.
- `Edits to <path> resulted in no changes being made.` in lower-level multi-section `apply` or `preflight`.

The low-level `parseTag` helper retains these messages but has no active caller from `edit`:

- `Invalid line reference. Expected a bare line number from read/search output plus the section header content-hash tag (for example [src/foo.ts#1A2B] and line "160") Received "abc"..`
- `Line number must be >= 1, got 0 in "0".`

`messages.ts` retains unused `EMPTY_REPLACE` text, `` `replace N..M:` needs at least one `+TEXT` body row. To delete lines, use `delete N..M`. `` Concrete replacement does not emit it. It also retains two coalescing warnings without emission sites; overlapping deletes are rejected instead:

- ``Two hunks targeted the same range; kept only the second. One `replace N..M:` hunk per range — the body is the final content, never old+new.``
- ``Dropped a bare hunk overlapped by the concrete hunk after it. One `replace N..M:` hunk per range — the body is the final content, never old+new.``

Low-level mismatch calls without a path omit the literal ` for <path>` segment.

## Write coordination and search backends

Observation and mutation share a per-file queue. Even cancellation after disk mutation must record the resulting snapshot. New local files use `O_EXCL`; overwrites do not. The queue excludes Atomic writers, while exclusive creation protects against external writers. Custom operations must read their own remote/sandbox filesystem, not local disk, and distinguish absence from unreadability.

Local `find` uses native glob matching with packaged `fd` fallback. Local search uses native ripgrep; resource-backed search uses the native in-memory matcher with JavaScript fallback for multiline/resource edge cases.

## URL protection and test escape hatch

URL validation covers private/localhost/cloud metadata targets, short numeric IPv4 such as `2130706433` and `127.1`, octal/hex dotted forms, IPv4-compatible/mapped IPv6, NAT64, 6to4 private forms, and `fe80::/10`. It revalidates redirects, pins DNS-validated addresses, and caps streamed bodies.

`ATOMIC_ALLOW_PRIVATE_URL_READS=1` is a development-only exception for trusted local tests. Never set it through untrusted project configuration.

## Persisted output security

Windows temp roots use domain-qualified account names plus a short digest, separating `CONTOSO\Alice`, `FABRIKAM\Alice`, and sanitized-name collisions. Session IDs become one safe path component; separators and `..` cannot escape the tree.

On POSIX, refuse foreign ownership and tighten permissive directories to `0700`; files use `0600`. Windows has no Node-exposed SID or POSIX mode, so `Get-Acl` verifies security descriptors. Owners and access-allowed DACL entries must be the current user, SYSTEM, or Administrators. Foreign/shared roots and unreadable or unparseable descriptors fail closed.

Successful Windows checks are cached per process/path against creation, change, and last-write times. Replacement directories and in-place DACL edits require rechecking. Components below system temp are created and checked individually; symlinks are refused. Only the final session-directory position is replaceable: remove a stale file or link itself, never a link target, then recreate it. Failed validation produces no spill file or reported path.

The 64 MB cap applies only when output exceeds 67,108,864 bytes; exact-cap output remains whole. UTF-8 boundaries survive split streamed chunks, and invalid UTF-8 binary bytes pass through unchanged. Truncation appears in the file, not the tool result or `fullOutputPath` field.

Cleanup runs shortly after startup, outside the startup path. `.last-cleanup` gates each target to once daily and `.cleanup.lock` excludes concurrent sweeps. Session-storage controls live under temp, outside the scanned directory. Reap only verified real temp/output directories whose newest file is older than 30 days; a fresh file or a live in-process session protects the tree. Never traverse symlinks or delete session JSONL transcripts.
