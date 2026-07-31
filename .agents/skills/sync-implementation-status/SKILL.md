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

## Step 1 — Confirm the package set

**There are no submodules.** `packages/*` and `apps/*` are plain workspace folders (root `AGENTS.md` says
so, and there is no `.gitmodules`). Do not run `git submodule update` — it is a no-op that reads as a
verification step without verifying anything.

Instead, list what actually exists, so a package added since the last run cannot silently stay unmapped:

```bash
ls packages/ apps/
```

The freeze-status table has **five columns** (tree-sitter · parser-dsl · compiler · kernel-dsl · sdk) but
the repo ships more packages than that — `language-server` has its own version and no column. That is by
design; do not add a column to accommodate it. If a *new* package appears that belongs in the layer story,
flag it in the drift report rather than restructuring the table yourself.

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

**Node-name discrepancy map — do not hardcode it here.** The live map is the *doc's own*
**Node-name discrepancies** table at the end of `implementation-status.md`, cross-checked against the
`#[serde(rename = "…")]` attributes on `Statement` in `ast.rs`. A copy kept in this skill goes stale
silently and then mis-maps nodes on every subsequent run — it has already happened once, when this section
still asserted `intent_handler → intent_trigger` and `temporal_stmt → after_stmt` long after both were
resolved.

So: read the rename attributes, treat them as truth, and reconcile the doc's table against them.

```bash
grep -n 'serde(rename' packages/parser-dsl/src/ast.rs
```

Two shapes of discrepancy are worth recording, and they are different:

- **Renames** — grammar node name ≠ serde name (`run_stmt` field `type` → `RunStmt.kind`).
- **Synthesized fields** — an AST field with *no grammar field behind it*, built by the parser from
  surrounding nodes. `Interact { handlers }` is the standing example: `interact_stmt` is a pure keyword
  with zero children, and `parser.rs` fills `handlers[]` by absorbing sibling `intent_handler` /
  `offtopic_handler` nodes. Grepping the grammar for a `handlers` field finds nothing and proves nothing —
  check `parser.rs` before concluding a field is missing.

---

## Step 5 — Verify compiler layer

Read:
- `packages/compiler/src/linter.ts` — lint rules and which node types they reference
- `packages/compiler/src/pack.ts` — which fields get written to `aboutme.json`
- `packages/compiler/src/schema.ts` and `packages/compiler/src/core.ts` — exported helpers

**Lint codes are not all in `linter.ts`.** They are spread across the package — `pack.ts` and
`namespace.ts` both raise their own, and a code can be raised as a thrown `Error` rather than a structured
`LintMessage`. Enumerate them from the whole tree, never from `linter.ts` alone:

```bash
grep -rhoE '\b[EW][0-9]{3}\b' packages/compiler/src/ | sort -u
```

Diff that set against the codes the doc cites. A code in the source but not in the doc is drift; a gap in
the numbering (no `E007` anywhere) is a code-side gap, not doc drift — report it, don't invent a row.

**"Exported" ≠ "reachable".** A `export function foo()` in a module is not part of the public API unless
some entry point re-exports it *and* `package.json` `exports` maps that entry point. Check the map before
scoring any export row ✅:

```bash
node -e "console.log(Object.keys(require('./packages/compiler/package.json').exports))"
grep -nE '^export' packages/compiler/src/index.ts packages/compiler/src/core.ts
```

This repo exposes only `.` and `./core`. Helpers reachable from neither are ⚠️ internal, however
prominently the doc lists them under a `full.` prefix.

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
- `packages/kernel-dsl/src/lib.rs` — **not every effect is emitted from `engine/`**. The wasm entry points
  emit some directly; `Effect::ParseError` is emitted only there, so an `engine/`-scoped grep reports it as
  dead when it is live.

For each grammar node, answer:
- Does a corresponding `Effect` variant exist and get emitted? → ✅ (note the variant name)
- Is the node parsed but the effect never emitted or dropped? → ⚠️
- Is the node entirely absent from kernel dispatch logic? → ❌

**A match arm that reads a field is not proof of runtime behavior.** `fsm.rs` matches the same
`Statement` variants in several functions with different jobs — FSM execution, and separately SCXML graph
generation (`collect_scxml_transitions`). `Statement::Parallel { body, on_failure }` binding `on_failure`
in the SCXML walker says nothing about whether the runtime executes it; the executing arm discards it
(`on_failure: _`). Always confirm **which function** an arm sits in before promoting ⚠️ → ✅. Grepping a
field name across the file and reading the first hit is exactly how this gets scored wrong.

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

`registerHandler` is not the only dispatch surface — `session.ts` also carries a global observer
(`setEffectListener`) invoked for *every* effect before the typed handler. Read the body of `dispatchRaw`
rather than grepping for `registerHandler`, or you will miss both the observer and the fact that an effect
with no registered handler is silently dropped rather than erroring.

---

## Step 8 — Update package freeze status table

For each package, collect:
- **Version**: read `package.json` or `Cargo.toml`
- **Status**: unchanged unless version changed or active development evidence found

```bash
grep -H '"version"' packages/*/package.json
grep -m2 -H '^version' packages/kernel-dsl/Cargo.toml packages/parser-dsl/Cargo.toml packages/tree-sitter/Cargo.toml
```

**The packages do not move in lockstep.** They are versioned independently and routinely land on different
patch numbers. Check all five every run and read each cell on its own — a table showing one uniform version
across the row is a symptom of a stale sync, not evidence that nothing shipped. Confirm the npm and Cargo
versions agree for the dual-published crates while you are here.

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

## Step 11 — Generate HTML Dashboard

Run the Node.js generator script to produce the interactive HTML dashboard from the updated Markdown file.

Run from the repository root:

```bash
npm run generate:dashboard
```

Both `implementation-status.md` and `implementation-status.html` should appear in `git status` afterwards.
The HTML is generated, never hand-edited.

---

## Edge cases

- **The absence of a grammar node is a finding, not a lookup failure.** Before trusting a doc row that
  describes a node, confirm it is in `node-types.json`. A row can describe a node that never existed —
  `oriented_state_body` was documented for a long time as an "internal grammar grouping" when the grammar
  has no such rule at all.
- **Read the grammar's comments.** `grammar.js` explains *why* a construct has no node — the oriented-state
  shape (`goal<guide<teach<interact`) is enforced by lint, not by the grammar, which is stated in a comment
  and nowhere else. That comment is the difference between "🗑️ dead" and "enforced at another layer".
- **A field parsed into the AST is not a feature.** Several `on_failure` fields are populated by the parser
  and ignored by the runtime. The parser layer is ✅ and the kernel layer is ⚠️ *in the same row*; score
  each column independently rather than letting one layer's ✅ carry the row.
- **Two docs phrasing the same fact differently is not drift.** Only change a cell when the claim is
  falsifiable and false. Prose polish belongs in a different change.
- **Do not restructure to fit a finding.** If the truth genuinely does not fit the table's shape (a sixth
  package, a new layer), report it and let a human decide — this doc's structure is load-bearing for the
  generated dashboard.

---

## Self-improvement loop — keep this file alive

Before finishing, reflect on the run and fold back anything durable that would make the *next* run faster or
more accurate. This file is checked into the repo — treat updating it as part of the task, not an
afterthought.

1. Ask: did this run surface a ground-truth location I didn't have listed (a second file raising lint codes,
   effects emitted outside `engine/`, a new entry point in `package.json`)? Add it to the relevant Step.
2. Ask: did I chase a false positive — something that looked like drift but wasn't, or looked implemented
   but wasn't? Add a one-line guard to **Edge cases** so the next run doesn't repeat the dead end.
3. Ask: did I rely on a fact hardcoded in this file that turned out to be stale? **Delete it and point at
   the live source instead.** A copied table in a skill rots invisibly and then poisons every later run —
   this is the single highest-value edit you can make here.
4. Only commit *general, re-usable* findings — never this session's specific diff, line numbers, version
   numbers, or "today I fixed X." Session-specific detail belongs in the drift report and the commit
   message, not in a skill that will still be read a year from now.
5. Prefer correcting a stale assumption over appending a new paragraph. If a bullet you'd write already
   exists in spirit, tighten it. Keep sections short — this file should read the same length after ten runs
   as after one, just more accurate.
6. Never edit the frontmatter (`description`, `model`, `effort`) — those are structural choices for a human
   to make deliberately.
7. State explicitly in your report whether you updated this file and what changed, so the edit shows up in
   `git diff` like any other change — never a silent self-rewrite.

---

## Checklist — verify before reporting done

- [ ] Package set listed (`ls packages/ apps/`); no submodule step attempted
- [ ] `behavior_node_types[]` and `description_node_types[]` extracted from `node-types.json`
- [ ] Every row in **Description DSL** table verified against: tree-sitter node-types, parser-dsl AST, compiler linter/pack
- [ ] Every row in **TypeDefinition DSL** table verified against the same layers
- [ ] Every row in **Behavior DSL** table verified against: tree-sitter node-types, parser-dsl AST, compiler linter, kernel effect.rs + engine, sdk session.ts
- [ ] All `➕` (injected) and `📌` (hardcoded) entries in Description DSL verified against `pack.ts`
- [ ] Lint codes enumerated across **all** of `packages/compiler/src/`, not just `linter.ts`, and diffed against the codes the doc cites
- [ ] Every export row checked against `package.json` `exports` — module-level `export` alone does not earn ✅
- [ ] Every ⚠️ → ✅ promotion confirmed against the *executing* function, not a same-named match arm in a graph/serialization walker
- [ ] Package versions checked **individually** in the freeze status table (they are not in lockstep)
- [ ] Drift report produced and shown to user before writing the doc
- [ ] All `?` cells listed under "Ambiguous" in the drift report
- [ ] Doc written with preserved structure and no unverified cell changes
- [ ] Node-name discrepancy table reconciled against `serde(rename)` in `ast.rs`
- [ ] A re-run would produce no further changes (stable output)
- [ ] HTML dashboard generated successfully via `scripts/generate-dashboard.js`
- [ ] Self-improvement loop run; report states whether this skill file changed and how

All boxes must be checked before the task is complete.
