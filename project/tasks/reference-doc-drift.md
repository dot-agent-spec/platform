# Task: Reference docs contradict the grammar and the kernel

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-07-30 |
| Author | Danilo Borges |
| Sources | Surfaced by the `cli-helper-agent-sync` review of `apps/dot-agent-cli/helper-src/`; [`packages/kernel-dsl/src/effect.rs`](../../packages/kernel-dsl/src/effect.rs), [`packages/tree-sitter/tree-sitter-description/grammar.js`](../../packages/tree-sitter/tree-sitter-description/grammar.js) |

---

## Context

A sync pass over `apps/dot-agent-cli/helper-src/` cross-checked every falsifiable DSL claim in the
helper against the grammar, the linter, and the kernel. The helper itself was corrected in that
pass. Three of the mismatches, however, were **not** helper bugs — the helper was right and the
reference docs are wrong. They are recorded here because they sit outside `helper-src` and are read
directly by integrators.

All three were verified against source, and item 3 by linting a throwaway agent — not by reading
prose. None of them crosses a frozen package boundary; these are documentation-only edits with no
code change and no RFC needed.

The shared failure mode is worth naming: **reference prose describing Rust/grammar shapes has no
test covering it**, so it drifts silently every time a field or keyword is renamed. Items 1 and 2
are both fallout from renames that already shipped.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | `run_*` effect payloads document a `label` field the kernel never emits | `docs/` | XS |
| 2 | P1 | `kernel-dsl.md` still shows syntax removed in DA01-01 | `docs/` | XS |
| 3 | P1 | `description.md` §3 promises a comma form the grammar rejects | `dsl/` | XS |

---

## Work items

### 1. `run_*` effect payloads document a `label` field the kernel never emits — P0

**What:** [`docs/reference/kernel-dsl.md`](../../docs/reference/kernel-dsl.md) types the three
`run_*` effects with a `label: string | null` field. The canonical enum in
`packages/kernel-dsl/src/effect.rs` (and its generated `bindings/Effect.ts`) declares
`parameters: Option<String>` instead:

```rust
RunScript   { target: String, parameters: Option<String>, silent: bool },
RunSubagent { target: String, parameters: Option<String>, background: bool },
RunTool     { target: String, parameters: Option<String> },
```

**Why:** This is the page an integrator writes their effect handler against. Reading `effect.label`
yields `undefined` at runtime with no type error and no crash — the argument is simply silently
dropped. It is the most expensive kind of doc bug: wrong, plausible, and quiet.

**Change:** Rename `label` → `parameters` in all three places the file states the shape — the
`### { type: "run_script", … }` heading and its prose around line 269, the consolidated TypeScript
union near line 370, and the `switch` dispatch example near line 422. Re-check `silent` /
`background` while there. Generate from `bindings/Effect.ts` rather than retyping if practical.

### 2. `kernel-dsl.md` still shows syntax removed in DA01-01 — P1

**What:** The same file teaches two constructs that no longer exist:

- line ~100 — `on intent "continue" next setup`; the `next` keyword was dropped in favour of
  `transition to`
- line ~282 — `engine.send_failed()`; removed alongside `send_complete()`

**Why:** Copy-pasting either produces a parse error (`next`) or a missing-method crash
(`send_failed`). Both renames are already recorded as done, so the doc is the only thing still
carrying the old shape.

**Change:** Rewrite the example at line ~100 to use `transition to setup`, and drop the
`send_failed()` line from the host-loop example. Grep the whole file for `next `, `send_failed`,
`send_complete`, and `on_failed` — the two found are unlikely to be the only ones.

### 3. `description.md` §3 promises a comma form the grammar rejects — P1

**What:** [`dsl/reference/description.md`](../../dsl/reference/description.md) line ~149 states that
"`requires`, `input`, `capabilities`, and `output` support two forms", showing a compact
comma-separated form for all four (lines ~154-155). The description grammar accepts commas only in
`input` and `output`. Verified by lint:

```
capabilities DiagnoseAction, CreateAction
→ t.description:7:28 E004 Syntax error near ', CreateAction'.
```

**Why:** The spec advertises syntax that fails to parse, and E004 points at the comma rather than
at the concept, so the author has no path from the error back to this page.

**Change:** Restrict the two-form claim to `input`/`output`, and show `requires`/`capabilities` in
the block form only. If the comma form is *wanted* for all four, that is a grammar change and needs
an RFC — do not widen the grammar to match the prose as part of this task.

---

## Implementation order

All three are independent, single-file, docs-only. No batching constraint, nothing gated on a
release. P0 first only because it is the one that fails silently in someone else's code.

```
P0:  1 — run_* effect payload field names
P1:  2 — remove DA01-01 syntax from kernel-dsl.md
     3 — narrow the comma-form claim in description.md §3
```

## Follow-up worth considering (not part of this task)

Every item here is prose that no test covers. A guard — extracting the effect union in
`kernel-dsl.md` from `bindings/Effect.ts`, and linting the fenced DSL blocks in `dsl/reference/`
the way `examples/` is already linted in CI — would stop the same three bugs recurring. That is a
design question, so it belongs in an RFC rather than here.
