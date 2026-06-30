<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-AAA: Parser DSL Unification

| Field | Value |
|---|---|
| Status | Implemented |
| Created | 2026-06-18 |
| Implemented | 2026-06-18 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | ⚠️ | ⚠️ | 🔄 | — |

---

## Summary

This RFC proposes the transition of `@dot-agent/behavior-parser` to `@dot-agent/parser-dsl`. The scope of this package is expanded to parse both `.behavior` (statechart definition) and `.description` (agent manifest) DSL files using tree-sitter, producing structured ASTs and JSON envelopes for downstream compiler, LSP, and runtime consumption.

The canonical type names across the entire toolchain are: **`BehaviorFile`**, **`DescriptionFile`**, and **`TypeDefinition`**. These names are used consistently in Rust structs, TypeScript interfaces, and JSON envelope keys.

---

## Motivation

The dot-agent specification defines two foundational DSL files per agent: the `.description` manifest (the contract) and the `.behavior` statechart (the implementation).

Currently, the parsing pipeline is asymmetrical:
1. **Behavior Parsing:** Structured and robust. `@dot-agent/behavior-parser` (Rust/WASM) parses `.behavior` files into a typed `BehaviorFile`.
2. **Description Parsing:** Fragile and incomplete. The compiler uses a simple regex helper [`parseDescriptionMeta`](file:///Users/danilo/Development/entelekheia/dot-agent-spec/packages/compiler/src/pack.ts#L90) inside [`packages/compiler/src/pack.ts`](file:///Users/danilo/Development/entelekheia/dot-agent-spec/packages/compiler/src/pack.ts) to match domain, name, and description. This approach:
   - Breaks easily when users format files with inline comments, variable spacing, or complex newlines.
   - Ignores critical declarations in `.description` (like `capabilities`, `requires`, `input`, `output`, and custom `type` blocks) during compilation, leaving them hardcoded or empty in the generated `aboutme.json`.
   - Prevents the compiler and runtimes from validating if the actions executed in `.behavior` align with the contract declared in `.description`.

To complete the toolchain architecture, we need a formal, tree-sitter-backed parser for `.description` files. Merging it into a single `@dot-agent/parser-dsl` aligns with `@dot-agent/tree-sitter` (which already unifies both grammars) and provides a clean, single-dependency interface for parsing.

---

## Proposed Architecture

```
             @dot-agent/tree-sitter (description & behavior WASM grammars)
                                    │
                                    ▼
                        @dot-agent/parser-dsl
               (Rust/WASM — parses both DSL files)
                   ├── parse_behavior()    → BehaviorFile
                   └── parse_description() → DescriptionFile
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
         @dot-agent/compiler                @dot-agent/kernel-dsl
   (linter, packaging & JSON Schema gen)  (Rust rlib — behavior only)
```

1. **Renaming:** Rename the `@dot-agent/behavior-parser` package and Rust crate to `@dot-agent/parser-dsl` / `dot-agent-parser-dsl`. Each package is a git submodule; the rename requires updating the parent repo's `.gitmodules` and the `path` reference in `kernel-dsl/Cargo.toml`. The decision between monorepo and multi-repo remains open and does not block this RFC.
2. **Dual Grammar Processing:** Leverage `dot-agent-tree-sitter::language_description()` and `dot-agent-tree-sitter::language_behavior()` to build AST representation trees for both file types.
3. **WASM & rlib Compilation:** The package remains a dual crate (`cdylib` and `rlib`). Runtimes like `kernel-dsl` link as `rlib` to execute state behavior, while JavaScript tools import the WASM bundle.

---

## Detailed Design

### 1. AST Schema (Rust)

In `packages/parser-dsl/src/ast.rs`, the existing `BehaviorFile` types remain unchanged. The following `DescriptionFile` types are added, mapping directly to the [tree-sitter-description grammar](file:///Users/danilo/Development/entelekheia/dot-agent-spec/packages/tree-sitter/tree-sitter-description/grammar.js):

```rust
use serde::{Deserialize, Serialize};

// Represents a category_prop or concept_prop node: a URI with an optional human-readable label.
// Example: `category https://schema.org/MedicalEntity (Medical Entity)`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OntologyRef {
    pub uri: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DescriptionFile {
    pub agent: AgentDecl,
    pub description: Option<String>,
    // File reference: e.g. "SOUL.md"
    pub persona: Option<String>,
    // File reference: e.g. "agent.behavior"
    pub behavior: Option<String>,
    #[serde(default)]
    pub requires: Vec<AnnotatedRef>,
    #[serde(default)]
    pub input: Vec<AnnotatedRef>,
    #[serde(default)]
    pub capabilities: Vec<AnnotatedRef>,
    #[serde(default)]
    pub output: Vec<AnnotatedRef>,
    #[serde(default)]
    pub types: Vec<TypeDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDecl {
    pub name: String,
    pub domain: Option<String>,
    pub license: Option<String>,
    pub terms: Option<String>,
    pub privacy: Option<String>,
}

// Used for requires, input, output, capabilities items.
// `description` is `None` for inline comma-separated lists (e.g. `input Foo, Bar`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnotatedRef {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeDefinition {
    pub name: String,
    pub category: OntologyRef,
    pub concept: Option<OntologyRef>,
    pub properties: Vec<PropertyDecl>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyDecl {
    pub name: String,
    pub r#type: PropertyType,
    pub is_optional: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum PropertyType {
    Primitive(String),
    // Namespace-qualified references (e.g. `std.Prompt`) are concatenated into a
    // single string by the parser. Namespace resolution is handled by the compiler linter.
    Reference(String),
    Array(Box<PropertyType>),
    Enum(Vec<String>),
}
```

### 2. Exported WASM API

The package exports two primary parsing functions, replacing the previous `parse()`:

```typescript
// WASM TypeScript Signatures
export function init(): Promise<void>;
export function parse_behavior(source: string): string;    // Returns { ok: BehaviorFile } | { error: string }
export function parse_description(source: string): string; // Returns { ok: DescriptionFile } | { error: string }

// Static analysis helpers (unchanged from behavior-parser)
export function get_graph(source: string): string;                         // SCXML string
export function get_states(source: string): string;                        // JSON string[]
export function get_intents_for_state(source: string, state: string): string; // JSON string[]
```

**Breaking change:** `parse()` is renamed to `parse_behavior()`. The single consumer, [`packages/compiler/src/parser.ts`](file:///Users/danilo/Development/entelekheia/dot-agent-spec/packages/compiler/src/parser.ts), updates its import accordingly.

### 3. TypeScript Canonical Names

In `packages/compiler/src/types.ts`:

- `FSMDefinition` → renamed to `BehaviorFile` (and all references updated).
- `Skill` / `skills` → renamed to `Capability` / `capabilities` throughout `types.ts`, `manifest.ts`, and `pack.ts`. The name `skills` is reserved for future protocol compatibility (A2A, MCP).
- `AboutMe` gains two new optional fields:

```typescript
export interface Capability {
  id: string
  description: string
}

export interface AboutMe {
  schemaVersion: string
  id: string
  name: string
  description: string
  version: string
  domain: string
  license: string       // from AgentDecl.license; empty string if absent
  persona: string
  purpose: string       // Wikidata QID or "unknown"; populated by LLM layer post-build
  compiler: string
  commit?: string
  capabilities: Capability[]  // from .description capabilities block
  requires: AnnotatedRef[]    // from .description requires block; full objects, not strings
  integrity: Integrity
}
```

`input`, `output`, and custom `TypeDefinition` schemas are **not** part of `aboutme.json`. They are written to `.agent/types.json` as JSON Schema 2020-12 (see Integration Plan §1).

---

## Integration Plan

### 1. Compiler Pack Integration

The compiler's packaging step ([`packages/compiler/src/pack.ts`](file:///Users/danilo/Development/entelekheia/dot-agent-spec/packages/compiler/src/pack.ts)) will:

- Replace `parseDescriptionMeta()` (regex) with `parse_description()` from `@dot-agent/parser-dsl`.
- Populate `aboutme.json` dynamically:
  - `name`, `description`, `domain`, `license` → from `AgentDecl` and `description_block`.
  - `capabilities` → from `DescriptionFile.capabilities` (each `AnnotatedRef` maps to `{ id: name, description }`).
  - `requires` → from `DescriptionFile.requires` as `AnnotatedRef[]`.
  - `purpose` → defaults to `"unknown"`; populated externally by an LLM layer after build.
- When `DescriptionFile.types` is non-empty, generate `.agent/types.json` as JSON Schema 2020-12 via a new `packages/compiler/src/schema.ts` module, and set `integrity.types = ".agent/types.json"`. The `input[]` and `output[]` sections of `types.json` are derived from `DescriptionFile.input` and `DescriptionFile.output`.
- When sources are present, generate `.agent/files.json` and set `integrity.files = ".agent/files.json"`.

The JSON Schema generation logic (`TypeDefinition → JSON Schema 2020-12`, including `$defs`, `$ref` resolution for `std.*` types) lives in `schema.ts` and is out of scope for the `parser-dsl` crate.

### 2. Validation Locus

Cross-file semantic validations (e.g., checking if a `run tool` statement in `.behavior` references a capability declared in `.description`) are implemented in [`packages/compiler/src/core.ts`](file:///Users/danilo/Development/entelekheia/dot-agent-spec/packages/compiler/src/core.ts), exported via the `@dot-agent/compiler/core` sub-path (already configured in `package.json`).

Namespace-prefix validation (e.g., `std.Prompt` vs `Prompt`) is handled by the compiler linter, not the parser. The parser accepts any syntactically valid `type_reference` and concatenates namespace qualifiers into a single string.

### 3. Cargo / Rust Dependency Management

`@dot-agent/kernel-dsl` links to `dot-agent-parser-dsl` via the updated path `"../parser-dsl"` in `Cargo.toml`. Since it only calls `parse_behavior()`, Cargo's dead-code elimination prunes all `DescriptionFile` parsing and serialization code from the kernel binary.

---

## Decisions Log

| # | Decision |
|---|---|
| 1 | Package rename is in-place; mono vs. multi-repo remains open and does not block this RFC. |
| 2 | `parse()` → `parse_behavior()`; `parse_description()` added. Breaking change accepted (one consumer). |
| 3 | `BehaviorFile`, `DescriptionFile`, `TypeDefinition` are the canonical names in Rust, TypeScript, and JSON. |
| 4 | `OntologyRef { uri, label }` for `category` and `concept`; `PropertyType::Reference(String)` concatenated by the parser. |
| 5 | `requires` in `aboutme.json` is `AnnotatedRef[]` (name + description); `skills[]` renamed to `capabilities[]`. |
| 6 | `input`, `output`, and `TypeDefinition` schemas go to `.agent/types.json` (JSON Schema 2020-12), not `aboutme.json`. |
| 7 | JSON Schema generation (`TypeDefinition → JSON Schema`) lives in the compiler (`schema.ts`), not in `parser-dsl`. |
| 8 | `analysis.rs` (`get_graph`, `get_states`, `get_intents_for_state`) stays in `parser-dsl`. |
| 9 | `purpose` derivation (Wikidata QID via LLM) is handled post-build by a separate layer. `aboutme.json` defaults to `"unknown"`. |
| 10 | `@dot-agent/compiler/core` sub-path and `src/core.ts` already exist — no new work required. |

---

## Open Questions

~~1. **Schema.org mapping:** How should standard properties defined in `.description` (like Schema.org properties) map to standard JSON-LD?~~
Closed: `OntologyRef.uri` preserves the full URI from the grammar. Mapping to Wikidata QIDs for `purpose` is delegated to an LLM-assisted layer external to this RFC.

~~2. **Type references validation:** Should the parser validate namespace prefix formats (e.g., `std.Prompt` vs `Prompt`) natively, or leave this parsing check to the compiler linter?~~
Closed: Namespace validation is the compiler linter's responsibility. The parser concatenates `namespace.TypeName` into a single `Reference(String)`.

---

## Implementation Notes

Implemented 2026-06-18. All steps completed as specified.

**Bug discovered during implementation:** The `.description` grammar wraps top-level declarations in an intermediate `statement` node (`manifest → statement → agent_decl`). The initial `description_parser.rs` iterated `root.children()` looking for `"agent_decl"` directly, missing the wrapper and returning an empty agent name. Fixed by unwrapping the `statement` node before dispatching on `agent_decl`/`type_decl`.
