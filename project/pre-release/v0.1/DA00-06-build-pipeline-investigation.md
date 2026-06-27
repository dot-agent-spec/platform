<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DA00-06: Build Pipeline Fragmentation Investigation

| Field | Value |
|---|---|
| Status | Accepted |
| Created | 2026-06-27 |
| Author | Danilo Borges |
| Related | [ADR-0006](../adr/DA00-06-ts-rs-for-ast-json-contract.md), [DA00-06-ts-rs-implementation](../tasks/DA00-06-ts-rs-implementation.md) |

<!-- Package impact table — see rfcs/AGENTS.md for the symbol legend (— · ⚠️ · 🔄 · ?). -->

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) | language-server (L3) |
|---|---|---|---|---|---|
| 🔄 | 🔄 | 🔄 | 🔄 | 🔄 | — |

---

## Summary

The monorepo (`dot-agent-workspace`, npm workspaces over `packages/*`) ships six publishable packages. Three contain compiled artifacts (WebAssembly), three are pure TypeScript/JavaScript. They form a layered stack: tree-sitter grammars → Rust parser → Rust kernel → TypeScript compiler/SDK. This document is only about **how each artifact is produced**, not how they depend on each other at runtime (that is the subject of the companion brief, `package-architecture-investigation.md`).

This document captures the detailed research and investigation that led to the architectural decisions in **ADR-0006**. It records the state of how the `dot-agent` packages were built at the time of the investigation, serving as historical context for the build pipeline consolidation and the adoption of `ts-rs` for AST typings.

Every factual claim below was verified against the source on **2026-06-27** and cites the file it came from (paths are relative to `packages/`). Where something could not be confirmed, it is listed under **Open Questions**, not asserted.

---

## Motivation

Nine verified inconsistencies were found across the three build tracks:

1. Two divergent build definitions per Rust crate: `wasm-pack` (in `Cargo.toml` metadata, apparently unused) vs `cargo + wasm-bindgen + wasi-stub` (the shell script that actually runs).
2. Post-`wasm-bindgen` patching duplicated across parser-dsl (inline in `.sh`) and kernel-dsl (separate `.js`), with identical logic.
3. UBSan env-stubbing written three times (parser inline Proxy; kernel `index.js` named list; kernel `index.browser.js` named list).
4. Two WASM init wrappers in kernel-dsl (`index.js`, `index.browser.js`) that overlap heavily.
5. `build.rs` byte-identical across two crates.
6. Type generation: three approaches (none / hand-written stub / tsup-auto) across five packages.
7. `wasm-bindgen`'s rich `.d.ts` exists in `pkg/` but is shadowed by a thinner hand-written one.
8. A second kernel output dir (`pkg-web/`) existed, unreferenced by `package.json` (since deleted).
9. Independent package versions: tree-sitter `0.4.1`, kernel-dsl `0.1.3`, parser-dsl/compiler/sdk `0.1.0`.

---

## Specification

### 1. Inventory: one package, one toolchain

| Package | Language | Build toolchain | Build entry point | Type defs (`.d.ts`) |
|---|---|---|---|---|
| `tree-sitter` | C (generated) + Rust binding | `tree-sitter-cli` | `package.json` scripts | **none** |
| `parser-dsl` | Rust → WASM | `cargo` + `wasm-bindgen` CLI + `wasi-stub` | `scripts/build-wasm.sh` | manual stub |
| `kernel-dsl` | Rust → WASM | `cargo` + `wasm-bindgen` CLI + `wasi-stub` | `scripts/build-wasm.sh` + `scripts/patch-wasm-bindgen.js` | manual stub |
| `compiler` | TypeScript | `tsup` | `tsup.config.ts` | auto (`dts: true`) |
| `sdk` | TypeScript | `tsup` | `tsup.config.ts` | auto (`dts: true`) |
| `language-server` | JavaScript | none (direct ESM) | — | none |

There are effectively **three build tracks**. The rest of this section documents each, then catalogs the points where two packages on the *same* track diverge.

---

### 2. Track A — tree-sitter grammars (`tree-sitter-cli`)

- Two grammars: `tree-sitter-description` and `tree-sitter-behavior`.
- `package.json` scripts run `tree-sitter generate` then `tree-sitter build --wasm` per grammar, moving the output into `dist/`. Verified in `tree-sitter/package.json` (`build:wasm-description`, `build:wasm-behavior`).
- Output WASM sizes (verified on disk):
  - `dist/tree-sitter-behavior.wasm` — **31,504 bytes**
  - `dist/tree-sitter-description.wasm` — **42,659 bytes**
- A Rust binding also exists (`bindings/rust/src/lib.rs`), compiled via `cc` (`tree-sitter/Cargo.toml` → `[build-dependencies] cc`). It exposes `language_description()`, `language_behavior()`, and the constant `NODE_TYPES_BEHAVIOR` (`include_str!` of the behavior grammar's `node-types.json`).
- **No `index.d.ts`** and **no `types` field** in `tree-sitter/package.json`. The JS entry (`index.js`) exports only two filesystem paths: `descriptionWasmPath`, `behaviorWasmPath`.

#### Verified asymmetry inside tree-sitter
- The Rust lib exports `NODE_TYPES_BEHAVIOR` **but not** `NODE_TYPES_DESCRIPTION` (`bindings/rust/src/lib.rs` has only the behavior constant).
- `tree-sitter/Cargo.toml`'s `include` list ships only `tree-sitter-behavior/src/node-types.json` to crates.io — the description one is omitted.
- However, the **npm** `files` list *does* ship both grammars' `node-types.json`. So the description node-types JSON is present in the npm tarball but unreachable from Rust.

---

### 3. Track B — Rust → WASM (`parser-dsl`, `kernel-dsl`)

Both crates declare `crate-type = ["cdylib", "rlib"]` (verified in both `Cargo.toml`). The `cdylib` becomes the published WASM; the `rlib` is linked by the next Rust layer.

#### Two conflicting build definitions in the same crate
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

#### The WASI / browser-compat problem
- Building for `wasm32-wasip1` produces WASI imports that browsers can't satisfy.
- `wasi-stub` rewrites the `_bg.wasm` to remove those imports (comment in both scripts: "makes the WASM browser-compatible without a shim").
- Separately, **debug** builds emit UBSan instrumentation that imports named `__ubsan_*` symbols from `env`. The JS wrappers provide no-op stubs for these at instantiation time (see §3.3). Release builds compile them out.

#### WASM post-processing is duplicated, but implemented three different ways
The two crates need the *same* two JS patches after `wasm-bindgen`:
- **Patch 1:** strip the auto `import * as wasm from './..._bg.wasm'` / `__wbg_set_wasm(wasm)` lines so the WASM can be loaded manually (avoids webpack parse errors).
- **Patch 2:** fix a stale `Uint8Array` cache after `wasm.memory.grow` by adding `|| cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer` to the freshness check.

How each applies them:
- `parser-dsl` — inline `node -e "..."` block **inside** `scripts/build-wasm.sh`.
- `kernel-dsl` — a separate file `scripts/patch-wasm-bindgen.js` invoked after the shell script.

The patch logic is functionally identical; only the packaging differs.

#### Runtime init wrappers diverge too
- `parser-dsl/index.js` — single file. Detects environment inline (`typeof window`), fetches in browser / `node:fs/promises` in Node. UBSan stubs via a catch-all `new Proxy({}, { get: () => () => {} })`.
- `kernel-dsl/index.js` — Node+browser dual path (same `typeof window` branch). UBSan stubs as a **hardcoded list of 12 named** `__ubsan_*` handlers.
- `kernel-dsl/index.browser.js` — a **second**, near-identical wrapper, browser-only (drops the Node branch). Same 12 hardcoded UBSan handlers, duplicated again. `package.json` `exports` maps `"browser"` to this file.

So the same "load WASM + stub env + expose API" concern is hand-written **three times** with different env-detection and different UBSan-stub strategies.

#### `build.rs` is byte-for-byte identical across the two crates
`parser-dsl/build.rs` and `kernel-dsl/build.rs` are **identical** (verified with `diff` → no differences). Both `include`-import `NODE_TYPES_BEHAVIOR` from the tree-sitter crate and codegen a `node_kinds.rs` with `STATEMENT_KINDS`, `HANDLER_BLOCK_KINDS`, `STATE_BODY_KINDS`, `RESTRICTED_BLOCK_KINDS` plus `is_*_kind()` helpers.

#### Two kernel build outputs coexist
- `kernel-dsl/pkg/dot_agent_kernel_dsl_bg.wasm` — **2,272,385 bytes** (the published bundler target; embeds the parser-dsl rlib).
- `kernel-dsl/pkg-web/dot_agent_kernel_dsl_bg.wasm` — **1,830,452 bytes**, dated 2026-06-03 (older than `pkg/`).

`pkg-web/` was not referenced by `package.json` `files` or `exports` — confirmed abandoned and deleted (see Decisions Closed).

#### Verified WASM sizes (Track B)
- `parser-dsl/pkg/dot_agent_parser_dsl_bg.wasm` — **604,094 bytes**
- `kernel-dsl/pkg/dot_agent_kernel_dsl_bg.wasm` — **2,272,385 bytes**

---

### 4. Track C — TypeScript (`compiler`, `sdk`, `language-server`)

- `compiler` and `sdk` build with `tsup` (`format: ['esm','cjs']`, `dts: true`, `shims: true`, `sourcemap: true`, `clean: true`). Types are auto-generated from source.
- `compiler/tsup.config.ts` has **two** entry points: `src/index.ts` and `src/core.ts` (→ `./` and `./core` subpath exports).
- `sdk/tsup.config.ts` has **one** entry (`src/index.ts`) and marks `@dot-agent/compiler` + `@dot-agent/kernel-dsl` as `external`.
- `language-server` has no build step (ships JS source directly).

---

### 5. Type-generation strategy per package (verified)

| Package | How `.d.ts` is produced | Richness |
|---|---|---|
| `tree-sitter` | none | no types at all; consumers type-assert (`compiler/src/parser.ts:16` casts `require('@dot-agent/tree-sitter')`) |
| `parser-dsl` | hand-written `index.d.ts` (6 function signatures, all `string`-in/`string`-out) | thin; no Rust structs surfaced |
| `kernel-dsl` | hand-written `index.d.ts` (2 lines: re-export `AgentDSLKernel` + `init`) | thin |
| `compiler` | `tsup` auto from TS source | full |
| `sdk` | `tsup` auto from TS source | full |

Note: `wasm-bindgen` **does** emit rich `.d.ts` into `pkg/` (e.g. `kernel-dsl/pkg-web/dot_agent_kernel_dsl.d.ts` is 6,582 bytes). The published root `index.d.ts` does not re-use it — it is hand-written and thinner.

---

## Rationale

The nine inconsistencies documented above share a root cause: each package evolved its build toolchain independently, with no shared infrastructure. The proposed consolidation addresses all nine by:

- **Unifying JS/TS packaging under `tsup`** — eliminates the three different type-generation strategies and the hand-written stubs.
- **Replacing `wasi-stub` with an embedded `wasiShim`** — `wasi-stub` breaks on Rust 1.95+ (wit-bindgen name hashes); the JS shim is self-contained and version-independent.
- **Extracting shared `build.rs`** — a single file via `#[path]` eliminates the byte-identical duplication and ensures both crates always have the same node-kind codegen.
- **Adopting `ts-rs`** — the Rust AST structs are the formal single source of truth for the JSON contract crossing the WASM boundary (see ADR-0006); `node-types.json` describes the CST and cannot express the cleaned AST or the WASM response envelope.

---

## Implementation Notes

To resolve all inconsistencies, the monorepo will migrate all JS/TS packages (including `tree-sitter`, `parser-dsl`, and `kernel-dsl`) to **`tsup`**.

### Track A: `tree-sitter` (Unified JS/TS Wrapper)
- **Directory Layout**:
  ```
  packages/tree-sitter/
  ├── src/
  │   └── index.ts (TypeScript entry)
  ├── dist/ (Output from tsup: index.js, index.cjs, index.d.ts, wasm files)
  ├── tsup.config.ts
  └── package.json
  ```
- **tsup Configuration**:
  ```typescript
  import { defineConfig } from 'tsup';
  import fs from 'node:fs';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    async onSuccess() {
      fs.copyFileSync('tree-sitter-behavior/dist/tree-sitter-behavior.wasm', 'dist/tree-sitter-behavior.wasm');
      fs.copyFileSync('tree-sitter-description/dist/tree-sitter-description.wasm', 'dist/tree-sitter-description.wasm');
    }
  });
  ```
- **TypeScript Entry (`src/index.ts`)**:
  ```typescript
  import path from 'node:path';
  export const behaviorWasmPath = path.join(__dirname, 'tree-sitter-behavior.wasm');
  export const descriptionWasmPath = path.join(__dirname, 'tree-sitter-description.wasm');
  ```
- Gives the `tree-sitter` package an automatic, clean `.d.ts` file (resolves Inconsistency 6).

### Track B: Rust ➔ WASM (`parser-dsl`, `kernel-dsl`)
- Bypasses `wasi-stub` in `build-wasm.sh` and uses the `wasiShim` inside a TypeScript-based loader wrapper (`src/ts/index.ts`) compiled with `tsup`.
- `tsup` compiles the TS wrappers to CJS/ESM. The root `index.d.ts` is composed from two sources: `wasm-bindgen`'s `pkg/*.d.ts` (WASM function signatures) and `ts-rs`-generated `.ts` files (payload types — `BehaviorFile`, `DescriptionFile`, `Effect`, etc.), completely eliminating handwritten stubs.

### Shared Build Infrastructure (`build.rs` and Post-Processing)
- Move duplicate `build.rs` logic into a root-level shared file (`scripts/shared_build.rs`) and reference it in Cargo crates via `#[path = "../../scripts/shared_build.rs"]`.
- Delete stale `wasm-pack` build definitions from `Cargo.toml`.
- Remove `index.browser.js` in favor of a single `index.js` compiled by `tsup` that resolves Node/browser targets at runtime.

---

## Open Questions

None — all questions raised during investigation are resolved in **Decisions Closed** below.

---

## Decisions Closed

- **Is the `wasm-pack` definition in `[package.metadata.scripts]` dead, or used by some workflow not found here?**
  - **Dead.** It is completely unused. The active pipeline runs via `build-wasm.sh`. Action: Delete these metadata sections from `Cargo.toml`.
- **Is `kernel-dsl/pkg-web/` a maintained target or an abandoned artifact? What produced it?**
  - **Abandoned.** It has been deleted.
- **Could the two `build.rs` files, the UBSan stubs, the wasm-bindgen patches, and the init wrappers share a single source?**
  - **Yes.** We will share `build.rs` via a path inclusion (`#[path = "../../scripts/shared_build.rs"]`), and unify the WASM loader and post-processing patches by compiling a TypeScript-based loader wrapper with `tsup`.
- **Why is `wasm-bindgen`'s generated rich `.d.ts` not the published one? Is the hand-written stub intentional or legacy?**
  - **Legacy.** We will migrate both `parser-dsl` and `kernel-dsl` to a TypeScript wrapper built with `tsup`, which auto-generates the root `index.d.ts` without manual stubs.
- **Should `tree-sitter` have a `.d.ts`? What is the cost of the current type-assertion in `compiler/src/parser.ts`?**
  - **Yes.** We will add a small `index.d.ts` to `packages/tree-sitter/` to allow importing without type-assertions in the compiler.
- **Is `wasm32-wasip1 + wasi-stub` the only viable target, or would `wasm32-unknown-unknown` simplify the chain?**
  - **`wasm32-wasip1` is required** because tree-sitter depends on POSIX C headers (`<stdio.h>`). However, since `wasi-stub` crashes on Rust 1.95+ due to wit-bindgen name hashes, we will bypass `wasi-stub` and use an embedded JS `wasiShim` in the wrappers for both WASM packages.
- **The `Zig CC` mentioned in the build-script comments — where is it actually configured?**
  - Configured at the workspace root [`.cargo/config.toml`](../../../.cargo/config.toml) (lines 5-8).
- **How do we share the language AST types (e.g., `BehaviorFile`) across packages without creating multiple sources of truth?**
  - **`ts-rs` on the Rust AST structs (chosen; see ADR-0006).** `node-types.json` describes the tree-sitter CST — raw grammar nodes (`behavior_file`, `block`, `run_stmt`, …) with anonymous children — which does not match the cleaned JSON that actually crosses the WASM boundary. The `BehaviorFile`, `DescriptionFile`, and `Effect` types are the product of an explicit CST→AST transformation in Rust, with serde renames (`#[serde(tag = "type", rename_all = "snake_case")]`) that the CST schema has no knowledge of. The outer response envelope (`{ "ok": BehaviorFile | null, "diagnostics": [...] }`) and the runtime `Effect` enum have no CST equivalent at all. Deriving types from `node-types.json` would therefore require a separate mapping layer — exactly the duplicate source of truth it was meant to avoid. We add `#[derive(TS)]` to the relevant Rust structs in `parser-dsl/src/ast.rs` and `kernel-dsl/src/effect.rs`, making those structs the formal single source of truth; the generated `.ts` files are bundled by `tsup` into the root `index.d.ts`.

---

## Related

- [ADR-0006 — Use ts-rs as the Single Source of Truth for AST JSON Contracts](../adr/DA00-06-ts-rs-for-ast-json-contract.md)
- [DA00-06 Implementation Task](../tasks/DA00-06-ts-rs-implementation.md)
- `package-architecture-investigation.md` — companion brief on runtime dependency structure
