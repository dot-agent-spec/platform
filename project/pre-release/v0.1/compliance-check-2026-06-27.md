# Compliance Check — 2026-06-27

Pre-release build, test, and packaging verification across all workspace packages.
Basis: `dot-agent-spec/scripts/release.mjs` Phase 0–3 (no commits, no tags, no publish).

Environment: Rust 1.95.0 · wasm-bindgen 0.2.122 · Node 26.3.0 · npm 11.16.0

---

## Summary

| Package | Tests | Build (debug) | Build (release) | Notes |
|---|---|---|---|---|
| `tree-sitter` 0.4.1 | ✅ 42 | ✅ | ✅ | Docker amd64→arm64 warning (Rosetta); 3 fixes applied |
| `parser-dsl` 0.1.0 | ✅ 48 | ✅ | ✅ | 1 fix applied |
| `kernel-dsl` 0.1.3 | ✅ 14 + node-compat 4/4 | ✅ | ✅ | 1 fix applied; P2 + P3 resolved (2026-06-27) |
| `compiler` 0.1.0 | ✅ 129 | ✅ | ✅ | 1 fix applied |
| `sdk` 0.1.0 | ✅ 7/7 | ✅ | — | 1 fix applied; P3 resolved (2026-06-27) |
| `language-server` 0.4.1 | ✅ 60 | n/a | — | no build step; runs from source |

TypeScript `tsc --noEmit`: ✅ compiler · ✅ sdk  
Cargo clippy `--workspace` (native + wasm32-wasip1): ✅ clean

---

## Fixes Applied During This Check

### F1 · `tree-sitter`: missing `tsconfig.json` → DTS build failed
- **File:** `packages/tree-sitter/tsconfig.json` (created)
- **Root cause:** No tsconfig → `@types/node` not resolved → `__dirname` and `path` module invisible to TypeScript DTS worker.
- **Fix:** Added tsconfig with `"types": ["node"]`, `"esModuleInterop": true`.

### F2 · `tree-sitter`: `import path from 'path'` without esModuleInterop
- **File:** `packages/tree-sitter/src/index.ts:9`
- **Fix:** Changed to `import * as path from 'path'` (namespace import, no esModuleInterop needed).

### F3 · `tree-sitter`: `exports` condition order — `types` after `import`/`require`
- **File:** `packages/tree-sitter/package.json`
- **Fix:** Moved `"types"` condition before `"import"` and `"require"` in the exports map.

### F4 · `tree-sitter`: `main`/`module`/`require` pointed to non-existent `dist/index.cjs`
- **File:** `packages/tree-sitter/package.json`
- **Root cause:** Package has no `"type": "module"` → tsup emits CJS as `.js` and ESM as `.mjs`, but `main` pointed to `.cjs`.
- **Fix:** `"main": "dist/index.js"` (CJS), `"module": "dist/index.mjs"` (ESM), exports updated to match.
- **Note:** Did not add `"type": "module"` because `scripts/clean.js` uses `require()` and would break.

### F5 · `parser-dsl`: ts-rs AST types not exported from public API
- **File:** `packages/parser-dsl/src/ts/index.ts`
- **Root cause:** `bindings/` directory (24 ts-rs generated files) existed but was never re-exported, so consumers like `compiler` couldn't import `OntologyRef`, `BehaviorFile`, etc.
- **Fix:** Added `export type { X } from '../../bindings/X'` for all 24 binding types.

### F6 · `compiler`: `AnnotatedRef` not in local scope
- **File:** `packages/compiler/src/types.ts`
- **Root cause:** `export type { AnnotatedRef } from '@dot-agent/parser-dsl'` re-exports the type but does not bind it locally. Lines 80 and 110 used `AnnotatedRef` in interface bodies.
- **Fix:** Split into `import type { ... }` + `export type { ... }` so the name is available in scope.

### F7 · `kernel-dsl`: WASM URL uses source-relative path (`../../pkg/`) instead of dist-relative (`../pkg/`)
- **File:** `packages/kernel-dsl/src/ts/index.ts:8`
- **Root cause:** `new URL('../../pkg/...', import.meta.url)` is correct from `src/ts/` but tsup does not rewrite `new URL()` relative paths when moving the output to `dist/`. Result: runtime resolved `packages/pkg/` instead of `packages/kernel-dsl/pkg/`.
- **Fix:** Changed to `'../pkg/dot_agent_kernel_dsl_bg.wasm'` (matches `parser-dsl` convention).
- **Impact:** Fixed 1 previously-passing SDK test (`AgentSession.create`) that was failing with ENOENT.

---

## Post-Check Fixes (2026-06-27)

### P3 · WASM `RuntimeError: unreachable` in SDK tests — RESOLVED

Root cause confirmed: `HashMap::new()` / `HashSet::new()` in the WASM path call `hashmap_random_keys()` → `random_get` WASI stub → stub returns `i32.const 0` without filling the buffer pointer → Rust `unwrap_failed` panic → `proc_exit` stub returns 0 instead of trapping → execution falls through to a compiler-inserted WASM `unreachable`.

The compiled `dot_agent_kernel_dsl_bg.wasm` has **zero WASI imports** (confirmed via `WebAssembly.Module.imports()`) — all WASI functions are internal stubs from wasi-stub. No JS-level WASI shim is involved.

Fix: replaced `HashMap`/`HashSet` with `BTreeMap`/`BTreeSet` in the two kernel WASM-path locations:
- `packages/kernel-dsl/src/lib.rs:97` — bundle deserialization in `load_behavior_with_bundle`
- `packages/kernel-dsl/src/engine/mod.rs:18,48,54` — `load_behavior_with_bundle` and `flatten_merges` signatures + cycle detection set

`BTreeMap`/`BTreeSet` use deterministic tree ordering and never call `random_get`. `memory.rs` and `fsm.rs` already used `BTreeMap` and required no changes.

Secondary fix: SDK test `BEHAVIOR` constant and both behavior strings in `node-compat.test.js` lacked `state init`, which `Fsm::new()` requires (E016). All renamed to `state init`; cross-state references and assertions updated accordingly.

**Results:** SDK tests **7/7** (was 3/7). kernel-dsl Rust tests **14/14** (no regression).

### P2 · `kernel-dsl` `test:node` import path — RESOLVED

Changed `packages/kernel-dsl/tests/node-compat.test.js` line 1:
```js
// before
import { init, AgentDSLKernel } from '../index.js'
// after
import { init, AgentDSLKernel } from '../dist/index.js'
```

**Result:** node-compat tests **4/4** (was `ERR_MODULE_NOT_FOUND`).

### D · Contributor docs: wasi-stub install step — RESOLVED

`CONTRIBUTING.md` created at workspace root. Covers: wasi-stub install (`cargo install --path tools/wasi-stub --force`), Docker/OrbStack requirement for tree-sitter WASM, build and test commands.

---

## Pre-existing Issues (not introduced by this check)

### P1 · `kernel-dsl` dead code warnings (Rust)
- `lib.rs:32` — `fn dispatch` never called externally (internal helper)
- `engine/memory.rs` — `MemoryStore::get`, `clear_context`, `clear_worksession` unused
- **Severity:** Warning only. Clippy is clean (warnings surface only under `cargo test`).
- **Action:** Remove or use in v0.2 when memory read API is exposed.

### P2 · `kernel-dsl`: `test:node` imports non-existent root `index.js`
- **File:** `packages/kernel-dsl/tests/node-compat.test.js:1`
- `import { init, AgentDSLKernel } from '../index.js'` — no root `index.js` exists; entry is `dist/index.js`.
- **Severity:** Test script fails with `ERR_MODULE_NOT_FOUND`.
- **Action:** Fix import to `'./dist/index.js'` or `'@dot-agent/kernel-dsl'`.

### P3 · `sdk` + `dot-agent-cli`: 4/7 SDK tests fail with WASM `RuntimeError: unreachable`
- **Failing:** `AgentSession.start()`, `sendIntent`, `getValidIntents`, `getGraph`
- **Root cause:** Two interlocked wasi-stub issues with Rust 1.95:
  1. `hashmap_random_keys` → `getrandom` → `random_get` stub → `unwrap_failed` panic → `abort` stub → `unreachable` trap
  2. Panic hook tries `getenv("RUST_BACKTRACE")` → `__wasilibc_initialize_environ` → `proc_exit` stub → `unreachable` trap
- **Context:** The debug WASM is the primary test target. These failures affect any call into kernel functions that initialise Rust `HashMap` (e.g., `load_behavior_with_bundle`, `send_intent`).
- **Workaround candidates:** Implement `random_get` stub to actually fill the buffer with dummy bytes; or add `RUSTFLAGS="-C target-feature=+bulk-memory"` to disable default hasher randomisation.
- **Severity:** Blocks SDK integration testing end-to-end. Core Rust tests (14 kernel + 48 parser-dsl) pass on native target.

### P4 · `tree-sitter` WASM build: Docker platform mismatch warning
- `linux/amd64` image used on `linux/arm64/v8` host (M-series Mac via Rosetta).
- Build succeeds. Pure informational warning from Docker.
- **Action:** Switch to `--platform linux/arm64` image or use native emcc when available.

### P5 · `zig` compiler detection failure in `cc` crate (WASM builds)
- Appears in every `cargo build --target wasm32-wasip1` run.
- `cc` crate probes `zig -E` as a compiler family detector; zig is not in PATH.
- Build falls back to LLVM/clang and succeeds. Noise only.
- **Action:** Suppress by setting `CC_wasm32_wasip1=clang` in the build environment, or ignore.

### P6 · `language-server` has no build step
- `package.json` has no `build` script; `"main": "server.js"` points to source.
- No `dist/` directory. Acceptable for a process-based LSP server, but inconsistent with other packages.
- **Action:** Decide whether to add a tsup build or document intentionally unbundled.

---

## Version Status (pending first publish)

Current versions diverge per DA00-02 (two-axis policy):

| Package | Current | Target (first publish) |
|---|---|---|
| `tree-sitter` | 0.4.1 | 0.10.0 |
| `parser-dsl` | 0.1.0 | 0.10.0 |
| `kernel-dsl` | 0.1.3 | 0.10.0 |
| `compiler` | 0.1.0 | 0.10.0 |
| `sdk` | 0.1.0 | 0.10.0 |
| `language-server` | 0.4.1 | 0.10.0 |

Action: bump all to `0.10.0` at publish time (mirrors DSL v0.1 milestone).

---

## Verdict

**All packages build and test green.** Fixes F1–F7 resolved build-time errors. Post-check fixes resolved all runtime blocking items.

Blocking items before publish:
- [x] Fix SDK runtime issue (P3 — `random_get`/`proc_exit` stubs with Rust 1.95) — **RESOLVED 2026-06-27**
- [x] Fix `kernel-dsl` test:node import path (P2) — **RESOLVED 2026-06-27**
- [x] Publish `wasi-stub` install step to contributor docs — **RESOLVED 2026-06-27** (`CONTRIBUTING.md`)
- [ ] Bump all packages to `0.10.0` (version axis policy — DA00-02)
