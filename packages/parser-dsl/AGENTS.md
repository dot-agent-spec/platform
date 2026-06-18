# AGENTS.md — behavior-parser

## What This Package Is

`@dot-agent/behavior-parser` is a Rust crate that parses the dot-agent `.behavior` DSL. It sits at **layer 1** of the dot-agent toolchain: above the raw tree-sitter grammar (`dot-agent-tree-sitter`) and below the runtime kernel.

It is built as both `cdylib` (for WASM/JavaScript consumption) and `rlib` (for Rust crates such as `kernel-dsl`).

## Architecture

```
.behavior source text
       │
       ▼
tree-sitter  (dot_agent_tree_sitter::language_behavior())
       │  Concrete Syntax Tree (CST)
       ▼
src/parser.rs  →  src/ast.rs types (BehaviorFile, StateDef, Statement, …)
       │
       ├── src/analysis.rs  →  to_scxml / list_states / intents_for_state
       │
       └── src/lib.rs  →  #[wasm_bindgen] exports (parse, get_graph, get_states, get_intents_for_state)
```

## Building

### WASM (for JavaScript / compiler tools)

Requires: `rustup target add wasm32-wasip1`, `wasm-bindgen-cli`, `wasi-stub`, Zig CC.

```bash
npm run build           # debug (fast)
npm run build:release   # optimized (smaller output)
```

The build script is `scripts/build-wasm.sh`. The output lands in `pkg/`.

### Rust library (rlib — for tests and kernel-dsl)

```bash
cargo build
```

No special toolchain needed.

## Running Tests

```bash
cargo test
```

Tests the **rlib** target. All unit tests live in `#[cfg(test)]` modules inside `src/parser.rs` and `src/analysis.rs`. No external `.behavior` files are needed — every test uses an inline fixture string.

**Expected output:** all tests pass. Four `dead_code` warnings from `build.rs` (constants only used by the WASM target) are normal and must **not** be suppressed.

## Key Files

| File | Role | When to touch |
|---|---|---|
| `src/ast.rs` | Pure data types for the parsed AST. No logic. | Add new statement variants here first. |
| `src/parser.rs` | Converts tree-sitter CST to `BehaviorFile`. | Fix parsing bugs; map new grammar nodes. |
| `src/analysis.rs` | `to_scxml`, `list_states`, `intents_for_state`. | Add analysis passes or fix SCXML output. |
| `src/lib.rs` | `#[wasm_bindgen]` wrappers. Thin glue only. | Expose a new function in the WASM API. |
| `build.rs` | Generates `node_kinds.rs` predicates at build time from the grammar JSON. | Update when grammar node categories change. |
| `index.js` | WASM loader (Node.js + browser). | Fix initialization or environment detection. |

## Critical Grammar Quirk: intent_trigger Siblings

In the current grammar, `intent_trigger` and `offtopic_stmt` nodes appear as **direct siblings** in the state body, not as children of the `interact_stmt` node. This means a parsed state body looks like:

```
state.body = [
  Goal { text: "…" },
  Guide { text: "…" },
  Interact { handlers: [] },    ← always empty handlers in current grammar
  OnIntent { intent: "…", … }, ← sibling, NOT nested inside Interact
  OnOfftopic { … },             ← sibling
]
```

`analysis.rs` handles both patterns (nested handlers and sibling triggers) for forward compatibility. See the comment at `analysis.rs:66`.

## Extending the Grammar

If you change the `.behavior` grammar in `packages/tree-sitter/tree-sitter-behavior`:

1. Rebuild `dot-agent-tree-sitter`: `cd ../tree-sitter && npm run build`
2. Update `build.rs` if node category membership changes
3. Add new variants to `src/ast.rs`
4. Map new CST node kinds in `src/parser.rs` (`node_to_value`)
5. Handle new statement types in `src/analysis.rs` if they carry transitions or intents
6. Add tests

## WASM API Reference

All functions are **stateless** — they re-parse source from scratch on every call.

| Export | Signature | Returns |
|---|---|---|
| `init()` | `() → Promise<void>` | Must be called once before any other function. |
| `parse(text)` | `(string) → string` | JSON `{"ok": FSMDefinition}` or `{"error": "…"}` |
| `get_graph(text)` | `(string) → string` | W3C SCXML XML string (empty string on parse error) |
| `get_states(text)` | `(string) → string` | JSON `string[]` of state names in declaration order |
| `get_intents_for_state(text, state)` | `(string, string) → string` | JSON `string[]` of intents for that state |

```js
import init, { parse, get_states } from "@dot-agent/behavior-parser";
await init();
const { ok, error } = JSON.parse(parse(source));
```

## Common Mistakes

- **Don't call WASM functions before `await init()`** — they throw.
- **Don't search for intents only inside `Interact.handlers`** — the current grammar puts them as siblings in `state.body`. Check both (or use `get_intents_for_state` which handles both).
- **Don't rebuild the grammar inside this package** — `dot_agent_tree_sitter` is an external dependency. Upgrade its version in `Cargo.toml` after rebuilding it.
- **Don't suppress the four dead_code warnings** — the flagged constants are kept intentionally.
- **Don't add logic to `src/ast.rs`** — it is a pure data layer; put logic in `parser.rs` or `analysis.rs`.
