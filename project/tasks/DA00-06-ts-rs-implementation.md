<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Consolidate Build Pipeline & Adopt ts-rs

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-06-27 |
| Closed | 2026-06-27 |
| Author | Danilo Borges |
| Sources | [DA00-06 Build Pipeline Investigation](../pre-release/v0.1/DA00-06-build-pipeline-investigation.md), [ADR-0006](../adr/DA00-06-ts-rs-for-ast-json-contract.md) |

---

This task outlines the complete execution plan to fix the build pipeline fragmentation across all packages (Track A, B, and C) as defined in the `build-pipeline-investigation.md` log and ADR-0006.

## Execution Plan

### 1. Track A: `tree-sitter` (Unified JS/TS Wrapper)
- **Setup tsup**: Add `tsup` and `@types/node` as devDependencies.
- **Entry point**: Create `src/index.ts` to export `behaviorWasmPath` and `descriptionWasmPath`.
- **Config**: Create `tsup.config.ts` to build the TS wrapper and copy the `.wasm` files to `dist/` on success.
- **Cleanup**: Remove old manual file copy scripts from `package.json` if applicable and update `main`/`types` to point to `dist/`.

### 2. Track B: Rust → WASM (`parser-dsl`, `kernel-dsl`)
- **Shared Build**: Move duplicate `build.rs` logic into a root-level `scripts/shared_build.rs` and reference it in both crates via `#[path = "../../scripts/shared_build.rs"]`.
- **Clean Cargo.toml**: Delete the stale `[package.metadata.scripts]` (wasm-pack) definitions from both `Cargo.toml` files.
- **WASI Shim**: Modify `scripts/build-wasm.sh` in both packages to completely remove the `wasi-stub` step (which breaks on Rust 1.95).
- **TS Loaders**: Create `src/ts/index.ts` in both packages to wrap the WASM initialization. This wrapper must include the custom `wasiShim` and the hardcoded UBSan stubs. Delete the old `index.js`, `index.browser.js`, and `patch-wasm-bindgen.js`.
- **ts-rs Integration (ADR-0006)**:
  - Add `ts-rs` to both crates.
  - `parser-dsl`: Add `#[derive(TS)]` to AST structs in `src/ast.rs`.
  - `kernel-dsl`: Add `#[derive(TS)]` to `Effect` in `src/effect.rs`.
  - Ensure the Cargo build outputs the `.ts` bindings.
- **Setup tsup**: Add `tsup.config.ts` to both packages to compile the `src/ts/index.ts` wrapper and inline/bundle the `ts-rs` generated types into a clean `index.d.ts`.

### 3. Track C: TS Consumers (`compiler`, `sdk`, `language-server`)
- **Cleanup**: Delete the handwritten AST types (e.g., `compiler/src/types.ts`).
- **Update Imports**: Update all imports in `compiler`, `sdk`, and `language-server` to consume the single source of truth types exported natively by `@dot-agent/parser-dsl` and `@dot-agent/kernel-dsl`.
- **Verify**: Ensure the consumers' `tsup` (if applicable) can successfully resolve and type-check against the newly generated types.

---

## Implementation Log (2026-06-27)

### What was done

**Track A — tree-sitter**
- `src/index.ts` criado, exporta `behaviorWasmPath` / `descriptionWasmPath` via `path.resolve(__dirname)`
- `tsup.config.ts` com `clean: false` (preserva `.wasm` gerado pelo tree-sitter-cli)
- `package.json` atualizado: `main/module/types → dist/`; `index.js` removido

**Track B — Rust→WASM**
- `scripts/shared_build.rs` criado; `build.rs` de ambos os crates redireciona via `#[path]`
- `Cargo.toml` dos dois crates: removido `[package.metadata.scripts]` (wasm-pack morto); adicionado `ts-rs = "10"` com `serde-compat`
- `#[derive(TS)] #[ts(export)]` adicionado em todos os tipos públicos de `ast.rs` e `effect.rs`
- `scripts/build-wasm.sh` **centralizado** em `scripts/build-wasm.sh` (parâmetro `CRATE_NAME`); scripts per-package e helpers removidos (`patch-wasm-bindgen.js`, `create-pkg-manifest.js`, `discover-wasm-imports.js`)
- wasi-stub **restaurado** em parser-dsl e **adicionado** ao kernel-dsl (B4)
- `src/ts/index.ts` mínimo em ambos os pacotes: `envStubs` Proxy + `init()` com `new URL` + re-exports de `pkg/`; sem wasiShim em runtime
- `tsup.config.ts` criado em ambos; `tsconfig.json` adicionado com `moduleResolution: Bundler` e `noImplicitAny: false` (necessário porque `_bg.js` do wasm-bindgen não tem `.d.ts`)
- `package.json` de ambos: `exports` com `types` primeiro; `files: ["dist/"]`

**Track C — compiler**
- `compiler/src/types.ts`: 10 tipos AST removidos; re-exportados de `@dot-agent/parser-dsl` via passthrough
- `BehaviorStatement` → `Statement` em `compiler/src/index.ts`
- Build order da raiz explicitado sem Turborepo: `tree-sitter → parser-dsl → kernel-dsl → compiler → sdk → language-server → dot-agent-cli`

### Bugs encontrados e corrigidos

**`kernel-dsl/src/engine/mod.rs:89`** — `merge` de arquivo ausente retornava `ParseError` em vez de skip silencioso. Fix: `return Err(...)` → `continue`.

**`wasi-stub 0.3.0` — ids WASM mangled pelo Rust 1.92+**
- Rust 1.92+ / wasm-bindgen gera ids de import no formato `$wasi[hash]::lib_generated::wasi_snapshot_preview1::fn` com chars `[`, `]`, `::` inválidos como identificadores WAT não-quotados
- wasi-stub entrava em panic em `static_id` ao tentar re-parsear o id
- Fix: vendorizado em `tools/wasi-stub/` (fonte: typst-community/wasm-minimal-protocol); `static_id` alterado para tentar unquoted primeiro, depois fallback para quoted `$"..."` (válido pela spec WAT)
- Instalado via `cargo install --path tools/wasi-stub --force` substituindo o binário original

### Resultados de build

| Pacote | Testes Rust | WASM debug | WASM release | tsup (ESM+CJS+DTS) |
|--------|-------------|------------|--------------|---------------------|
| parser-dsl | 48/48 ✅ | ✅ | ✅ | ✅ |
| kernel-dsl | 12/12 ✅ | ✅ | ✅ | ✅ |
