<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# LOG-DA01-02: Compiler — Behavior File Consolidation and Naming

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-27 |
| Deciders | Danilo Borges |
| Related | [C3 in pre-public-consolidation](../../tasks/pre-public-consolidation.md) · RFC-0021 (init canonicalization) |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | 🔄 | ⚠️ | — |

---

## 1. Summary

Three decisions were made during the C3 design session:

1. **The compiler must discover the `.description` filename** instead of hardcoding `agent.description`, read `DescriptionFile.behavior` to resolve the behavior filename, and fail with a structured error if the behavior block is absent.
2. **All merged behavior files are recursively consolidated** into a single canonical `agent.behavior` output at compile time. The runtime receives a flat, pre-merged state machine with no `merge` statements left. Source files are preserved in `behaviors/` inside the bundle for reference only.
3. **`init` becomes the required and canonical entry state name.** The kernel must resolve the entry state by name (`states.get("init")`), not by position. A new lint rule (`E016`) enforces presence of `init` in the consolidated AST.

---

## 2. Motivation

### 2.1 C3: hardcoded filenames

`pack.ts` hardcodes `agent.description` and `agent.behavior` throughout — in `collectFiles()`, in the `pack()` read sequence, and in `filesJson`. Any agent whose `.description` file declares `behavior main.behavior` (e.g. the Text Summary example) or uses a non-standard description filename (e.g. dogfood agents like `adr-author.description`) gets wrong or missing metadata in `files.json`. This is a P0 correctness bug blocking pre-public share.

### 2.2 Merge files: path leakage and path rewriting complexity

The original proposal was to pack all source files maintaining their relative hierarchy and rewrite `merge` paths inside bundled files. This was rejected for three reasons:

- **Path leakage.** Relative paths escaping the agent root (e.g. `../../projects/secret`) could expose personal filesystem structure inside the bundle. LLM-generated behavior files could produce these paths inocuously or via prompt injection.
- **AST round-trip writer required.** To rewrite paths, the compiler would need a Rust-side serializer for `.behavior` ASTs — significant scope and fragile against grammar evolution.
- **No flat-plus-ID alternative.** A flat namespace with collision disambiguation (`gen.01.behavior`) was considered but rejected: it loses the source structure without gaining anything, since E014 (cross-root escape) solves the leakage concern and relative paths within the root are unique.

### 2.3 Runtime merge resolution vs. compile-time consolidation

C2 (done) put `flatten_merges` in the kernel for runtime resolution. Consolidation at compile time reduces the runtime to a pure executor: it receives a single validated `BehaviorFile` AST with no external references. Kernel merge resolution is retained for **dev mode** (loading source files directly without packing), where it remains useful.

### 2.4 Entry state: positional vs. named

With consolidation, the entry behavior file's states are concatenated *last* (after all its dependencies, in topological order). "First declared state = entry" breaks silently: the first state in the concatenated text belongs to a leaf dependency, not the author's intent. Canonicalizing `init` as the entry state name decouples entry from position.

---

## 3. Specification

### 3.1 Description file discovery

```
discoverDescriptionFile(dir, explicit?)
```

1. If `explicit` is given: verify file exists at `join(dir, explicit)`, return it.
2. Else: list `*.description` entries in `dir`.
   - **0 found** → `throw Error('E003: No .description file found in <dir>')`
   - **1 found, name ≠ `agent.description`** → `console.info('using <name>')` → return name
   - **1 found, name = `agent.description`** → return silently
   - **2+ found** → `throw Error('E003: Multiple .description files found: <list>')`
3. `PackOptions.description?: string` provides the `explicit` override.

### 3.2 Behavior file resolution

After parsing the description:

- `df.behavior` is `Option<string>`.
- **`null` → throw structured lint error** (not a string throw): the `behavior` block is required. No fallback to `agent.behavior`.
- The resolved path is validated: if it escapes the agent root or is absolute → `E014`.

### 3.3 Merge graph consolidation

```
consolidate(agentRoot, entryFile) → string
```

**Algorithm:**

1. Read and parse `entryFile` → `BehaviorFile` → `bf.merges[]`.
2. DFS traversal from entry. Maintain two sets: `visiting` (cycle detection) and `visited` (dedup).
   - If a node is in `visiting` → `E013` (cycle).
   - If a node is in `visited` → skip (already processed).
3. Each merge path is validated before file I/O:
   - Absolute paths or `path.resolve()` result that escapes `agentRoot` → `E014`.
   - File not found → `E012`.
4. Topological order: push to output list *after* all dependencies (leaves first, entry last).
5. Concatenate texts in topological order → one merged string.
6. Parse the merged string → consolidated `BehaviorFile` AST.
7. Lint the consolidated AST: `E015` (duplicate state name), `E016` (`init` missing), `W014` (duplicate global trigger).

**Symlinks:** followed via `fs.stat` (Node default). The bundle key is the merge declaration path relative to the agent root — never the symlink target's absolute path. This enables intentional cross-project reuse (symlink inside the project pointing to a shared file elsewhere) without leaking filesystem structure.

### 3.4 Bundle structure

```
<name>.agent
├── .agent/
│   ├── aboutme.json
│   ├── files.json
│   └── types.json          (if types declared)
├── agent.behavior           ← CONSOLIDATED output, canonical name always
├── <desc-filename>          ← actual .description file (e.g. adr-author.description)
├── SOUL.md                  (optional)
├── behaviors/               ← source files from merge chain, for reference only
│   ├── main.behavior
│   └── phases/
│       └── generation.behavior
├── guides/
└── knowledge/
```

`files.json`:

```json
{
  "description": "<actual-desc-filename>",
  "behavior": "agent.behavior",
  "behaviors": ["behaviors/main.behavior", "behaviors/phases/generation.behavior"],
  "guides": [],
  "knowledge": []
}
```

`behaviors[]` = merge-chain source files stored at `behaviors/<project-relative-path>`. No directory walk — the merge graph is the sole source of truth. The entry behavior file itself is stored as `behaviors/<df.behavior>`.

The runtime reads only `agent.behavior`. `behaviors[]` is for human inspection and future tooling (diff, provenance). The kernel's `flatten_merges` / `load_behavior_with_bundle` path is retained for dev mode (source files loaded directly without pack).

### 3.5 Security model

| Threat | Layer | Mitigation |
|---|---|---|
| `merge "../../.env"` (relative escape) | E014 — compile error | Plataforma |
| `merge "/etc/passwd"` (absolute path) | E014 — compile error | Plataforma |
| Symlink inside project → outside | Allowed (intentional reuse). Bundle uses symlink path. | Author responsibility |
| `.env` or arbitrary file in behavior format | `E004` syntax error if not valid `.behavior` syntax | Plataforma |
| `.env` manually formatted as valid behavior | Responsibility of the agent author | Author |

The `behavior` path in `.description` (`behavior ../../secret`) is subject to the same E014 check as merge paths.

### 3.6 `init` state requirement

- `init` is the required and canonical entry state name.
- **Lint rule `E016`**: if the consolidated `BehaviorFile` has no state named `init`, emit E016 (error, blocks pack).
- **Kernel change**: resolve entry state via `states.get("init")` instead of first-declared position. If absent at runtime, return `Err` (not panic).
- RFC-0021's `system.behavior` prelude (deferred) will provide `init` implicitly once implemented; E016 will then always pass for compiled bundles since `system.behavior` is merged first.

---

## 4. New Lint Codes

Assigned from the first free slots (E012–E014 were "Reserved for future use"):

| Code | Context | Severity | Description |
|---|---|---|---|
| `E012` | `.behavior` | Error | **Merge target not found.** Path declared in `merge` does not exist on disk. |
| `E013` | `.behavior` | Error | **Circular merge dependency.** DFS detected a cycle in the merge graph. |
| `E014` | `.behavior` / `.description` | Error | **External path.** `merge` path or `behavior <path>` escapes the agent root (relative `../..` escape or absolute path). |
| `E015` | `.behavior` (consolidated) | Error | **Duplicate state name across merged files.** Two or more files in the merge chain declare the same state. |
| `E016` | `.behavior` (consolidated) | Error | **`init` state missing.** The consolidated behavior has no state named `init`. |
| `E017` | `.description` | Error | **Multiple `behavior` declarations.** The tree-sitter grammar allows `repeat` on `behavior_block`, but only one is meaningful — the Rust AST is `Option<String>` and silently kept the last. Emit on the second node; suggest using `merge` in the `.behavior` file instead. Resolves [platform#1](https://github.com/dot-agent-spec/platform/issues/1). |
| `W014` | `.behavior` (consolidated) | Warning | **Duplicate global trigger across merged files.** |

E012–E013 are checked during graph traversal (pre-consolidation). E014 is checked before each file I/O. E015, E016, W014 are checked on the consolidated AST (post-consolidation). E017 is checked in `description_parser.rs` (L1 — parser-dsl) during node iteration, before the AST is constructed.

---

## 5. Implementation Notes

### Files changed

**`packages/compiler/src/types.ts`**
- Add `description?: string` to `PackOptions`.

**`packages/compiler/src/pack.ts`**
- New `discoverDescriptionFile(dir, explicit?)` function.
- Refactor `collectFiles(dir, descriptionFile, behaviorFile, mergeSources)`:
  - Remove hardcoded `agent.description` / `agent.behavior` reads.
  - Accept explicit filenames and the resolved merge source list.
  - Store sources under `behaviors/<relpath>` key.
  - No directory walk for `behaviors/` — merge chain is authoritative.
- New `consolidate(agentRoot, entryFile)`:
  - DFS with `visiting` / `visited` sets.
  - E012 / E013 / E014 emitted here.
  - Returns topologically-ordered text concatenation.
- Refactor `pack()` orchestration:
  1. `discoverDescriptionFile` → `descriptionFile`
  2. Parse description → `df`
  3. Validate `df.behavior` (null → throw; path → E014 check)
  4. `consolidate()` → merged text + source path list
  5. `lintBehavior(mergedText)` → runs all lint including E015 / E016 / W014
  6. `collectFiles(dir, descriptionFile, df.behavior, sourcePaths)`
  7. Build `filesJson` with real names

**`packages/parser-dsl/src/description_parser.rs`**
- E017: during `behavior_block` node iteration, if a second node is found, push `ParseDiagnostic { severity: 'error', code: 'E017', message: 'Multiple behavior declarations — only one is allowed. To combine multiple files, use `merge` in your .behavior file.' }` and stop iterating. The first declared value is retained in the AST; pack is blocked by the error.

**`packages/compiler/src/linter.ts`**
- E012, E013, E014: emitted in consolidation step (before lintBehavior).
- E015: check consolidated `BehaviorFile.states` for name duplicates — emit with both source files noted in message.
- E016: check `bf.states.some(s => s.name === 'init')`.
- W014: check `bf.global_triggers` for label duplicates across files.
- E014 also in `lintDescription`: check `df.behavior` path when present.

**`packages/compiler/docs/reference/lint-codes.md`**
- Add E012–E016 and W014 rows.

**`packages/kernel-dsl/src/engine/mod.rs`**
- Replace first-state entry resolution with `states.get("init")`.
- Return `Err("init state not found")` if absent (no panic).

**`packages/compiler/tests/pack.test.ts`**
- Update `makeAgentDir` fixture: add `behavior agent.behavior` to description.
- Update `collectFiles(dir)` calls to `collectFiles(dir, 'agent.description', 'agent.behavior', [])`.
- Add test: `df.behavior` absent → E_DESC thrown.
- Add test: non-standard description name → auto-discovered, used in `filesJson`.
- Add test: two `.description` files → throws.
- Add test: behavior declares `behavior main.behavior` → `filesJson.behavior === 'agent.behavior'` (consolidated), sources include `behaviors/main.behavior`.
- Add test: merge cycle → E013.
- Add test: merge target missing → E012.
- Add test: merge path escapes root → E014.
- Add test: duplicate state name across merged files → E015.
- Add test: no `init` state → E016.

### Implementation order

```
P0 (parser-dsl):
  1. description_parser.rs: E017 on duplicate behavior_block nodes

P0 (pack.ts + linter.ts):
  2. discoverDescriptionFile + description auto-discovery
  3. df.behavior validation + E014 for description path
  4. consolidate() with E012 / E013 / E014
  5. collectFiles() refactor (explicit names, no behaviors/ walk)
  6. filesJson with real names + behaviors[] from merge chain
  7. lintBehavior post-consolidation: E015, E016, W014

P0 (kernel-dsl):
  8. Entry state: states.get("init") instead of first-declared

P0 (docs + tests):
  9. lint-codes.md E012–E017, W014
 10. pack.test.ts full update + E017 test case
```

Step 1 is in `parser-dsl` and ships with its own PR (closes platform#1). Steps 2–7 are in `compiler` and land as a single PR. Step 8 is a separate `kernel-dsl` PR. Steps 9–10 accompany their respective PRs.

---

## 6. Decisions Closed

| Decision | Resolution | Rationale |
|---|---|---|
| How to find the `.description` file | Glob `*.description`, fail if 0 or 2+; `PackOptions.description` for override | No CLI arg friction for standard case; explicit override when needed |
| `df.behavior` is null | Throw — `behavior` block required | No silent fallback; every agent must declare its behavior file |
| Flat hierarchy vs. relative paths in bundle | Relative paths within agent root | No collision risk inside root; E014 blocks escape |
| Symlinks: block or follow | Follow (npm model) | Intentional cross-project reuse is a valid use case; format validation is the security layer |
| Pack-with-path-rewriting vs. consolidation | Consolidation | Eliminates AST round-trip writer, removes runtime path resolution, enables compile-time validation of the full FSM |
| Entry state: positional vs. named | Named (`init`) required | Topological concatenation breaks positional semantics; named lookup is unambiguous regardless of concatenation order |
| Merge resolution: first-level only vs. recursive | Recursive (all levels) | Incomplete merge resolution is equivalent to a C compiler that does not follow `#include` chains — must be complete |
| E_MERGE_EXTERNAL scope | Relative escapes + absolute paths; symlinks inside project exempt | Symlinks are explicit author intent; `../..` escapes are accidental or adversarial |
| behaviors/ directory walk | Removed — merge graph is authoritative | Walk picks up orphan files silently; explicit merge chain is the only truth |
| Kernel `flatten_merges` fate | Retained for dev mode | Useful without packing; compiled bundles use pre-consolidated `agent.behavior` |

---

## 7. Related

- [C3 in pre-public-consolidation.md](../../tasks/pre-public-consolidation.md)
- [DA01-01-kernel-runtime.md](../../tasks/DA01-01-kernel-runtime.md) — C2 (merge at runtime) done, retained for dev mode
- [RFC-0021: System Behavior](../../rfcs/0021-system-behavior.md) — `init` as prelude entry point (deferred; E016 is the v0.1 bridge)
- [lint-codes.md](../../../packages/compiler/docs/reference/lint-codes.md)
