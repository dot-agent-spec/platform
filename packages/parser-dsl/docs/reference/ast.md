<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# parser-dsl — AST Reference

Rust types exported from `dot_agent_parser_dsl::ast`. Intended for consumers that link parser-dsl as an `rlib` (currently: `kernel-dsl`).

For the JSON/WASM contract as seen from JavaScript, see [`api.md`](api.md).
For field-level detail, `cargo doc --open` in `packages/parser-dsl` is authoritative.

---

## Type Hierarchy

```
BehaviorFile
├── merges: Vec<String>
├── global_triggers: Vec<TriggerDecl>
│   └── { event: String, body: Vec<Statement> }
└── states: Vec<StateDef>
    └── { name: String, body: Vec<Statement> }
                          └── Statement (enum, 13 variants)

DescriptionFile
├── agent: AgentDecl
├── description / persona / behavior: Option<String>
├── requires / input / capabilities / output: Vec<AnnotatedRef>
└── types: Vec<TypeDefinition>
    └── { name, category: OntologyRef, concept?, properties: Vec<PropertyDecl> }
```

All types derive `Debug`, `Clone`, `Serialize`, `Deserialize`.

---

## Statement serde renames

`Statement` uses `#[serde(tag = "type")]`. The mapping from Rust variant to JSON `"type"` value:

| Rust variant | JSON `"type"` | Notes |
|---|---|---|
| `Goal` | `goal_stmt` | |
| `Guide` | `guide_stmt` | |
| `Teach` | `teach_stmt` | |
| `Interact` | `interact_stmt` | `handlers` is always `[]` — see Grammar Quirks |
| `Transition` | `transition_stmt` | field `target` serializes as `"state"` |
| `OnIntent` | `intent_trigger` | `body` is `IntentBody` (untagged) |
| `OnOfftopic` | `offtopic_stmt` | |
| `After` | `after_stmt` | |
| `Run` | `run_stmt` | newtype wrapping `RunStmt` |
| `Set` | `memory_stmt` | fields `path`→`"target"`, `op`→`"op"`, `value`→`"value"` |
| `If` | `conditional_stmt` | fields `then_body`→`"then"`, `else_body`→`"else"` |
| `Apply` | `apply_stmt` | fields `kind`→`"target"`, `value`→`"text"`; has `on_failed?` |
| `Remove` | `remove_stmt` | fields `kind`→`"target"`, `value`→`"text"`; has `on_failed?` |
| `Parallel` | `parallel_stmt` | has `on_failed?` |

---

## Non-obvious type notes

**`IntentBody`** — `#[serde(untagged)]`. Deserializes as `Next(String)` if the value is a bare string (inline `transition to` shorthand), or `Block(Vec<Statement>)` if it's an array.

**`RunStmt`** — `on_failed: Option<Vec<Statement>>` is `#[serde(default)]`. `kind`, `modifier`, and `label` are all `snake_case` via `#[serde(rename_all)]`.

**`Apply` / `Remove`** — `on_failed: Option<Vec<Statement>>` is `#[serde(default)]`. Currently `kind` is always `MediaKind::Css` (only variant).

**`Parallel`** — `on_failed: Option<Vec<Statement>>` is `#[serde(default)]`. There is no `on_complete` — that construct was removed in KD-4.

**`MemoryPath`** — struct `{ domain: MemoryDomain, key: String }`. `MemoryDomain` implements `as_str() → &'static str` for allocation-free dispatch.

**`PropertyType`** — uses `#[serde(tag = "kind", content = "value", rename_all = "snake_case")]`. Variants: `primitive`, `reference`, `array` (recursive), `enum` (vec of strings).

**`Value`** — `#[serde(untagged)]`. `Str` and `Path` have the same wire type (both serialize as JSON strings). Callers must distinguish by context.

---

## Grammar Quirks

### `intent_trigger` and `offtopic_stmt` as body siblings

The grammar places `intent_trigger` and `offtopic_stmt` as direct siblings inside the state body, **not** nested inside `interact_stmt.handlers`. This is a structural artifact of the tree-sitter grammar.

```
state welcome
  interact
  on intent "help" transition to helping   ← Statement::OnIntent in state.body
  on offtopic                              ← Statement::OnOfftopic in state.body
    guide "Try again"
```

Both appear in `state.body`, not in `Interact { handlers }`. Code that only inspects `Interact { handlers }` will miss them. The `analysis.rs` functions handle both locations explicitly.

### `interact_stmt.handlers` is always empty

Because of the above, `Interact { handlers }` always deserializes with an empty vec. The field is preserved for forward compatibility.

### Trailing newline is normalized automatically

`parse_behavior()` appends `\n` before parsing if the input does not already end with one. Callers do not need to add it manually. (Workaround for tree-sitter#1200 — `MISSING _newline` on valid input.)

---

## Public API for rlib consumers

```rust
// From lib.rs
pub mod ast;
pub use parser::{parse_behavior, ParseError};
pub use description_parser::parse_description;

// parse_behavior(text: &str)    → Result<ast::BehaviorFile, ParseError>
// parse_description(text: &str) → Result<ast::DescriptionFile, ParseError>
// ParseError(pub String) — tuple struct wrapping the error message
```

The `analysis` module is private. Its logic is only exposed via `#[wasm_bindgen]` functions. Rust consumers that need SCXML or state enumeration should call those functions through the WASM interface, or duplicate the analysis logic in their own crate.
