<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0006: Use ts-rs as the Single Source of Truth for AST JSON Contracts

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-27 |
| Deciders | Danilo Borges |

---

## Context

The dot-agent DSL uses Tree-sitter for parsing, which produces a Concrete Syntax Tree (CST). The Rust `parser-dsl` package maps this CST into a clean Abstract Syntax Tree (AST) suitable for business logic. The AST objects are serialized to JSON and passed across the WebAssembly boundary to TypeScript consumers (like the compiler and SDK). The TypeScript consumers currently have manually duplicated interfaces that attempt to mirror the Rust AST structs (e.g., `BehaviorFile` in `compiler/src/types.ts`). This creates a secondary, disconnected source of truth that is prone to silently falling out of sync, risking runtime JSON parsing errors.

## Decision

We will use `ts-rs` macros on the Rust AST structs in `parser-dsl` and `kernel-dsl` to automatically generate their exact TypeScript interface equivalents during compilation.

## Options considered

- **Option A — Derive TS types directly from Tree-sitter's `node-types.json`** — pro: keeps Tree-sitter as the ultimate authority / con: `node-types.json` describes the CST, not the clean business-logic AST. Generating types from it would expose raw grammar nodes (`block`, `run_stmt`, …) with anonymous children instead of the typed structs the Rust code produces after transformation. Crucially, the WASM response envelope (`{ "ok": BehaviorFile | null, "diagnostics": [...] }`) and the `Effect` enum emitted by the kernel have no equivalent in the CST schema at all, making full type coverage impossible from this source alone. (rejected)
- **Option B — Maintain manual TypeScript types (status quo)** — pro: no additional build tools required / con: creates a fragile secondary source of truth that causes silent runtime crashes if out of sync. (rejected)
- **Option C (chosen) — Use `ts-rs` on Rust AST structs** — pro: guarantees 100% type safety across the WASM boundary since the JSON serialization logic and TS types are derived from the exact same Rust struct. The Rust `ast.rs` becomes the formal single source of truth for the JSON contract. / con: requires integrating a new macro library and build step for the Rust packages.

## Consequences

It becomes trivial to evolve the DSL's data structures because changing the Rust struct will automatically update the TypeScript types. It becomes harder for TypeScript consumers to intentionally diverge from the Rust schema. We will need to set up `tsup` in the JS packages to bundle/inline these generated types to ensure consumers don't need a runtime dependency on the WASM packages just for their types.

## Related

This decision directly stems from the build pipeline investigation and unblocks the consolidation of the TS/WASM build tracks.
