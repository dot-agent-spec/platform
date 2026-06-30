---
description: Re-derive implementation-status.md from actual source code and emit a drift report
model: sonnet
effort: high
---

# /sync-implementation-status — Sync Implementation Status

Re-derives `project/implementation-status.md` from the actual source code across all five packages, then emits a drift report of what changed.

**Usage:** `/sync-implementation-status`

No arguments. Run from the repository root.

---

## Overview

The doc at `project/implementation-status.md` describes *intent*, not outcome — it drifts as packages change. This skill re-derives the table from the **real code** and updates it.

**Source of truth:** `packages/tree-sitter/tree-sitter-behavior/src/node-types.json` and `packages/tree-sitter/tree-sitter-description/src/node-types.json` — a feature exists because the grammar has a node.

**Key invariant:** never copy the old doc forward unverified. Every cell must be backed by a code reference before being written.

---

## Step 1 — Initialize submodules

Run from the repository root:

```bash
git submodule update --init --recursive
```

If a submodule directory remains empty after this command, note which package is empty and skip it in subsequent steps.

---

## Step 2 — Read the existing doc

Read the full `project/implementation-status.md`.

Study and internalize:
- The **legend**: ☑️✅ · ⚠️ · ❌ · → · 🔄 · 🗑️ · ➕ · 📌
- The **column order**: tree-sitter → parser-dsl → compiler → kernel-dsl → sdk
- The **node-name discrepancy** section at the end (grammar node names ≠ parser serde names)
- The exact structure of each section (headers, table layouts, sub-tables, notes)

Do not change the doc's structure. Preserve every section header, legend, and note block verbatim unless a specific entry is found to be wrong.

---

## Step 3 — Extract the canonical feature list

### 3a — Behavior grammar nodes

Read `packages/tree-sitter/tree-sitter-behavior/src/node-types.json`.

Extract all **named** nodes (`"named": true`) that represent actual DSL constructs — not grammar-internal groupings. Also check `packages/tree-sitter/tree-sitter-behavior/grammar.js` and the Rust constant:

```bash
grep -r 'NODE_TYPES_BEHAVIOR' packages/tree-sitter/
```

Build a list: `behavior_node_types[]`

### 3b — Description grammar nodes

Read `packages/tree-sitter/tree-sitter-description/src/node-types.json`.

Same process: extract named nodes representing DSL constructs.

Build a list: `description_node_types[]`

### 3c — Compare against existing doc rows

For each existing row in the **Behavior DSL** table and **Description DSL** table, note:
- Is the "Tree-sitter node" column value present in the node-types.json? → ✅ confirmed
- Is there a grammar node with no doc row? → candidate for a new row (mark ❌ or ➕)
- Does the doc list a node not in node-types.json? → candidate for 🗑️

---

## Step 4 — Verify parser-dsl layer

Read:
- `packages/parser-dsl/src/ast.rs` — all Rust enum variants and structs
- `packages/parser-dsl/src/parser.rs` — behavior parsing
- `packages/parser-dsl/src/description_parser.rs` — description parsing

For each grammar node from Step 3, answer:
- Does an AST variant or struct field exist for this node? → ✅
- Is it partially captured (e.g. sub-node mentioned in code but not in AST struct)? → ⚠️
- Is it absent entirely? → ❌
- Does an AST variant exist with **no matching grammar node** (using the discrepancy map below)? → 🗑️

**Node-name discrepancy map** (grammar → parser serde name):

| Grammar node | Parser serde name |
|---|---|
| `intent_handler` | `intent_trigger` |
| `offtopic_handler` | `offtopic_stmt` |
| `temporal_stmt` | `after_stmt` |
| `run_stmt` field `parameters` | `RunStmt.label` |
| `oriented_state_body` | — (grammar-internal, not in AST) |

When checking for a grammar node in the parser, apply this mapping. Record any new discrepancies you discover.

---

## Step 5 — Verify compiler layer

Read:
- `packages/compiler/src/linter.ts` — lint rules and which node types they reference
- `packages/compiler/src/pack.ts` — which fields get written to `aboutme.json`
- `packages/compiler/src/schema.ts` and `packages/compiler/src/core.ts` — exported helpers

For each grammar node, answer:
- Does the linter explicitly handle or reference this node? → ✅ (note the lint code, e.g. W002, E005)
- Is the node parsed but lint-ignored? → ⚠️
- Is the node entirely absent from compiler logic? → ❌ or `—` (if not expected)

Also check `pack.ts` for **hardcoded values** that should derive from the DSL:
- Any literal string where a DSL field value should be used → 📌
- Any field injected with no upstream DSL source → ➕

---

## Step 6 — Verify kernel-dsl layer

Read:
- `packages/kernel-dsl/src/effect.rs` — `Effect` enum variants
- Files in `packages/kernel-dsl/src/engine/` — FSM execution, how each statement type is dispatched

For each grammar node, answer:
- Does a corresponding `Effect` variant exist and get emitted? → ✅ (note the variant name)
- Is the node parsed but the effect never emitted or dropped? → ⚠️
- Is the node entirely absent from kernel dispatch logic? → ❌

Check package versions:

```bash
grep '"version"' packages/kernel-dsl/package.json 2>/dev/null || grep '^version' packages/kernel-dsl/Cargo.toml
```

---

## Step 7 — Verify sdk layer

Read:
- `packages/sdk/src/session.ts` — `registerHandler` calls and `dispatchRaw` wrappers
- `packages/sdk/src/load.ts` — `loadAgent` and any locally duplicated helpers
- `packages/sdk/src/types.ts` — exported types

For each `Effect` variant from Step 6, answer:
- Does `session.ts` expose a `registerHandler("effect_type", fn)` or a wrapper method? → ✅
- Is the effect emitted by kernel but not surfaced in the sdk API? → ❌ (note as gap)
- Does `load.ts` redefine functions already exported by `compiler`? → ⚠️ + note the duplication

---

## Step 8 — Update package freeze status table

For each package, collect:
- **Version**: read `package.json` or `Cargo.toml`
- **Status**: unchanged unless version changed or active development evidence found

```bash
grep '"version"' packages/tree-sitter/package.json packages/parser-dsl/package.json packages/compiler/package.json packages/sdk/package.json 2>/dev/null
grep '^version' packages/kernel-dsl/Cargo.toml packages/parser-dsl/Cargo.toml 2>/dev/null
```

Only update the version cells if the version has changed. Do not alter the Build or Exports rows unless you find a concrete code-level change.

---

## Step 9 — Produce the drift report

Before updating the doc, write a concise drift report listing:

1. **Cells changed** — e.g. "Behavior DSL > `parallel` > kernel-dsl: ⚠️ → ✅ (Effect::Parallel now fully dispatched)"
2. **New rows** — grammar nodes present in node-types.json that had no doc row
3. **Dead nodes (🗑️)** — AST variants or doc rows referencing nodes absent from node-types.json
4. **New 📌 entries** — newly discovered hardcoded values
5. **New discrepancies** — node-name mapping additions
6. **No change** — sections verified against code with zero drift

Format the drift report as a markdown block. Output it to the user **before** writing the updated doc.

If a cell's status is ambiguous (you cannot determine from the code alone whether a feature is fully vs partially implemented), mark it `?` in the draft and list it in the drift report under "Ambiguous — needs human review".

---

## Step 10 — Write the updated doc

Update `project/implementation-status.md` in-place:

- Preserve the exact document structure: every section header, legend line, note block, and table column order
- Only change cell values that you have code evidence to justify
- Update version numbers in the freeze status table if they changed
- Add new rows for newly discovered grammar nodes (insert in the appropriate section, matching the surrounding style)
- Mark removed/renamed grammar nodes as 🗑️ (do not delete rows — the historical record is useful)
- Append any new node-name discrepancies to the discrepancy table at the end
- Do **not** restructure, rename sections, or change the legend — propose such changes in a separate RFC

---


---

## Step 11 — Generate HTML Dashboard

Run the Node.js generator script to produce the interactive HTML dashboard from the updated Markdown file.

Run from the repository root:

```bash
npm run generate:dashboard
```

## Checklist — verify before reporting done

- [ ] Submodules initialized; any empty packages noted
- [ ] `behavior_node_types[]` and `description_node_types[]` extracted from `node-types.json`
- [ ] Every row in **Description DSL** table verified against: tree-sitter node-types, parser-dsl AST, compiler linter/pack
- [ ] Every row in **TypeDefinition DSL** table verified against the same layers
- [ ] Every row in **Behavior DSL** table verified against: tree-sitter node-types, parser-dsl AST, compiler linter, kernel effect.rs + engine, sdk session.ts
- [ ] All `➕` (injected) and `📌` (hardcoded) entries in Description DSL verified against `pack.ts`
- [ ] Package versions in freeze status table checked against `package.json` / `Cargo.toml`
- [ ] Drift report produced and shown to user before writing the doc
- [ ] All `?` cells listed under "Ambiguous" in the drift report
- [ ] Doc written with preserved structure and no unverified cell changes
- [ ] Node-name discrepancy table updated if new discrepancies found
- [ ] A re-run would produce no further changes (stable output)
- [ ] HTML dashboard generated successfully via `scripts/generate-dashboard.js`

All boxes must be checked before the task is complete.
