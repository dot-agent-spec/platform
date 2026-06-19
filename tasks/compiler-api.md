# Task: Compiler API — Prerequisites for Transpiler Infrastructure

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-19 |
| Author | Danilo Borges |
| Unblocks | [rfcs/0018-transpiler-infrastructure.md](../rfcs/0018-transpiler-infrastructure.md) |

---

## Context

These are concrete API changes to `@dot-agent/compiler` and `@dot-agent/compiler/core` required before any transpiler package can be built. None of these changes affect the kernel, SDK, or language server. All are additive except item 1 (which is a type move — breaking for direct SDK importers of `AgentFiles`).

---

## Tasks

### 1. Move `AgentFiles` from SDK to `compiler/core`

**What:** `AgentFiles` is currently defined in `packages/sdk/src/types.ts`. It describes the file layout of a `.agent` bundle — a spec-level concern, not a runtime concern.

**Change:**
- Move the `AgentFiles` interface to `packages/compiler/src/types.ts`
- Export it from `packages/compiler/src/core.ts` (the browser-safe sub-path)
- In `packages/sdk/src/types.ts`, replace the definition with a re-export: `export type { AgentFiles } from '@dot-agent/compiler/core'`

**Why it matters:** Transpilers must not import from the SDK (runtime layer). They import from `compiler/core`.

**Breaking:** Only if external code imports `AgentFiles` directly from `@dot-agent/sdk` — unlikely since the type was internal.

---

### 2. Add `BehaviorChunk` type to `compiler/core`

**What:** A new type that records the provenance of states after merge resolution.

**Add to `packages/compiler/src/types.ts`:**

```typescript
export interface BehaviorChunk {
  /** Relative path of the source .behavior file. e.g. "behaviors/intro.behavior" or "agent.behavior" */
  source: string
  /** Names of the states that originated in this file, in declaration order. */
  states: string[]
}
```

**Export from `packages/compiler/src/core.ts`:**

```typescript
export type { BehaviorChunk } from './types.js'
```

---

### 3. Export `resolveMerges()` from compiler

**What:** A function that flattens a `BehaviorFile`'s `merges` references into a single flat `BehaviorFile`, while capturing which states came from which source file.

**Signature:**

```typescript
// packages/compiler/src/merge.ts  (new file)

export interface ResolvedBehavior {
  /** Flat BehaviorFile with merges: [] — all states inlined in declaration order. */
  behavior: BehaviorFile
  /** One chunk per source file, in merge-resolution order. agent.behavior is always first. */
  chunks: BehaviorChunk[]
}

/**
 * Resolves all `merges` references in a BehaviorFile.
 * `files` is a Map of relative path → file content (the full bundle file map).
 * Recursive merges are supported; circular references are detected and ignored.
 * If a referenced file is not found in `files`, that merge is silently skipped.
 */
export function resolveMerges(
  behavior: BehaviorFile,
  files: Map<string, string>
): ResolvedBehavior
```

**Export from `packages/compiler/src/index.ts` and `core.ts`.**

**Note:** The linter already does a shallow version of this (collecting state names for duplicate detection via `collectMergedStates` in `linter.ts`). `resolveMerges` is the full version — it returns the complete flattened `BehaviorFile`, not just state names.

---

### 4. Export `collectMemoryAccesses()` from compiler

**What:** A function that walks a `BehaviorFile` and collects all memory write operations (`Set` statements). Used by transpilers (e.g. LangGraph) to infer the `AgentState` TypedDict — LangGraph requires static type declarations, but `.behavior` creates memory keys dynamically.

**Signature:**

```typescript
// packages/compiler/src/analysis.ts  (new file or extend existing)

export interface MemoryAccess {
  domain: 'context' | 'session' | 'worksession' | 'user'
  key: string
  /** Inferred value type based on the assigned literal. 'unknown' when indeterminate. */
  valueType: 'string' | 'number' | 'boolean' | 'unknown'
}

/**
 * Collects all memory write operations (set statements) across all states and triggers.
 * Deduplicates by domain+key. When the same key is assigned values of different types,
 * valueType is 'unknown'.
 */
export function collectMemoryAccesses(behavior: BehaviorFile): MemoryAccess[]
```

**Export from `packages/compiler/src/index.ts` and `core.ts`.**

---

### 5. Export `loadBundle()` from `compiler/core`

**What:** A convenience function that takes a `.agent` bundle (`Uint8Array`), unpacks it, parses both DSL files, resolves merges, and returns a `TranspileInput` ready for any transpiler.

**Signature:**

```typescript
// packages/compiler/src/bundle.ts  (new file)

import type { TranspileInput } from '@dot-agent/transpiler-core'

/**
 * Loads a .agent bundle (Uint8Array) and returns a TranspileInput.
 * Validates magic bytes and zip structure.
 * Parses agent.behavior and agent.description via parser-dsl.
 * Resolves merges and collects BehaviorChunk provenance.
 */
export async function loadBundle(bytes: Uint8Array): Promise<TranspileInput>
```

**Notes:**
- The ZIP loading logic already exists in `packages/sdk/src/load.ts` — reuse the unpack pipeline.
- This function introduces a dependency on `@dot-agent/transpiler-core` (for the `TranspileInput` type) in `compiler/core`. If that creates a circular dependency, define `TranspileInput` in compiler/core instead and re-export from transpiler-core.
- Export from `packages/compiler/src/core.ts` (browser-safe sub-path — JSZip works in browser).

---

## Implementation Order

Tasks 1 and 2 have no dependencies — do them first (type changes, no logic).  
Task 3 (`resolveMerges`) depends on 2 (`BehaviorChunk`).  
Task 4 (`collectMemoryAccesses`) is independent.  
Task 5 (`loadBundle`) depends on 1, 2, and 3.

```
1 (AgentFiles move) ──┐
2 (BehaviorChunk)   ──┼──→ 3 (resolveMerges) ──→ 5 (loadBundle)
4 (collectMemory)   ──┘
```
