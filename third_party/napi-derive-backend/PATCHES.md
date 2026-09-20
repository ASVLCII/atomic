# Atomic patch to napi-derive-backend 6.1.4

This directory starts from the published `napi-derive-backend` 6.1.4 crate. Its source tag is
[`napi-derive-backend-v6.1.4`](https://github.com/napi-rs/napi-rs/releases/tag/napi-derive-backend-v6.1.4) at commit
`38162bb0eb324ae24b402982bad3d4ef3f24c90a`, which is also napi-rs `main`'s current HEAD as of this update.

Atomic carries one ownership patch because that release and commit keep class values as nullable raw pointers
until generated reference creation. The napi runtime rejects null inside its borrow helper, but that proof is
neither encoded in the pointer type nor visible to CodeQL at the macro expansion site. Diffing the pristine
6.1.2 and 6.1.4 crate sources confirms the intervening releases (file-format alignment, fully-qualified `Env`
parameter detection, a `convert_case` bump, and unrelated typegen fixes) do not touch this code path, so the
patch remains required after this update.

The patch converts class pointers to `NonNull<T>` before borrow registration in:

- `FromNapiRef` and `FromNapiMutRef` generation;
- shared and mutable method-receiver generation;
- generated class field getters and setters.

Generated code preserves the existing `Status::InvalidArg` status and `Cannot borrow a null native value` reason.
The patch does not change JavaScript declarations, exports, class layout, or lifecycle behavior.
