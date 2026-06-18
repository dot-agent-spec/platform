# AGENTS.md — parser-dsl

## What This Package Is

`@dot-agent/parser-dsl` is a Rust crate that parses both the `.behavior` and `.description` DSL files of the dot-agent toolchain. It sits at **layer 1**: above the raw tree-sitter grammar (`dot-agent-tree-sitter`) and below the compiler and runtime kernel.

It is built as both `cdylib` (for WASM/JavaScript consumption) and `rlib` (for Rust crates such as `kernel-dsl`).

## Architecture

```
.behavior source text          .description source text
       │                                │
       ▼                                ▼
tree-sitter (language_behavior)  tree-sitter (language_description)
       │  Concrete Syntax Tree          │  Concrete Syntax Tree
       ▼                                ▼
src/parser.rs                    src/description_parser.rs
  → ast::BehaviorFile              → ast::DescriptionFile
       │
       ├── src/analysis.rs  →  to_scxml / list_states / intents_for_state
       │
       └── src/lib.rs  →  #[wasm_bindgen] exports
                           parse_behavior, parse_description,
                           get_graph, get_states, get_intents_for_state
```

## Building

### WASM (for JavaScript / compiler tools)

Requires: `rustup target add wasm32-wasip1`, `wasm-bindgen-cli`, `wasi-stub`, Zig CC.

```bash
npm run build:debug   # debug (fast, larger binary)
npm run build         # release (optimized, smaller output)
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

Tests the **rlib** target. All unit tests live in `#[cfg(test)]` modules inside `src/parser.rs`, `src/description_parser.rs`, and `src/analysis.rs`. No external files needed — every test uses an inline fixture string.

**Expected output:** all tests pass. Four `dead_code` warnings from `build.rs` (constants only used by the WASM target) are normal and must **not** be suppressed.

## Key Files

| File | Role | When to touch |
|---|---|---|
| `src/ast.rs` | Pure data types: `BehaviorFile`, `DescriptionFile`, and all supporting types. No logic. | Add new statement variants or description fields here first. |
| `src/parser.rs` | Converts tree-sitter CST to `BehaviorFile`. | Fix `.behavior` parsing bugs; map new grammar nodes. |
| `src/description_parser.rs` | Converts tree-sitter CST to `DescriptionFile`. | Fix `.description` parsing bugs; map new grammar nodes. |
| `src/analysis.rs` | `to_scxml`, `list_states`, `intents_for_state`. | Add analysis passes or fix SCXML output. |
| `src/lib.rs` | `#[wasm_bindgen]` wrappers. Thin glue only. | Expose a new function in the WASM API. |
| `build.rs` | Generates `node_kinds.rs` predicates from the grammar JSON at build time. | Update when grammar node categories change. |
| `index.js` | WASM loader (Node.js + browser). | Fix initialization or environment detection. |

## Known Quirks

### Trailing newline normalization

Both `parse_behavior()` and `parse_description()` append `\n` to the input before passing it to tree-sitter if the text does not already end with one.

**Why:** Both grammars use newlines as statement terminators. Files without a trailing `\n` cause tree-sitter to insert a `MISSING _newline` node, which sets `has_error = true` on otherwise valid input. The normalization is transparent to callers — it does not affect the returned AST.

---

## Critical Grammar Quirk: intent_trigger Siblings

In the `.behavior` grammar, `intent_trigger` and `offtopic_stmt` nodes appear as **direct siblings** in the state body, not as children of the `interact_stmt` node:

```
state.body = [
  Goal { text: "…" },
  Interact { handlers: [] },    ← always empty handlers
  OnIntent { intent: "…", … }, ← sibling, NOT nested inside Interact
  OnOfftopic { … },             ← sibling
]
```

`analysis.rs` handles both patterns. See the comment at `analysis.rs:66`.

---

## Critical Grammar Quirk: statement wrapper node

In the `.description` grammar, top-level declarations are wrapped in a `statement` node before `agent_decl` or `type_decl`:

```
manifest → statement → agent_decl
                      type_decl
```

`description_parser.rs` unwraps this intermediate node before dispatching on `agent_decl`/`type_decl`.

## Extending the Grammar

### `.behavior` grammar changes

If you change the `.behavior` grammar in `packages/tree-sitter/tree-sitter-behavior`:

1. Rebuild `dot-agent-tree-sitter`: `cd ../tree-sitter && npm run build`
2. Update `build.rs` if node category membership changes
3. Add new variants to `src/ast.rs`
4. Map new CST node kinds in `src/parser.rs` (`node_to_value`)
5. Handle new statement types in `src/analysis.rs` if they carry transitions or intents
6. Add tests

### `.description` grammar changes

If you change the `.description` grammar in `packages/tree-sitter/tree-sitter-description`:

1. Rebuild `dot-agent-tree-sitter`: `cd ../tree-sitter && npm run build`
2. Add new fields to `src/ast.rs` (`DescriptionFile` or supporting types)
3. Map new CST node kinds in `src/description_parser.rs`
4. Add tests

## WASM API Reference

All functions are **stateless** — they re-parse source from scratch on every call.

| Export | Signature | Returns |
|---|---|---|
| `init()` | `() → Promise<void>` | Must be called once before any other function. |
| `parse_behavior(text)` | `(string) → string` | JSON `{"ok": BehaviorFile}` or `{"error": "…"}` |
| `parse_description(text)` | `(string) → string` | JSON `{"ok": DescriptionFile}` or `{"error": "…"}` |
| `get_graph(text)` | `(string) → string` | W3C SCXML XML string (empty string on parse error) |
| `get_states(text)` | `(string) → string` | JSON `string[]` of state names in declaration order |
| `get_intents_for_state(text, state)` | `(string, string) → string` | JSON `string[]` of intents for that state |

```js
import init, { parse_behavior, parse_description } from "@dot-agent/parser-dsl";
await init();
const { ok: bf } = JSON.parse(parse_behavior(behaviorSrc));
const { ok: df } = JSON.parse(parse_description(descriptionSrc));
```

## Common Mistakes

- **Don't call WASM functions before `await init()`** — they throw.
- **Don't search for intents only inside `Interact.handlers`** — the current grammar puts them as siblings in `state.body`. Check both (or use `get_intents_for_state` which handles both).
- **Don't rebuild the grammar inside this package** — `dot_agent_tree_sitter` is an external dependency. Upgrade its version in `Cargo.toml` after rebuilding it.
- **Don't suppress the four dead_code warnings** — the flagged constants are kept intentionally.
- **Don't add logic to `src/ast.rs`** — it is a pure data layer; put logic in `parser.rs`, `description_parser.rs`, or `analysis.rs`.
