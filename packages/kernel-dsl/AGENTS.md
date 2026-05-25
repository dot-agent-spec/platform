# AI Agent Guidelines

If you are an AI agent working in this repository, follow these rules when modifying `dot-agent-kernel`.

## Context

- **Language**: Rust
- **Target**: WebAssembly (`wasm32-unknown-unknown`)
- **Purpose**: Parse and execute the `.flow` DSL as specified in `../language.md`, exposing a FSM engine to JavaScript via WASM bindings

## Module responsibilities

| File | Responsibility |
|------|---------------|
| `src/lib.rs` | WASM bindings only (`#[wasm_bindgen]`) — no business logic |
| `src/effect.rs` | `Effect` enum and `MemValue` — serialized types returned to JS |
| `src/parser/ast.rs` | AST types — mirror the grammar in `tree-sitter-agent/flow/grammar.js` |
| `src/parser/lexer.rs` | Tokenizer with indentation stack (INDENT/DEDENT), all DSL keywords |
| `src/parser/mod.rs` | Recursive descent parser — `parse_flow(text) → FlowFile` |
| `src/engine/memory.rs` | `MemoryStore` — 4 domains, `get`/`set` with `AssignOp`, snapshot |
| `src/engine/fsm.rs` | `Fsm` — executes statements, dispatches intents/escape/event/tick |
| `src/engine/mod.rs` | `FlowEngine` — orchestrates parser + Fsm + MemoryStore |

Never put parser or FSM logic in `lib.rs`. Never expose internal structs directly via `#[wasm_bindgen]` — serialize with `serde_wasm_bindgen::to_value` instead.

## Dependency constraints

`wasm32-unknown-unknown` has **no `libc`, no filesystem, no threads**. The current dependencies (`wasm-bindgen`, `serde`, `serde-wasm-bindgen`, `js-sys`) are sufficient. Before adding any new crate to `Cargo.toml`, verify it explicitly supports this target. In particular:

- **tree-sitter** (Rust crate): does not support `wasm32-unknown-unknown` — do not add
- **serde_json**: not needed — use `MemValue` / `serde_wasm_bindgen` instead
- Any crate using `std::fs`, `std::net`, threads, or C FFI: prohibited

## Keeping in sync with the spec

The parser in `src/parser/` must stay in sync with `../tree-sitter-agent/flow/grammar.js`. When the tree-sitter grammar changes:

1. Update `src/parser/ast.rs` with new types or variants
2. Update `src/parser/lexer.rs` with new keywords
3. Update `src/parser/mod.rs` with new parsing rules
4. Update `src/engine/fsm.rs` to execute the new construct
5. Update `src/effect.rs` if the construct produces new effect types

## WASM → JS boundary

`#[wasm_bindgen]` does not directly support: lifetimes, generics, `HashMap`, or `Vec<T>` of non-primitive structs. Conventions used here:

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
