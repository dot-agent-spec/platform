

## `tools/wasi-stub/`

- [`wasi-stub-removed-then-restored-vendored.md`](wasi-stub-removed-then-restored-vendored.md) — wasi-stub
  was diagnosed as broken on Rust 1.95 and cut from the WASM build in favour of a JavaScript WASI shim; the
  removal did not hold, and it is back as a vendored 0.3.0-patched crate under tools/.
