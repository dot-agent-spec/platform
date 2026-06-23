<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Investigation Brief: Build Pipeline Fragmentation

> **Purpose of this document.** This is a *research brief* meant to be read with **zero prior context**. It records the **current, verified state** of how the `dot-agent` packages are built — nothing else. It contains **no recommendations and no decisions**: the goal is to give a fresh investigation an accurate, unbiased starting point so it can form its own conclusions.
>
> Every factual claim below was verified against the source on **2026-06-22** and cites the file it came from (paths are relative to `packages/`). Where something could not be confirmed, it is listed under **Open questions**, not asserted.

---

## 1. What is being built

The monorepo (`dot-agent-workspace`, npm workspaces over `packages/*`) ships six publishable packages. Three contain compiled artifacts (WebAssembly), three are pure TypeScript/JavaScript. They form a layered stack: tree-sitter grammars → Rust parser → Rust kernel → TypeScript compiler/SDK. This brief is only about **how each artifact is produced**, not how they depend on each other at runtime (that is the subject of the companion brief, `package-architecture-investigation.md`).

---

## 2. Inventory: one package, one toolchain

| Package | Language | Build toolchain | Build entry point | Type defs (`.d.ts`) |
|---|---|---|---|---|
| `tree-sitter` | C (generated) + Rust binding | `tree-sitter-cli` | `package.json` scripts | **none** |
| `parser-dsl` | Rust → WASM | `cargo` + `wasm-bindgen` CLI + `wasi-stub` | `scripts/build-wasm.sh` | manual stub |
| `kernel-dsl` | Rust → WASM | `cargo` + `wasm-bindgen` CLI + `wasi-stub` | `scripts/build-wasm.sh` + `scripts/patch-wasm-bindgen.js` | manual stub |
| `compiler` | TypeScript | `tsup` | `tsup.config.ts` | auto (`dts: true`) |
| `sdk` | TypeScript | `tsup` | `tsup.config.ts` | auto (`dts: true`) |
| `language-server` | JavaScript | none (direct ESM) | — | none |

There are effectively **three build tracks**. The rest of this brief documents each, then catalogs the points where two packages on the *same* track diverge.

---

## 3. Track A — tree-sitter grammars (`tree-sitter-cli`)

- Two grammars: `tree-sitter-description` and `tree-sitter-behavior`.
- `package.json` scripts run `tree-sitter generate` then `tree-sitter build --wasm` per grammar, moving the output into `dist/`. Verified in `tree-sitter/package.json` (`build:wasm-description`, `build:wasm-behavior`).
- Output WASM sizes (verified on disk):
  - `dist/tree-sitter-behavior.wasm` — **31,504 bytes**
  - `dist/tree-sitter-description.wasm` — **42,659 bytes**
- A Rust binding also exists (`bindings/rust/src/lib.rs`), compiled via `cc` (`tree-sitter/Cargo.toml` → `[build-dependencies] cc`). It exposes `language_description()`, `language_behavior()`, and the constant `NODE_TYPES_BEHAVIOR` (`include_str!` of the behavior grammar's `node-types.json`).
- **No `index.d.ts`** and **no `types` field** in `tree-sitter/package.json`. The JS entry (`index.js`) exports only two filesystem paths: `descriptionWasmPath`, `behaviorWasmPath`.

### Verified asymmetry inside tree-sitter
- The Rust lib exports `NODE_TYPES_BEHAVIOR` **but not** `NODE_TYPES_DESCRIPTION` (`bindings/rust/src/lib.rs` has only the behavior constant).
- `tree-sitter/Cargo.toml`'s `include` list ships only `tree-sitter-behavior/src/node-types.json` to crates.io — the description one is omitted.
- However, the **npm** `files` list *does* ship both grammars' `node-types.json`. So the description node-types JSON is present in the npm tarball but unreachable from Rust.

---

## 4. Track B — Rust → WASM (`parser-dsl`, `kernel-dsl`)

Both crates declare `crate-type = ["cdylib", "rlib"]` (verified in both `Cargo.toml`). The `cdylib` becomes the published WASM; the `rlib` is linked by the next Rust layer.

### Two conflicting build definitions in the same crate
Each crate documents its build **twice, differently**:

1. `Cargo.toml` → `[package.metadata.scripts]` says:
   `build = "wasm-pack build --target bundler"` (kernel) / `"wasm-pack build --target bundler --out-dir pkg --out-name parser-dsl"` (parser).
2. `package.json` → `scripts.build` actually runs `./scripts/build-wasm.sh` (parser) or `./scripts/build-wasm.sh && node scripts/patch-wasm-bindgen.js` (kernel).

The shell script does **not** use `wasm-pack`. It runs:
```
cargo build --target wasm32-wasip1 [--release]
wasm-bindgen --target bundler --out-dir ./pkg <built>.wasm
wasi-stub pkg/<name>_bg.wasm -o pkg/<name>_bg.wasm
```
So the `wasm-pack` line in `[package.metadata.scripts]` appears to be a stale/unused alternate definition. The real pipeline is **cargo + wasm-bindgen CLI + wasi-stub**, targeting `wasm32-wasip1`. (Verified in `parser-dsl/scripts/build-wasm.sh` and `kernel-dsl/scripts/build-wasm.sh`.)

### The WASI / browser-compat problem
- Building for `wasm32-wasip1` produces WASI imports that browsers can't satisfy.
- `wasi-stub` rewrites the `_bg.wasm` to remove those imports (comment in both scripts: "makes the WASM browser-compatible without a shim").
- Separately, **debug** builds emit UBSan instrumentation that imports named `__ubsan_*` symbols from `env`. The JS wrappers provide no-op stubs for these at instantiation time (see §4.3). Release builds compile them out.

### WASM post-processing is duplicated, but implemented three different ways
The two crates need the *same* two JS patches after `wasm-bindgen`:
- **Patch 1:** strip the auto `import * as wasm from './..._bg.wasm'` / `__wbg_set_wasm(wasm)` lines so the WASM can be loaded manually (avoids webpack parse errors).
- **Patch 2:** fix a stale `Uint8Array` cache after `wasm.memory.grow` by adding `|| cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer` to the freshness check.

How each applies them:
- `parser-dsl` — inline `node -e "..."` block **inside** `scripts/build-wasm.sh`.
- `kernel-dsl` — a separate file `scripts/patch-wasm-bindgen.js` invoked after the shell script.

The patch logic is functionally identical; only the packaging differs.

### Runtime init wrappers diverge too
- `parser-dsl/index.js` — single file. Detects environment inline (`typeof window`), fetches in browser / `node:fs/promises` in Node. UBSan stubs via a catch-all `new Proxy({}, { get: () => () => {} })`.
- `kernel-dsl/index.js` — Node+browser dual path (same `typeof window` branch). UBSan stubs as a **hardcoded list of 12 named** `__ubsan_*` handlers.
- `kernel-dsl/index.browser.js` — a **second**, near-identical wrapper, browser-only (drops the Node branch). Same 12 hardcoded UBSan handlers, duplicated again. `package.json` `exports` maps `"browser"` to this file.

So the same "load WASM + stub env + expose API" concern is hand-written **three times** with different env-detection and different UBSan-stub strategies.

### `build.rs` is byte-for-byte identical across the two crates
`parser-dsl/build.rs` and `kernel-dsl/build.rs` are **identical** (verified with `diff` → no differences). Both `include`-import `NODE_TYPES_BEHAVIOR` from the tree-sitter crate and codegen a `node_kinds.rs` with `STATEMENT_KINDS`, `HANDLER_BLOCK_KINDS`, `STATE_BODY_KINDS`, `RESTRICTED_BLOCK_KINDS` plus `is_*_kind()` helpers.

### Two kernel build outputs coexist
- `kernel-dsl/pkg/dot_agent_kernel_dsl_bg.wasm` — **2,272,385 bytes** (the published bundler target; embeds the parser-dsl rlib).
- `kernel-dsl/pkg-web/dot_agent_kernel_dsl_bg.wasm` — **1,830,452 bytes**, dated 2026-06-03 (older than `pkg/`).

`pkg-web/` is not referenced by `package.json` `files` or `exports`. Whether it is a maintained second target or an abandoned artifact is unconfirmed (see Open questions).

### Verified WASM sizes (Track B)
- `parser-dsl/pkg/dot_agent_parser_dsl_bg.wasm` — **604,094 bytes**
- `kernel-dsl/pkg/dot_agent_kernel_dsl_bg.wasm` — **2,272,385 bytes**

---

## 5. Track C — TypeScript (`compiler`, `sdk`, `language-server`)

- `compiler` and `sdk` build with `tsup` (`format: ['esm','cjs']`, `dts: true`, `shims: true`, `sourcemap: true`, `clean: true`). Types are auto-generated from source.
- `compiler/tsup.config.ts` has **two** entry points: `src/index.ts` and `src/core.ts` (→ `./` and `./core` subpath exports).
- `sdk/tsup.config.ts` has **one** entry (`src/index.ts`) and marks `@dot-agent/compiler` + `@dot-agent/kernel-dsl` as `external`.
- `language-server` has no build step (ships JS source directly).

---

## 6. Type-generation strategy per package (verified)

| Package | How `.d.ts` is produced | Richness |
|---|---|---|
| `tree-sitter` | none | no types at all; consumers type-assert (`compiler/src/parser.ts:16` casts `require('@dot-agent/tree-sitter')`) |
| `parser-dsl` | hand-written `index.d.ts` (6 function signatures, all `string`-in/`string`-out) | thin; no Rust structs surfaced |
| `kernel-dsl` | hand-written `index.d.ts` (2 lines: re-export `AgentDSLKernel` + `init`) | thin |
| `compiler` | `tsup` auto from TS source | full |
| `sdk` | `tsup` auto from TS source | full |

Note: `wasm-bindgen` **does** emit rich `.d.ts` into `pkg/` (e.g. `kernel-dsl/pkg-web/dot_agent_kernel_dsl.d.ts` is 6,582 bytes). The published root `index.d.ts` does not re-use it — it is hand-written and thinner.

---

## 7. Catalog of verified inconsistencies

1. Two divergent build definitions per Rust crate: `wasm-pack` (in `Cargo.toml` metadata, apparently unused) vs `cargo + wasm-bindgen + wasi-stub` (the shell script that actually runs).
2. Post-`wasm-bindgen` patching duplicated across parser-dsl (inline in `.sh`) and kernel-dsl (separate `.js`), with identical logic.
3. UBSan env-stubbing written three times (parser inline Proxy; kernel `index.js` named list; kernel `index.browser.js` named list).
4. Two WASM init wrappers in kernel-dsl (`index.js`, `index.browser.js`) that overlap heavily.
5. `build.rs` byte-identical across two crates.
6. Type generation: three approaches (none / hand-written stub / tsup-auto) across five packages.
7. `wasm-bindgen`'s rich `.d.ts` exists in `pkg/` but is shadowed by a thinner hand-written one.
8. A second kernel output dir (`pkg-web/`) exists, unreferenced by `package.json`.
9. Independent package versions: tree-sitter `0.4.1`, kernel-dsl `0.1.3`, parser-dsl/compiler/sdk `0.1.0`.

---

## 8. Open questions (to be investigated, not yet answered)

- Is the `wasm-pack` definition in `[package.metadata.scripts]` dead, or used by some workflow not found here?
- Is `kernel-dsl/pkg-web/` a maintained target or an abandoned artifact? What produced it (it predates `pkg/`)?
- Could the two `build.rs` files, the UBSan stubs, the wasm-bindgen patches, and the init wrappers share a single source? What is the smallest shared surface?
- Why is `wasm-bindgen`'s generated rich `.d.ts` not the published one? Is the hand-written stub intentional (e.g. to hide internals) or just legacy?
- Should `tree-sitter` have a `.d.ts`? What is the cost of the current type-assertion in `compiler/src/parser.ts`?
- Is `wasm32-wasip1 + wasi-stub` the only viable target, or would `wasm32-unknown-unknown` (no WASI to strip) simplify the chain? What forces WASI today?
- The `Zig CC` mentioned in the build-script comments — where is it actually configured? (Not found in a `.cargo/config.toml` during this pass.)

---

*Companion brief: `package-architecture-investigation.md` (runtime dependency structure).*
