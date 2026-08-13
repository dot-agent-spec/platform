---
vibe-ops-template: log@2
name: wasi-stub-removed-then-restored-vendored
description: wasi-stub was diagnosed as broken on Rust 1.95 and cut from the WASM build in favour of a
             JavaScript WASI shim; the removal did not hold, and it is back as a vendored 0.3.0-patched
             crate under tools/.
kind: trap
path:
  - "tools/wasi-stub/**"
  - "scripts/build-wasm.sh"
  - "packages/kernel-dsl/**"
attempted: 2026-06-27
source: the DA00-05 pre-release log, `git show 71cbf9f0755b60278eaf0dae3efaa640b25a815a:project/pre-release/v0.1/DA00-05-wasm-wasi-shim.md`
---

<!--
 Copyright (c) 2026 dot-agent Authors
 Licensed under the Apache-2.0 license — see LICENSE.
-->

# Removing wasi-stub from the WASM build and replacing it with a JavaScript WASI shim

> **Not current truth.** This records what was attempted on 2026-06-27 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

`wasi-stub 0.3.0` panicked while post-processing the `wasm32-wasip1` binary that `wasm-bindgen` produced
for `kernel-dsl`, on `random_get`:

```
called `Result::unwrap()` on an `Err` value: … kind: Custom("extra tokens remaining after parse")
snippet: "$wasi[6eddfa6c868d885d]::lib_generated::wasi_snapshot_preview1::random_get"
```

The diagnosis was that Rust's `wasm32-wasip1` standard library had moved to `wit-bindgen`-generated
bindings, which attach a crate-disambiguation hash in square brackets to the WAT text form of each
import, and that `wasi-stub`'s identifier parser does not accept `[...]`. Since `0.3.0` was the latest
release and the bug was unfixed upstream, **the fix was recorded as canonical**: delete the wasi-stub step
from `build-wasm.sh` and hand-write a `wasiShim` object covering all ten WASI functions into
`packages/kernel-dsl/index.js` and `index.browser.js` (commit `66425ef`).

## What happened

**It did not hold.** As of 2026-08-13 none of it is in the tree:

| The log claimed | Actual state |
|---|---|
| wasi-stub removed from `build-wasm.sh` | present and invoked, `scripts/build-wasm.sh:52-60` |
| `wasiShim` added to `packages/kernel-dsl/index.js` | the file does not exist |
| same for `index.browser.js` | the file does not exist |

`git grep wasiShim` finds the identifier in **no code at all** — only in the two pre-release documents that
described it. `tools/wasi-stub/` is now a vendored crate in this repository, `version = "0.3.0-patched"`,
sourced from the `typst-community/wasm-minimal-protocol` fork rather than the original repo, and
`ensure-license-headers.sh` excludes it from stamping as third-party.

## The mechanism

**Not established.** Three commits touch this and their titles suggest an order, but the causal link
between them was not verified and must not be assumed from the titles alone:

```
66425ef  fix(kernel-dsl): replace wasi-stub with JS WASI shim — Rust 1.95 compatibility
6f83368  fix(kernel-dsl,sdk): replace HashMap/HashSet with BTreeMap/BTreeSet in WASM path
6cd17e2  feat(DA00-06): unify build pipeline — tsup, ts-rs, central build-wasm.sh   ← added tools/wasi-stub/
```

What is worth noticing, and worth checking before trusting any of it: the original log identifies
`random_get` as needed **for HashMap seeding**, and `6f83368` removes `HashMap` from the WASM path
entirely. If that is what dissolved the panic, then the parser bug was real but was never the thing that
had to be fixed — and the JS shim was solving a problem that a data-structure change removed. That is a
hypothesis with a plausible shape, which is exactly the kind that gets believed without evidence.

## What to do instead

**Do not remove wasi-stub from the build again on the strength of the DA00-05 log.** It reads as a settled,
canonical fix and describes a state that was reversed.

If `wasi-stub` panics on a WAT identifier again, the vendored crate under `tools/wasi-stub/` is where the
patch lives — `cargo install --path tools/wasi-stub --force` rebuilds the binary the build script calls.
Check what changed there before concluding the upstream bug has returned.
