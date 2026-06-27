<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Behavior File Consolidation and Naming (DA01-02)

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-27 |
| Author | Danilo Borges |
| Sources | [DA01-02 log](../pre-release/v0.1/DA01-02-compiler-behavior-consolidation.md) · [C3 in pre-public-consolidation](pre-public-consolidation.md) · [platform#1](https://github.com/dot-agent-spec/platform/issues/1) |

---

## Context

Three bugs in the compiler and one in the kernel, all related to hardcoded filenames and missing merge resolution. Decisions fully resolved in DA01-02 log. This task tracks implementation across three PRs:

- **PR A (parser-dsl)** — E017 silent override fix; closes platform#1.
- **PR B (compiler)** — Description discovery, recursive consolidation, updated bundle structure, new lint rules. Fixes C3 from pre-public-consolidation.
- **PR C (kernel-dsl)** — Entry state by name instead of position.

## Priority overview

| # | Priority | Item | Package(s) | Effort | PR |
|---|---|---|---|---|---|
| 1 | P0 | E017: duplicate `behavior_block` in `.description` | parser-dsl | XS | A |
| 2 | P0 | `discoverDescriptionFile()` + `df.behavior` validation + E014 | compiler | S | B |
| 3 | P0 | `consolidate()` — DFS, cycle detection, E012/E013/E014 | compiler | M | B |
| 4 | P0 | `collectFiles()` refactor — explicit names, no `behaviors/` walk | compiler | S | B |
| 5 | P0 | `filesJson` with real names + `behaviors[]` from merge chain | compiler | XS | B |
| 6 | P0 | `lintBehavior` post-consolidation: E015, E016, W014 | compiler | S | B |
| 7 | P0 | Entry state: `states.get("init")` instead of first-declared | kernel-dsl | XS | C |
| 8 | P0 | `lint-codes.md` E012–E017, W014 | compiler/docs | XS | A+B |
| 9 | P0 | `pack.test.ts` — fixture update + new test cases | compiler | S | B |

---

## Work items

### 1. E017: duplicate `behavior_block` — P0 · PR A

**What:** `description_parser.rs` iterates `behavior_block` nodes and silently keeps the last when multiple are present. The AST is `Option<String>` so only one survives.

**Why:** Authors can declare `behavior "a.behavior"` twice and get the wrong file packed with no warning. Grammar allows `repeat` on `behavior_block`.

**Change:** During node iteration in `description_parser.rs`, if a second `behavior_block` node is encountered, push `ParseDiagnostic { severity: 'error', code: 'E017', message: '...' }`. Retain the first declared value. Pack is blocked by the error. Message: `"Multiple behavior declarations — only one is allowed. To combine multiple files, use merge in your .behavior file."` Closes platform#1.

---

### 2. `discoverDescriptionFile()` + `df.behavior` validation — P0 · PR B

**What:** `pack.ts` hardcodes `agent.description`. Replace with discovery function.

**Why:** Any agent whose description file is not named `agent.description` (e.g. `adr-author.description`) gets a wrong bundle.

**Change:** New `discoverDescriptionFile(dir, explicit?)` in `pack.ts`:
1. If `explicit` → verify exists, return.
2. Glob `*.description`:
   - 0 → throw E003.
   - 1, non-standard name → `console.info('using <name>')`, return.
   - 2+ → throw E003 (multiple found).
- Add `description?: string` to `PackOptions` in `types.ts`.
- After parsing the discovered file: `df.behavior === null` → throw structured error (no fallback). Path escapes root or is absolute → E014.

---

### 3. `consolidate()` — DFS merge graph — P0 · PR B

**What:** The compiler currently reads only the single `agent.behavior` file. It must recursively follow `BehaviorFile.merges[]` at all levels.

**Why:** Partial merge resolution is equivalent to a C compiler that does not follow `#include` chains. The runtime must receive a fully merged state machine.

**Change:** New `consolidate(agentRoot, entryFile) → { text: string, sources: string[] }`:
1. DFS from entry. Maintain `visiting` (cycle) and `visited` (dedup) sets.
2. Before each file read: absolute or `../..`-escaping path → E014. File not found → E012. Already in `visiting` → E013 (cycle).
3. Topological order: push after all deps (leaves first, entry last).
4. Concatenate texts → merged string.
5. Parse merged string → consolidated AST (for lint in item 6).
6. Return merged text + source path list.

Symlinks: followed via `fs.stat` default. Bundle key = merge declaration path relative to agent root.

---

### 4. `collectFiles()` refactor — P0 · PR B

**What:** `collectFiles()` hardcodes `agent.description` / `agent.behavior` reads and walks `behaviors/` directory.

**Why:** Directory walk picks up orphan files silently. Merge chain is the only source of truth.

**Change:**
- Signature: `collectFiles(dir, descriptionFile, behaviorFile, mergeSources)`.
- Remove directory walk for `behaviors/`.
- Store each source under `behaviors/<relpath>` key (project-relative path from merge chain).
- Entry behavior itself stored as `behaviors/<df.behavior>`.

---

### 5. `filesJson` with real names — P0 · PR B

**What:** `filesJson` hardcodes `description: 'agent.description'` and `behavior: 'agent.behavior'`.

**Why:** C3: these values are wrong for any non-standard agent.

**Change:**
```json
{
  "description": "<actual-desc-filename>",
  "behavior": "agent.behavior",
  "behaviors": ["behaviors/main.behavior", "behaviors/phases/gen.behavior"],
  "guides": [...],
  "knowledge": [...]
}
```
`agent.behavior` is always the canonical name of the consolidated output (never the source entry file). `behaviors[]` is populated from `mergeSources` returned by `consolidate()`.

---

### 6. Post-consolidation lint rules — P0 · PR B

**What:** Three new rules checked on the consolidated AST after `consolidate()` returns.

**Why:** These can only be checked after the full merge graph is resolved.

**Change:** In `linter.ts`:
- **E015**: Check consolidated `BehaviorFile.states` for name duplicates across files — emit with both source file paths in message.
- **E016**: `bf.states.some(s => s.name === 'init')` → false → E016 error, blocks pack.
- **W014**: Check `bf.global_triggers` for duplicate labels across merged files.

---

### 7. Kernel entry state by name — P0 · PR C

**What:** `engine/mod.rs` uses `state_order.first()` as entry.

**Why:** With topological concatenation, the first state in the text belongs to a leaf dependency, not the author's entry intent. Named lookup is unambiguous.

**Change:** Replace first-state lookup with `states.get("init")`. If absent at runtime, return `Err("init state not found")` (no panic). This is a companion to E016 (lint blocks pack before this can happen in prod; dev mode fallback for safety).

---

### 8. `lint-codes.md` update — P0 · PR A+B

**What:** E012–E017 and W014 are not yet in the reference doc.

**Change:** Add rows for E012–E017 and W014. E017 in PR A; remainder in PR B.

---

### 9. `pack.test.ts` update — P0 · PR B

**What:** Existing tests assert hardcoded filenames and a fixture without `behavior` block.

**Change:**
- Update `makeAgentDir` fixture: add `behavior agent.behavior` to the description.
- Update `collectFiles(dir)` calls → `collectFiles(dir, 'agent.description', 'agent.behavior', [])`.
- Add test: `df.behavior` absent → error thrown.
- Add test: non-standard description name auto-discovered, reflected in `filesJson.description`.
- Add test: two `.description` files → throws E003.
- Add test: `behavior main.behavior` → `filesJson.behavior === 'agent.behavior'`; `filesJson.behaviors` includes `behaviors/main.behavior`.
- Add test: merge cycle → E013.
- Add test: merge target missing → E012.
- Add test: merge path escapes root → E014.
- Add test: duplicate state across merged files → E015.
- Add test: no `init` state → E016.
- Add test: duplicate `behavior` blocks in `.description` → E017.

---

## Implementation order

```
PR A (parser-dsl):
  1. description_parser.rs — E017
  8. lint-codes.md — E017 row
  → closes platform#1

PR B (compiler):
  2. types.ts — PackOptions.description
  2. pack.ts — discoverDescriptionFile()
  3. pack.ts — consolidate()
  4. pack.ts — collectFiles() refactor
  5. pack.ts — filesJson
  6. linter.ts — E015, E016, W014
  8. lint-codes.md — E012–E016, W014
  9. pack.test.ts

PR C (kernel-dsl):
  7. engine/mod.rs — states.get("init")
```
