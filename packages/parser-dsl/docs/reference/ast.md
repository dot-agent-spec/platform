<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# parser-dsl — AST Reference

This document describes the Rust types exported from `dot_agent_parser_dsl::ast`. It is intended for consumers that link parser-dsl as an `rlib` (currently: `kernel-dsl`, future: `sdk`).

For the JSON serialization of these types as seen from JavaScript, see [`api.md`](api.md).

---

## 1. Type Hierarchy

```
BehaviorFile
├── merges: Vec<String>
├── global_triggers: Vec<TriggerDecl>
│   └── { event: String, body: Vec<Statement> }
└── states: Vec<StateDef>
    └── { name: String, body: Vec<Statement> }
                              └── Statement (enum, 15 variants)
```

All types implement `Debug`, `Clone`, `Serialize`, `Deserialize`. Serde renames are documented inline.

---

## 2. Top-Level Types

### `BehaviorFile`

Root of every parsed `.behavior` file.

```rust
pub struct BehaviorFile {
    pub merges: Vec<String>,              // "merge ..." declarations
    pub global_triggers: Vec<TriggerDecl>, // "on event ..." at file scope
    pub states: Vec<StateDef>,
}
```

### `TriggerDecl`

A global event handler declared outside any state.

```rust
pub struct TriggerDecl {
    pub event: String,
    pub body: Vec<Statement>,
}
```

### `StateDef`

A single state machine state.

```rust
pub struct StateDef {
    pub name: String,
    pub body: Vec<Statement>,
}
```

---

## 3. Statement

The core enum. Serde tag: `"type"`.

```rust
#[serde(tag = "type")]
pub enum Statement {
    #[serde(rename = "goal_stmt")]
    Goal { text: String },

    #[serde(rename = "guide_stmt")]
    Guide { text: String },

    #[serde(rename = "teach_stmt")]
    Teach { text: String },

    #[serde(rename = "interact_stmt")]
    Interact {
        #[serde(default)]
        handlers: Vec<Statement>,
    },

    #[serde(rename = "transition_stmt")]
    Transition {
        #[serde(rename = "state")]
        target: String,
    },

    #[serde(rename = "intent_trigger")]
    OnIntent { intent: String, body: IntentBody },

    #[serde(rename = "offtopic_stmt")]
    OnOfftopic { body: Vec<Statement> },

    #[serde(rename = "after_stmt")]
    After { prompts: u32, body: Vec<Statement> },

    #[serde(rename = "run_stmt")]
    Run(RunStmt),

    #[serde(rename = "memory_stmt")]
    Set {
        #[serde(rename = "target")]
        path: MemoryPath,
        #[serde(rename = "op")]
        op: AssignOp,
        #[serde(rename = "value")]
        value: Expr,
    },

    #[serde(rename = "conditional_stmt")]
    If {
        condition: Condition,
        #[serde(rename = "then")]
        then_body: Vec<Statement>,
        #[serde(rename = "else")]
        else_body: Option<Vec<Statement>>,
    },

    #[serde(rename = "apply_stmt")]
    Apply {
        #[serde(rename = "target")]
        kind: MediaKind,
        #[serde(rename = "text")]
        value: String,
    },

    #[serde(rename = "remove_stmt")]
    Remove {
        #[serde(rename = "target")]
        kind: MediaKind,
        #[serde(rename = "text")]
        value: String,
    },

    #[serde(rename = "parallel_stmt")]
    Parallel {
        body: Vec<Statement>,
        #[serde(default)]
        on_complete: Option<Vec<Statement>>,
        #[serde(default)]
        on_failed: Option<Vec<Statement>>,
    },

    #[serde(rename = "on_complete_stmt")]
    OnComplete { body: Vec<Statement> },

    #[serde(rename = "on_failed_stmt")]
    OnFailed { body: Vec<Statement> },
}
```

---

## 4. Supporting Types

### `IntentBody`

The body of an `intent_trigger`. Untagged union: either a state name string (inline `transition to` shorthand) or a block of statements.

```rust
#[serde(untagged)]
pub enum IntentBody {
    Next(String),             // "on intent "foo" transition to bar"
    Block(Vec<Statement>),    // "on intent "foo"\n  <body>"
}
```

Match on this enum when executing an intent transition:

```rust
match &stmt {
    Statement::OnIntent { intent, body } => match body {
        IntentBody::Next(target) => { /* direct transition */ }
        IntentBody::Block(stmts) => { /* execute block */ }
    }
}
```

### `RunStmt`

```rust
pub struct RunStmt {
    pub kind: RunKind,
    pub target: String,
    pub label: Option<String>,
    pub modifier: Option<RunModifier>,
    pub each: Option<String>,
    pub on_failed: Option<Vec<Statement>>,
}

pub enum RunKind    { Script, Subagent, Tool }
pub enum RunModifier { Silent, Background }
```

### `MemoryPath`

```rust
pub struct MemoryPath {
    pub domain: MemoryDomain,
    pub key: String,
}

pub enum MemoryDomain {
    Context,     // serializes as "context"
    Session,     // serializes as "session"
    WorkSession, // serializes as "worksession"
    User,        // serializes as "user"
}
```

`MemoryDomain` implements `as_str()` → `&'static str` for use in effect dispatch without allocation.

### `AssignOp`

```rust
pub enum AssignOp {
    #[serde(rename = "=")]  Assign,
    #[serde(rename = "+=")] AddAssign,
    #[serde(rename = "-=")] SubAssign,
}
```

### `Condition` and `Expr`

```rust
pub struct Condition {
    pub parts: Vec<(Option<LogicalOp>, Expr)>,
}
// The first part always has LogicalOp = None.
// Subsequent parts have Some(And) or Some(Or).

pub enum LogicalOp { And, Or }

#[serde(untagged)]
pub enum Expr {
    Value(Value),
    Compare { left: Value, op: CompareOp, right: Value },
}

pub enum CompareOp { Eq, Ne, Gt, Lt, Gte, Lte }
// serialize as: "==" | "!=" | ">" | "<" | ">=" | "<="

#[serde(untagged)]
pub enum Value {
    Str(String),
    Number(f64),
    Bool(bool),
    Null,
    Path(String), // memory path reference — same wire type as Str; distinguish by context
}
```

### `MediaKind`

```rust
pub enum MediaKind { Css }
```

---

## 5. Grammar Quirks

### intent_trigger as body siblings

The tree-sitter grammar places `intent_trigger` and `offtopic_stmt` as direct siblings inside the state body, **not** nested inside `interact_stmt.handlers`. This is an artifact of how the grammar is written.

In practice, this means:

```
state welcome
  interact
  on intent "help" transition to helping   ← parsed as Statement::OnIntent in state.body
  on offtopic                              ← parsed as Statement::OnOfftopic in state.body
    guide "Try again"
```

Both `Statement::OnIntent` and `Statement::OnOfftopic` appear in `state.body`, not in `interact_stmt.handlers`. Code that only looks inside `Interact { handlers }` will miss these statements.

The `analysis.rs` functions (`intents_for_state`, `collect_scxml_transitions`) explicitly handle both locations. If you write your own traversal, match `Statement::OnIntent` at the top level of `state.body` in addition to any nested `Interact` handlers.

### Trailing newline is normalized automatically

`parse_behavior()` appends `\n` to the input before parsing if the text does not already end with one. This means files without a trailing newline parse correctly. Callers do not need to add `\n` manually.

### `interact_stmt.handlers` is always empty

Because of the above, `Interact { handlers }` currently always deserializes with an empty `handlers` vec. The field is preserved in the AST for forward compatibility if the grammar behavior changes.

---

## 6. Description AST Types

Types produced by `parse_description()`. Used by the compiler to populate `aboutme.json` and generate `types.json`.

### `DescriptionFile`

Root of every parsed `.description` file.

```rust
pub struct DescriptionFile {
    pub agent: AgentDecl,
    pub description: Option<String>,
    pub persona: Option<String>,       // file ref e.g. "SOUL.md"
    pub behavior: Option<String>,      // file ref e.g. "agent.behavior"
    pub requires: Vec<AnnotatedRef>,
    pub input: Vec<AnnotatedRef>,
    pub capabilities: Vec<AnnotatedRef>,
    pub output: Vec<AnnotatedRef>,
    pub types: Vec<TypeDefinition>,
}
```

### `AgentDecl`

```rust
pub struct AgentDecl {
    pub name: String,
    pub domain: Option<String>,
    pub license: Option<String>,
    pub terms: Option<String>,
    pub privacy: Option<String>,
}
```

### `AnnotatedRef`

Used for items in `requires`, `input`, `output`, and `capabilities` blocks. `description` is `None` for inline comma-separated lists (e.g. `input Foo, Bar`).

```rust
pub struct AnnotatedRef {
    pub name: String,
    pub description: Option<String>,
}
```

### `OntologyRef`

A URI with an optional human-readable label, from `category_prop` or `concept_prop` nodes.

```rust
pub struct OntologyRef {
    pub uri: String,
    pub label: Option<String>,
}
```

### `TypeDefinition`

```rust
pub struct TypeDefinition {
    pub name: String,
    pub category: OntologyRef,
    pub concept: Option<OntologyRef>,
    pub properties: Vec<PropertyDecl>,
}
```

### `PropertyDecl`

```rust
pub struct PropertyDecl {
    pub name: String,
    pub r#type: PropertyType,
    pub is_optional: bool,
    pub description: Option<String>,
}
```

### `PropertyType`

```rust
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum PropertyType {
    Primitive(String),
    // Namespace-qualified references (e.g. `std.Prompt`) are concatenated by the parser.
    // Namespace resolution is handled by the compiler linter.
    Reference(String),
    Array(Box<PropertyType>),
    Enum(Vec<String>),
}
```

---

## 7. Public API for rlib consumers

The public surface available to Rust crates that depend on `dot-agent-parser-dsl`:

```rust
// From lib.rs
pub mod ast;
pub use parser::{parse_behavior, ParseError};
pub use description_parser::parse_description;

// parse_behavior(text: &str)    → Result<ast::BehaviorFile, ParseError>
// parse_description(text: &str) → Result<ast::DescriptionFile, ParseError>
// ParseError(pub String) — tuple struct wrapping the error message
```

The `analysis` module is private (`mod analysis`). Its logic is only exposed via the `#[wasm_bindgen]` functions. Rust consumers that need SCXML or state enumeration should call those functions through the WASM interface, or duplicate the analysis logic in their own crate.
