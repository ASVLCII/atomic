# @bastani/atomic-natives

Native Rust bindings for Atomic via N-API.

Rust code lives in `crates/atomic-natives`, while this package contains the generated NAPI-RS JavaScript loader (`native/index.js`), generated TypeScript declarations (`native/index.d.ts`), and release-time optional platform packages.

The bindings provide a Rust-backed PTY session for `bash` calls with `pty: true`, plus native `glob`, `grep`, and `search` operations for Atomic's built-in `find` and `search` tools.
