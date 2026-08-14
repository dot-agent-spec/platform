# Log

Write-once traps: *we tried this and it failed*. Each entry is addressed by the path where someone meets
it again, which is also how it retires — an entry whose `path:` no longer exists on disk is deleted.
Written with `/vibe-ops:new-log`, never by hand. The lifecycle is
[`.agents/rules/governance.md`](../../.agents/rules/governance.md).

## `.claude/`

- [`rm-on-a-bridge-symlink-reports-the-opposite-problem.md`](rm-on-a-bridge-symlink-reports-the-opposite-problem.md)
  — `rm` on a `.claude/` bridge symlink reports the failure mode of a Windows checkout, so the error text
  sends a reader to fix a problem they do not have.

## `tools/wasi-stub/`

- [`wasi-stub-removed-then-restored-vendored.md`](wasi-stub-removed-then-restored-vendored.md) — wasi-stub
  was diagnosed as broken on Rust 1.95 and cut from the WASM build in favour of a JavaScript WASI shim; the
  removal did not hold, and it is back as a vendored 0.3.0-patched crate under tools/.
