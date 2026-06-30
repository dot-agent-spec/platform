# Task: AST Mapper Fixes — DA01-01 §4.2

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-06-25 |
| Author | Danilo Borges |
| Decision Log | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |
| Depends on | [DA01-01-grammar-unfreeze.md](DA01-01-grammar-unfreeze.md) ✅ Done |

Updates `parser-dsl` to match the keyword-driven AST structure produced by the relaxed grammar (KD-1 to KD-5) and removes dead nodes left over from cancelled language features.

---

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | C6 — Remove dead AST nodes | `parser-dsl` | S |
| 2 | P0 | L2/G2 — `set` inside `on intent`/`on offtopic` | `parser-dsl` | XS |
| 3 | P0 | C1 — `on failure` on `apply`/`remove` silently dropped | `parser-dsl` | XS |
| 4 | P0 | T1 — Fix `is_state_body_kind` for `intent_handler` | `parser-dsl` | XS |

---

## Work items

### 1. C6 — Remove dead AST nodes — P0

**What:** Delete dead or deprecated AST variants in `parser-dsl/src/ast.rs` and all callsites.

**Why:** These nodes were made dead by KD-4 (`on success` removed) and the KD-3 flat state body redesign. Leaving them causes serde to accept invalid shapes at the boundary.

**Change:**
- Remove `Statement::OnComplete` variant
- Remove `Statement::OnFailed` standalone variant (replaced by `on_failed` fields on `RunStmt`, `Apply`, `Remove`, `Parallel`)
- Remove `RunStmt.each` field
- Remove `Parallel.on_complete` field

### 2. L2/G2 — `set` inside `on intent` / `on offtopic` crashes AST mapper — P0

**What:** Add `Statement::Set` to the variants accepted inside `IntentBody::Block` and `on offtopic` block bodies.

**Why:** The grammar allows `set` inside block-form `on intent` and `on offtopic` handlers (KD-3 flat body). The AST mapper rejects it with a serde error because `IntentBody` doesn't include `Set`.

**Change:** Add `Statement::Set` as an accepted variant wherever `IntentBody::Block(Vec<Statement>)` is deserialized. Verify `on offtopic` block body (`Vec<Statement>`) already handles it — if not, fix there too.

### 3. C1 — `on failure` on `apply`/`remove` silently dropped — P0

**What:** Add `on_failed: Option<Vec<Statement>>` to the `Apply` and `Remove` AST structs.

**Why:** The grammar allows `on failure` blocks on `apply` and `remove` statements. The AST mapper discards the `failure_stmt` child node silently because the structs have no field for it.

**Change:**
- Add `on_failed: Option<Vec<Statement>>` to `ast::Apply` and `ast::Remove`
- In `node_to_value` for `apply_stmt` and `remove_stmt`, walk children and populate `on_failed` from any `failure_stmt` child (same pattern as `run_stmt`)

### 4. T1 — Fix `is_state_body_kind` for `intent_handler` / `offtopic_handler` — P0

**What:** Update `is_state_body_kind` (or the `build.rs`-generated node kind list) to include `intent_handler` and `offtopic_handler`.

**Why:** KD-3 flattened `state_body`, and the grammar now emits `intent_handler` and `offtopic_handler` node kinds directly in the state body. Tests fail with `expected OnIntent in state body` because the kind check doesn't recognize the new names.

**Change:** Add `"intent_handler"` and `"offtopic_handler"` to the set of recognized state-body statement kinds.

---

## Implementation order

```
1. C6  — remove dead nodes first (clears the AST surface before adding new fields)
2. L2/G2 — add Set to IntentBody
3. C1  — add on_failed to Apply/Remove
4. T1  — fix is_state_body_kind
```

Run the full `parser-dsl` test suite after each item. The corpus integration test (`parse_fridge_logic`) must pass after all four items.
