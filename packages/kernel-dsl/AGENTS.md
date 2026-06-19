# @dot-agent/kernel-dsl — Agent Guidelines

AI collaboration guide for maintaining and evolving the `@dot-agent/kernel-dsl` Rust/WASM execution engine.

## Context

- **Language**: Rust
- **Target**: WebAssembly (`wasm32-unknown-unknown`)
- **Purpose**: Parse and execute the `.behavior` DSL as specified in [`syntax.md`](https://github.com/daniloborges/dot-agent/blob/main/syntax.md), exposing a FSM engine to JavaScript via WASM bindings

## Module responsibilities

| File | Responsibility |
|------|---------------|
| `src/lib.rs` | WASM bindings only (`#[wasm_bindgen]`) — no business logic |
| `src/effect.rs` | `Effect` enum and `MemValue` — serialized types returned to JS |
| `src/parser/ast.rs` | AST types — mirror the grammar in [`tree-sitter-agent/behavior/grammar.js`](https://github.com/daniloborges/dot-agent-tree-sitter/blob/main/behavior/grammar.js) with serde |
| `src/parser/mod.rs` | Tree-sitter-based parser — `parse_behavior(text) → BehaviorFile`, converts CST to AST |
| `src/engine/memory.rs` | `MemoryStore` — 4 domains, `get`/`set` with `AssignOp`, snapshot |
| `src/engine/fsm.rs` | `Fsm` — executes statements, dispatches intents/offtopic/event/tick/complete/failed |
| `src/engine/mod.rs` | `AgentDSLKernel` — orchestrates parser + Fsm + MemoryStore |
| `build.rs` | Code generation — extracts node kinds from tree-sitter `node-types.json` |

Never put parser or FSM logic in `lib.rs`. Never expose internal structs directly via `#[wasm_bindgen]` — serialize with `serde_wasm_bindgen::to_value` instead.

## Dependency constraints

`wasm32-wasip1` has **no `libc`, no filesystem, no threads**. Runtime dependencies must be WASM-compatible: `wasm-bindgen`, `serde`, `serde-wasm-bindgen`, `js-sys`. Before adding to `Cargo.toml`, verify WASM support.

**Build-only dependencies** (in `[build-dependencies]`) are exempt — they run on the host during compilation. Currently: `dot-agent-tree-sitter`, `serde_json` (for codegen). Do not add WASM-incompatible crates to runtime `[dependencies]`.

- **Prohibited in `[dependencies]`**: `std::fs`, `std::net`, threads, libc-dependent crates, C FFI without WASM shims

## WASM Runtime & Build Pipeline

The WASM binary is compiled with `wasm32-wasip1` (required for tree-sitter's C runtime),
then post-processed by `wasi-stub` to strip all `wasi_snapshot_preview1` imports.
The final binary has **zero WASI imports** — browser-compatible without a WASI runtime.

### Key Points

1. **Do not call C FFI directly**: Tree-sitter is already compiled in; use its Rust bindings.
2. **WASI is stripped at build time**: `wasi-stub` removes WASI imports from the binary.
   No manual JS shim for WASI functions is needed or should be added.
3. **Use `BTreeMap` instead of `HashMap`**: `HashMap` requires `random_get` (WASI) for seeding.
   `BTreeMap` is deterministic and has no system dependencies.
4. **`panic = "abort"` is set in both profiles**: Keeps binary size small and removes the
   `fd_write`/`proc_exit` code path from panic handling.
5. **`env` shim is debug-only**: `index.js` provides 12 UBSan handler stubs for debug builds.
   Release builds compile them out — `env` shim is never needed in production.
6. **Post-build patching is automatic**: `scripts/patch-wasm-bindgen.js` removes direct WASM
   imports to avoid bundler errors. Do not delete this script.

## Keeping in sync with the spec

The parser uses tree-sitter, so the grammar is in [`dot-agent-tree-sitter/behavior/grammar.js`](https://github.com/daniloborges/dot-agent-tree-sitter/blob/main/behavior/grammar.js). Sync is **semi-automatic**:

### When tree-sitter grammar changes:

1. **Build-time only**: `build.rs` auto-extracts node kinds from `node-types.json`
   - List filtering in `extract_state_body_statements`, `extract_handler_block_statements` auto-updates
   - No manual edits needed for simple statements

2. **Manual edits required** (semantic changes):
   - `src/parser/ast.rs`: add new Statement enum variants, serde rename tags to match grammar node kinds
   - `src/parser/mod.rs`: special handling for new nodes with semantic logic (inline shorthand, field splits, etc.)
   - `src/engine/fsm.rs`: execute new statement types
   - `src/effect.rs`: new effect types if the construct produces new side effects

3. **Sync process**:
   - Update `dot-agent-tree-sitter` crate version in `Cargo.toml`
   - Run `cargo update && cargo build`
   - Codegen updates automatically; add manual semantic handlers as needed

## WASM → JS boundary

`#[wasm_bindgen]` does not directly support: lifetimes, generics, or `Vec<T>` of non-primitive structs. Use `BTreeMap` instead of `HashMap` (`HashMap` requires WASI `random_get` for seeding). Conventions used here:

- Functions returning effects: `→ JsValue` via `serde_wasm_bindgen::to_value(&effects)`
- Functions returning strings: `→ String` (natively supported)
- Functions returning string arrays: `→ js_sys::Array`
- Functions with nullable output: `→ JsValue`, use `JsValue::NULL` for absence

## Build cycle

After any change to `src/`:

```bash
wasm-pack build --target web --out-dir pkg
```

`pkg/` is the artifact consumed by frontends. Never edit files inside `pkg/` manually — they are all generated.

## License rules

- **Every new `.rs` file** must carry the Apache 2.0 header using `//` line comments (idiomatic Rust style):
  ```rust
  // Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // ...
  ```
- **Generated files in `pkg/`**: no header — overwritten on every `wasm-pack build`.
- **No NOTICE file**: no third-party source is distributed in this repo. Cargo dependencies are resolved at build time only.

## Publishing

Publishing to npm happens automatically via GitHub Actions (`.github/workflows/`) when a GitHub Release is published.
**Do not run `npm publish` manually.**

Steps to release a new version:
1. Bump `version` in `package.json`
2. Commit and push
3. Create a GitHub Release — the workflow builds the WASM, patches the JS bindings, and publishes to npm

## Key references

| Resource | Link |
|----------|------|
| Syntax specification | [syntax.md](https://github.com/daniloborges/dot-agent/blob/main/syntax.md) |
| .behavior grammar (canonical) | [tree-sitter-agent/behavior/grammar.js](https://github.com/daniloborges/dot-agent-tree-sitter/blob/main/behavior/grammar.js) |
| Full API reference | [API.md](API.md) |
| VS Code extension | [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) |
| Language server (LSP) | [language-server](https://github.com/daniloborges/language-server) |
