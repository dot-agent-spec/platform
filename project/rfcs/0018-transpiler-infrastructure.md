<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0018: Transpiler Infrastructure

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-19 |
| Author | Danilo Borges |
| Depends on | [tasks/compiler-api.md](../tasks/compiler-api.md) |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | 🔄 | 🔄 | — | — |

> **Also impacts:** transpiler-core, transpiler-langgraph, transpiler-appintent

---

## Summary

Define a pluggable transpiler infrastructure for the dot-agent toolchain. A transpiler adapts a `.agent` bundle to a target framework or platform — generating executable code (e.g. Python/LangGraph, Swift/AppIntent) or a native runtime graph — without touching the kernel or SDK.

This RFC establishes: the monorepo package layout, the shared type contracts (`TranspileInput`, `Transpiler<TGraph>`, `CodeEmitter<TGraph>`, `EmitResult`, `BehaviorChunk`), and the ecosystem boundary between JS/TS codegen packages and native-language runtime adapters.

---

## Motivation

The dot-agent kernel executes `.agent` bundles via its own FSM runtime. But several integration scenarios require a different execution model:

- **LangGraph** runtimes (Python) expect a `StateGraph` — compiled from the agent's FSM, not interpreted at runtime.
- **AppIntent** (Swift/iOS) expects the agent's intents and state transitions mapped to `AppIntent` protocols.
- **Custom orchestrators** may want a static graph representation to reason about the agent before running it.

A transpiler layer fills this gap without modifying the kernel, compiler, or SDK. It is a purely additive, opt-in layer that consumes the existing `BehaviorFile` AST.

---

## Package Layout

All codegen transpilers live in `packages/` alongside the existing toolchain packages. Native runtime adapters (Python, Swift) live in separate repositories — the `.agent` bundle is their stable integration contract.

```
packages/
  transpiler-core/       → @dot-agent/transpiler-core   (types/interface only)
  transpiler-langgraph/  → @dot-agent/transpiler-langgraph
  transpiler-appintent/  → @dot-agent/transpiler-appintent  (codegen Swift)
```

**Native runtime adapters (out of scope for this RFC, separate repos):**

| Ecosystem | Repo (example) | What it produces |
|---|---|---|
| Python / LangGraph | `dot-agent-python` | `StateGraph` executable in Python |
| Swift / AppIntent | `dot-agent-swift` | `AppIntent`-conforming structs |

Rationale: the monorepo is Rust/WASM + TypeScript. Hosting a PyPI package or Swift Package Manager target here creates unmanageable CI and publish pipelines.

---

## Core Contracts

All types live in `@dot-agent/transpiler-core`. This package has zero runtime logic — it is a type-only package. All domain types are imported from `@dot-agent/compiler/core`; no spec types are defined here.

```typescript
// @dot-agent/transpiler-core

import type {
  BehaviorFile,
  DescriptionFile,
  AboutMe,
  AgentFiles,
  BehaviorChunk,
} from '@dot-agent/compiler/core'

// ── Input ────────────────────────────────────────────────────────────────────

export interface TranspileInput {
  /** BehaviorFile with merges already resolved (merges: []). */
  behavior: BehaviorFile
  description: DescriptionFile
  aboutme: AboutMe
  /**
   * All files from the bundle: soul, guides, knowledge, behaviors.
   * soul is injected into every LLM message as personality — targets must
   * account for it when constructing system prompts.
   */
  files: AgentFiles
  /**
   * Provenance map: which states came from which source .behavior file.
   * Targets that support multi-file output (e.g. intro.py, handle_text.py)
   * use this to mirror the author's original file organization.
   */
  chunks: BehaviorChunk[]
}

// ── Output ───────────────────────────────────────────────────────────────────

export interface EmitFile {
  path: string
  content: string
}

export interface EmitResult {
  files: EmitFile[]
}

// ── Target contracts (both optional — implement what the target supports) ────

/**
 * A target that converts TranspileInput into a graph representation TGraph.
 * TGraph is unconstrained — each target defines its own structure.
 * Existing representations (BehaviorFile, SCXML) cover generic graph navigation needs.
 */
export interface Transpiler<TGraph> {
  transpile(input: TranspileInput): TGraph
}

/**
 * A target that can serialize its graph to source files.
 * Implement alongside Transpiler<TGraph> for dev-time codegen targets.
 * Runtime-only targets (e.g. a JS LangGraph adapter) may skip this.
 */
export interface CodeEmitter<TGraph> {
  emit(graph: TGraph): EmitResult
}
```

---

## BehaviorChunk and Merge Provenance

When an agent uses `merges` to split behavior across multiple files, the author's file organization expresses logical grouping. Transpilers that support multi-file output should respect this structure.

`BehaviorChunk` is defined in `@dot-agent/compiler/core` (not here — it is a spec-level concept):

```typescript
// @dot-agent/compiler/core

export interface BehaviorChunk {
  /** Relative path of the source file, e.g. "behaviors/intro.behavior" or "agent.behavior" */
  source: string
  /** Names of states that originated in this file, in declaration order. */
  states: string[]
}
```

`resolveMerges()` (see [tasks/compiler-api.md](../tasks/compiler-api.md)) produces both the flattened `BehaviorFile` and the `BehaviorChunk[]` in a single pass.

A transpiler generating multi-file output maps `chunk.source` to an output filename (e.g. `behaviors/intro.behavior` → `intro.py`) and writes only the states in `chunk.states` to that file.

---

## Input Construction

Callers assemble a `TranspileInput` from a `.agent` bundle using compiler utilities:

```typescript
import { loadBundle } from '@dot-agent/compiler/core'
import { myTarget } from '@dot-agent/transpiler-langgraph'

const input = await loadBundle(bytes)              // Uint8Array → TranspileInput
const graph = myTarget.transpile(input)
const result = myTarget.emit(graph)                // EmitResult { files[] }
```

`loadBundle` is implemented in `@dot-agent/compiler/core` (see [tasks/compiler-api.md](../tasks/compiler-api.md)). It unpacks the ZIP, parses both DSL files, resolves merges, and returns a `TranspileInput` ready for any target.

---

## Dependency Graph

```
@dot-agent/compiler/core
    ├── BehaviorFile, DescriptionFile, AboutMe, AgentFiles, BehaviorChunk  (types)
    ├── resolveMerges(), collectMemoryAccesses(), loadBundle()              (new utilities)
    └── ← imported by @dot-agent/transpiler-core (types only)
                        └── ← implemented by @dot-agent/transpiler-langgraph
                                             @dot-agent/transpiler-appintent
```

Transpilers do **not** import from `@dot-agent/sdk` or `@dot-agent/kernel-dsl`. The SDK is a runtime dispatch layer; the kernel is a runtime executor. Transpilers are compile-time tools.

---

## Decisions Log

| # | Decision |
|---|---|
| 1 | Package architecture: `transpiler-core` (types only) + separate target packages in `packages/`. |
| 2 | Native runtime adapters (Python, Swift) live in separate repos. The `.agent` bundle is the integration boundary. |
| 3 | `transpiler-core` is types-only — no runtime logic. All domain types imported from `@dot-agent/compiler/core`. |
| 4 | Input contract: `TranspileInput` carries parsed ASTs (not raw text), with merges pre-resolved by `resolveMerges()`. |
| 5 | `soul` is included in `TranspileInput.files` (via `AgentFiles`) — it is injected into every LLM message and targets must account for it. |
| 6 | Output: `Transpiler<TGraph>` produces an unconstrained IR; `CodeEmitter<TGraph>` serializes to `EmitResult { files[] }`. |
| 7 | `TGraph` is unconstrained (`unknown`-equivalent). Existing BehaviorFile/SCXML representations cover generic graph introspection. |
| 8 | `Transpiler<TGraph>` and `CodeEmitter<TGraph>` are separate optional contracts. Runtime-only targets implement only `Transpiler`. |
| 9 | `EmitResult` is multi-file from day one — single-file is `{ files: [{ path, content }] }`. Changing later would be a breaking change. |
| 10 | `BehaviorChunk[]` carries merge provenance so targets can mirror the author's file organization in output. |
| 11 | `AgentFiles` moves from `@dot-agent/sdk` to `@dot-agent/compiler/core`. SDK re-exports. (See tasks/compiler-api.md.) |
| 12 | `loadBundle()` lives in `@dot-agent/compiler/core` — not in `transpiler-core`, which is types-only. |

---

## Open Questions

None at this time. All design decisions resolved prior to RFC authoring.
