<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Resolve node name discrepancies between grammar and parser-dsl

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-26 |
| Author | Danilo Borges |
| Sources | [implementation-status.md § Node name discrepancy](../implementation-status.md#node-name-discrepancy), [DA01-01-forgiving-syntax.md](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |

---

## Context

The tree-sitter grammar (`packages/tree-sitter/tree-sitter-behavior/grammar.js`) and the
parser-dsl serde serialization (`packages/parser-dsl/src/ast.rs`) use different names for
the same constructs. There are three categories of discrepancy:

**A — Serde names diverge from grammar names (serde is the outlier)**

The grammar node names are canonical. The parser-dsl serde layer introduced different names
for three constructs. The fix is to align serde (and all layers above) to the grammar names.

| Grammar (canonical) | Serde / JSON now | Action |
|---|---|---|
| `intent_handler` | `intent_trigger` | rename serde → `intent_handler` |
| `offtopic_handler` | `offtopic_stmt` | rename serde → `offtopic_handler` |
| field `on_failure` (parallel_stmt) | `on_failed` | rename field → `on_failure` across parser-dsl + linter |

The linter checks `stmt.type === 'intent_trigger'` (linter.ts:161,167) against parsed JSON and
accesses `stmt['on_failed']` (linter.ts:172). Both must be updated alongside the serde renames.

**B — Grammar node name does not match the keyword**

The grammar node for `after <duration> { ... }` is named `temporal_stmt`, but the
keyword is `after` and the serde output is already `after_stmt`. The grammar name is the
outlier: `temporal_stmt` adds a semantic label the user never types.

**C — Parser silently renames canonical grammar field**

`run_stmt` in the grammar uses `field('parameters', $.quoted_string)` (lines 163, 271).
`parameters` is the standard market term for a run target's argument. However, `RunStmt`
in ast.rs exposes it as `pub label: Option<String>` and the JSON emits `label`.
The grammar field name is canonical — the fix is to rename the Rust field and the JSON
key from `label` → `parameters` in parser-dsl and all layers above.

**D — Dead code: removed node type still referenced in linter**

`oriented_state_body` was removed in v0.1 (state_body is now a flat `repeat(statement)`
with ordering enforced by the linter). However, `linter.ts:292` still checks:

```ts
while (ancestor && ancestor.type !== 'oriented_state_body' && ancestor.type !== 'state_decl') {
```

The `oriented_state_body` branch will never match — it is dead code left from the refactor.

---

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Remove dead `oriented_state_body` reference in linter | `compiler` | XS |
| 2 | P1 | Rename grammar node `temporal_stmt` → `after_stmt` (align with keyword) | `tree-sitter`, `compiler` | S |
| 3 | P1 | Rename `RunStmt.label` → `RunStmt.parameters` in parser-dsl and layers above | `parser-dsl`, `compiler`, `sdk` | S |
| 4 | P1 | Rename serde `intent_trigger` → `intent_handler`, `offtopic_stmt` → `offtopic_handler` in parser-dsl and layers above | `parser-dsl`, `compiler` | S |
| 5 | P1 | Rename field `on_failed` → `on_failure` in parser-dsl and layers above | `parser-dsl`, `compiler`, `kernel-dsl` | M |

---

## Work items

### 1. Remove dead `oriented_state_body` reference in linter — P0

**What:** `linter.ts:292` checks `ancestor.type !== 'oriented_state_body'` — this node type
was removed in v0.1 and no longer appears in the grammar or any parsed tree.

**Why:** Dead condition; misleads any reader of the linter into thinking the node still exists.

**Change:** Remove `&& ancestor.type !== 'oriented_state_body'` from the while condition at
`packages/compiler/src/linter.ts:292`. The loop already terminates on `state_decl`, which
is the only relevant ancestor since the removal of `oriented_state_body`.

---

### 2. Rename grammar node `temporal_stmt` → `after_stmt` — P1

**What:** The grammar defines `temporal_stmt` (grammar.js:247) for the `after` keyword construct.
The parser-dsl serializes it as `after_stmt` (ast.rs:137). The grammar name is the outlier.

**Why:** When a contributor adds a linter rule for the `after` statement, they must know to
look for `temporal_stmt` in the grammar but `after_stmt` in the JSON. The ⚠️ in
implementation-status.md flags this as a potential source of linter bugs.

**Change:**
1. `grammar.js:247` — rename rule `temporal_stmt` → `after_stmt`
2. `grammar.js:131` — update the reference in `statement` choices from `$.temporal_stmt` → `$.after_stmt`
3. Regenerate the parser: `tree-sitter generate` in `packages/tree-sitter/`
4. Search compiler/linter source for any remaining `temporal_stmt` references and update

Note: this change requires an unfreeze of `tree-sitter` package. 🧊

---

### 3. Rename `RunStmt.label` → `RunStmt.parameters` in parser-dsl and layers above — P1

**What:** The grammar field `parameters` is canonical (market standard term for a run target's
argument). `RunStmt` in `ast.rs:196` deviates by naming it `label`; the JSON also emits
`label`. Grammar is not touched.

**Why:** Any consumer of the AST JSON that reads the run target argument uses `label` today.
`parameters` is the expected and standard name. Aligning avoids confusion when the
compiler/SDK evolve.

**Change:**
1. `packages/parser-dsl/src/ast.rs:196` — rename `pub label` → `pub parameters`
2. `packages/parser-dsl/src/parser.rs` — update any read of the `label` field name to `parameters`
3. Grep all packages (`compiler`, `sdk`, `kernel-dsl`) for `.label` on `RunStmt` / `"label"` in
   run-stmt JSON contexts and update to `parameters`
4. Update `index.d.ts` typings if the field is exposed in the public API

No tree-sitter change needed. No unfreeze required.

---

### 4. Rename serde `intent_trigger` → `intent_handler`, `offtopic_stmt` → `offtopic_handler` — P1

**What:** The grammar nodes `intent_handler` and `offtopic_handler` are canonical. The serde
renames in ast.rs diverge to `intent_trigger` and `offtopic_stmt`. The linter checks
`stmt.type === 'intent_trigger'` (linter.ts:161,167) against parsed JSON using the wrong
(serde) name. After this fix, all layers use the grammar names.

**Why:** Eliminates a conceptual split where the same construct has two different names
depending on which layer you look at. Reduces risk of future linter rules using the wrong name.

**Change:**
1. `packages/parser-dsl/src/ast.rs:133` — change `#[serde(rename = "intent_trigger")]` → `#[serde(rename = "intent_handler")]`
2. `packages/parser-dsl/src/ast.rs:135` — change `#[serde(rename = "offtopic_stmt")]` → `#[serde(rename = "offtopic_handler")]`
3. `packages/compiler/src/linter.ts:161` — update `stmt.type === 'intent_trigger'` → `stmt.type === 'intent_handler'`
4. `packages/compiler/src/linter.ts:167` — same
5. Grep all packages for `"intent_trigger"` and `"offtopic_stmt"` in string literals and update
6. Update `index.d.ts` / type discriminants if exposed in the public API

No tree-sitter change needed. No unfreeze required.

---

### 5. Rename field `on_failed` → `on_failure` in parser-dsl and layers above — P1

**What:** The grammar uses `field('on_failure', $.block)` in `parallel_stmt` (grammar.js:263)
and the keyword phrase is `on failure`. The parser-dsl serializes and pattern-matches the field
as `on_failed` across all four statement types that carry a failure handler (`run`, `apply`,
`remove`, `parallel`). The canonical name is `on_failure`.

**Why:** `failure` is the keyword users write; `on_failure` is what the grammar field is named.
`on_failed` is a historical artifact. The mismatch affects anyone reading the AST JSON or
pattern-matching in Rust.

**Change:**
1. `packages/parser-dsl/src/ast.rs` — rename `on_failed` → `on_failure` at lines 165, 174, 180, 199
2. `packages/parser-dsl/src/parser.rs` — update `map.insert("on_failed"...)` → `"on_failure"` at lines 310, 325, 340, 370
3. `packages/parser-dsl/src/analysis.rs:145` — update destructure `Parallel { body, on_failed }` → `on_failure`
4. `packages/compiler/src/linter.ts:172` — update `stmt['on_failed']` → `stmt['on_failure']`
5. `packages/kernel-dsl/src/engine/fsm.rs:269` — fix `Statement::Parallel { body, on_complete: _, on_failed: _ }`:
   - drop `on_complete` (field was removed from ast.rs; this is a pre-existing bug that will surface as a compile error)
   - rename `on_failed` → `on_failure`
6. Grep `kernel-dsl` for any other `on_failed` pattern-matches in Parallel arms
7. Update `index.d.ts` typings if `on_failed` is exposed in the public API
8. Rebuild compiler (`npm run build`) — `dist/index.js` is auto-updated

No tree-sitter change needed. No unfreeze required.

---

## Implementation order

Item 2 belongs to the **v0.1 tree-sitter unfreeze window** (§4.1 of
[DA01-01-forgiving-syntax.md](../pre-release/v0.1/DA01-01-forgiving-syntax.md)) — it must
be batched with the other KD-* grammar changes. Items 3 and 4 belong to the **parser-dsl
layer** of the same unfreeze (§4.2) — no grammar dependency, but should not race the
tree-sitter freeze.

```
P0:  1 — remove oriented_state_body dead code (compiler only, independent of unfreeze)
P1a: 3 + 4 + 5 — parser-dsl rename batch (§4.2 window; one PR alongside C1/C6)
P1b: 2 — grammar rename (§4.1 window; batch with KD-1…KD-5)
```

Items 3, 4, and 5 are non-breaking before any external release of parser-dsl.
Item 5 touches `kernel-dsl` too — the `on_complete` bug in `fsm.rs:269` is a pre-existing
compile error waiting to surface; fixing `on_failed` in that file should also remove `on_complete`
from the Parallel pattern.
Item 2 requires verifying the linter has no remaining `temporal_stmt` references after
`tree-sitter generate`.
