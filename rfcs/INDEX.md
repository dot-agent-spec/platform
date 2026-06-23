<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC Index

Scannable overview of all RFCs with package impact. Use the impact columns to gauge effort before opening an RFC.

**Legend:** `—` not related · `⚠️` impacted · `🔄` consumes · `?` pending decision

---

## Active (Draft)

| RFC | Status | tree-sitter | parser-dsl | compiler | kernel-dsl | sdk | Summary |
|-----|--------|-------------|------------|----------|------------|-----|---------|
| [RFC-0001: Addon Protocol](0001-addon-protocol.md) | Draft | — | ? | ⚠️ | — | ⚠️ | Base protocol for lib/knowledge/kernel addons: ID format, resolution types (`builtin`/`bundle`/`online`), `requires` capability gating, compiler pack validation, SDK `AddonResolver`. |
| [RFC-0002: Lib Format](0002-lib-format.md) | Draft | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | WASM lib addons callable from `.behavior` via `run lib`. Full-stack change: new grammar node, `RunLib` effect in kernel, `LibResolver` in SDK. |
| [RFC-0003: Knowledge Format](0003-knowledge-format.md) | Draft | — | — | ⚠️ | ? | ⚠️ | `.knowledge` ZIP format (raw text + SQLite/embeddings) for distributable agent expertise. Compiler validates bundle; SDK handles tier selection and RAG. |
| [RFC-0004: Kernel Protocol](0004-kernel-protocol.md) | Draft | — | — | ⚠️ | ⚠️ | ⚠️ | Formalizes kernel WASM export contract: `inject_memory`, `serialize_state`/`restore_state`. Moves memory ownership to the runtime. Affects kernel internals, SDK dispatch, and compiler LSP diagnostics. |
| [RFC-0005: Type System](0005-type-system.md) | Draft | ⚠️ | ⚠️ | ⚠️ | ? | ⚠️ | Adds multimodal types (`image`, `audio`, `video`, `binary`), collection types (`array<T>`, `object`), and format annotations (`string(email)`). Large surface: grammar, parser, compiler schema gen, SDK MIME validation. |
| [RFC-0006: Experimental Roadmap](0006-experimental-roadmap.md) | Draft | — | — | — | ? | ? | Tracks unresolved open questions: dynamic `each` iteration, authorization gates, checkpointing, timeouts, subagent contracts. No concrete implementation yet. |
| [RFC-0007: GenUI and Templates](0007-genui-and-templates.md) | Draft | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Extends `apply`/`remove` beyond CSS to HTML fragments, video layers, and templates. Security model and capability gating still open. Full-stack change once design is resolved. |
| [RFC-0008: requires[] Typing](0008-requires-typing.md) | Draft | ? | ? | ⚠️ | — | — | Adds action granularity (`read`/`write`/`create`) to `requires[]`. Grammar impact depends on unresolved P1 (syntax form). Compiler gains `requires` validation. |
| [RFC-0009: endpoints & securitySchemes](0009-endpoints.md) | Draft | — | — | — | — | ⚠️ | Defines `endpoints{}` and `securitySchemes{}` in `aboutme.json`, filled by the host at deploy time. SDK `parseAboutme` must handle the new optional fields. |
| [RFC-0010: .well-known](0010-well-known.md) | Draft | — | — | — | — | — | Defines `/.well-known/dot-agent.json` for publisher-level agent discovery. Server-side only; no package changes required. |
| [RFC-0011: dot-agent:// scheme](0011-agent-pack.md) | Draft | — | — | — | — | — | Defines `dot-agent://` URI scheme and Agent Pack collection format. Host/runtime concern; resolution is outside the core packages. |
| [RFC-0012: did and proof](0012-identity-proof.md) | Draft | — | — | ⚠️ | — | ⚠️ | Adds Ed25519 package signing (`proof{}`) and `did:web` author identity. Compiler generates `did`; SDK `parseAboutme` gains optional proof verification. |
| [RFC-0013: purpose (Wikidata)](0013-purpose-index.md) | Draft | ? | ? | ⚠️ | — | — | LLM-assisted Wikidata QID derivation for `purpose` field in `aboutme.json`. Grammar/parser impact depends on P2 (optional author DSL field). Compiler currently hardcodes `"unknown"`. |
| [RFC-0014: Data Contract](0014-data-contract.md) | Draft | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | New behavior syntax: `on intent ... with TypeName`, `goal CapabilityName`, `complete`. Kernel enforces type validation before FSM transitions. |
| [RFC-0015: Cross-Agent Calls](0015-cross-agent.md) | Draft | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | New behavior syntax: `start CapabilityName [in "agent"]`, `into context.var`, `on complete with Type`. Full-stack change for capability-based agent orchestration. |
| [RFC-0016: String Constraints](0016-string-constraints.md) | Draft | ⚠️ | ⚠️ | ⚠️ | — | ⚠️ | Extends `string` with `template`/`format`/`regexp` constraints and adds first-class primitives (`Timestamp`, `Currency`, `Email`, `PhoneE164`). Grammar, parser, compiler validation, SDK runtime checks. |
| [RFC-0017: Standard Library](0017-standard-library.md) | Draft | — | — | ⚠️ | — | ⚠️ | Defines `std.*` compound types (`std.Prompt`, `std.Image`, `std.Speech`). Compiler resolves `std.*` references; SDK injects definitions at load time. |
| [RFC-0018: Transpiler Infrastructure](0018-transpiler-infrastructure.md) | Draft | — | 🔄 | 🔄 | — | — | Pluggable codegen layer: `.agent` → LangGraph / Swift AppIntent. Consumes parser-dsl and compiler AST without modifying them. Lands in `transpiler-core/langgraph/appintent` packages. |

---

## Implemented

| RFC | tree-sitter | parser-dsl | compiler | kernel-dsl | sdk | Summary |
|-----|-------------|------------|----------|------------|-----|---------|
| [RFC-AAA: Parser DSL Unification](implemented/AAA-parser-dsl-unification.md) | — | ⚠️ | ⚠️ | 🔄 | — | Renamed `behavior-parser` → `parser-dsl`; added `parse_description()` alongside `parse_behavior()`; replaced compiler regex with structured AST; canonical type names `BehaviorFile`/`DescriptionFile`/`TypeDefinition`. |
