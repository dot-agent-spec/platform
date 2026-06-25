# Task: Grammar Unfreeze — DA01-01 §4.1–§4.2

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-06-25 |
| Author | Danilo Borges |
| Decision Log | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |

All items in this task must be implemented in a single batch (one unfreeze of `tree-sitter` + `parser-dsl`). Do not open a second unfreeze for a missed item.

---

## §4.1 Grammar Relaxations (packages/tree-sitter)

### D3/G7 — Description block order

**Change:** In `grammar.js`, change `agent_decl` from `seq(...)` to `repeat(choice(...))` so `.description` blocks are accepted in any order. Blocks remain optional; the linter (not the grammar) enforces required-block presence and uniqueness.

### L3/G3 — `on failure` on the next line

**Change:** In `run_stmt`, add `optional($._newline)` before `failure_stmt` so the next-line form parses without E004. This is also how `apply`/`remove` document their `on failure`.

### S1 — `parallel` with multi-line `run` statements

**Change:** Fix `handler_block` to consume `$._newline` between statements (add `optional($._end_stmt)` between elements, or use `$.block` instead of `$.handler_block` for the parallel body). This single change also enables Gap 1 (see below) since `if/else` bodies share the same construct.

### S3 — `on success` for individual `run_stmt`

**Change:** Add `optional(success_stmt)` to `run_stmt` before `optional(failure_stmt)`. The `success_stmt` rule already exists for `parallel` — reuse it.

```
run script "scripts/verify.js"
  on success
    transition to review_drift
  on failure
    transition to error
```

### Gap 1 — `run … on failure` inside `if/else` body

**Change:** No separate grammar change needed — the `handler_block` fix from S1 enables this. Formally validate and add a corpus test case. Document in `dsl/reference/behavior.md` that `run … on failure` is valid inside `if/else` bodies.

---

## §4.2 AST Mapper Bugfixes (packages/parser-dsl)

### L2/G2 — `set` inside `on intent` crashes AST mapper

**Change:** Add `Statement::Set` variant to the `IntentBody` enum so the Rust AST mapper can deserialize `set` statements inside block-form `on intent` handlers without crashing. Preferred resolution: allow `set` in intent blocks (matches author mental model; grammar already accepts it).

### C1 — `on failure` on `apply`/`remove` silently dropped

**Change:** Add `on_failed: Option<Vec<Statement>>` to the `Apply` and `Remove` AST structs. Populate it in the parser from the `failure_stmt` child node (grammar already emits it; the struct just doesn't capture it).

### C6 — Dead AST nodes

**Change:** Remove `Statement::OnComplete`, `Statement::OnFailed`, and `RunStmt.each` from `parser-dsl`. These have no matching grammar node and are never populated. No migration needed — they are never set.

### S3-AST — `on_success` field for `RunStmt`

**Change:** Add `on_success: Option<SuccessStmt>` to `RunStmt` (mirrors the existing `on_failure` field). Populate it from the new `success_stmt` grammar node added in §4.1 S3.

---

## Test Corpus

All grammar changes require a corpus test file under `packages/tree-sitter/test/corpus/forgiving-syntax/`. Each file must **fail** on the current grammar and **pass** after the fix.

| File | Covers |
|---|---|
| `unordered-blocks.description` | D3/G7 — blocks in non-canonical order |
| `newline-failure.behavior` | L3/G3 — `on failure` on next line after `run` |
| `multiline-parallel.behavior` | S1 — `parallel` with multi-line `run` statements and `on success`/`on failure` |
| `set-inside-intent.behavior` | L2/G2 — `set session.flag = true` inside `on intent` handler |
| `run-on-success.behavior` | S3 — `on success` + `on failure` on a single `run_stmt` |
| `if-body-run-on-failure.behavior` | Gap 1 — `run … on failure` inside `if session.x == true … end` |

### `unordered-blocks.description`

Blocks in order: `capabilities → description → input → behavior → output → requires → persona`. All blocks present; order is the opposite of canonical.

### `newline-failure.behavior`

```
state do_work
  run script "scripts/do-work.js"
    on failure
      transition to error
  transition to done
```

### `multiline-parallel.behavior`

```
state verify_layers
  parallel
    run script "scripts/verify-parser-dsl.js"
    run script "scripts/verify-compiler.js"
    run script "scripts/verify-sdk.js"
  on success
    transition to done
  on failure
    transition to error
```

### `set-inside-intent.behavior`

```
state collect_topic
  goal "Collect the topic"
  guide "Ask for the RFC topic."
  interact
  on intent "topic provided"
    set session.topic_collected = true
    transition to draft
  on offtopic transition to collect_topic
```

### `run-on-success.behavior`

```
state verify
  run script "scripts/verify-sdk.js"
    on success
      transition to review_drift
    on failure
      transition to error
```

### `if-body-run-on-failure.behavior`

```
state emit
  if session.supersedes == true
    run script "scripts/update-superseded.js" on failure
      transition to error
  end
  transition to done
```

---

## Implementation order

```
1. Grammar changes (tree-sitter) — D3/G7, L3/G3, S1 (handler_block fix), S3
2. AST mapper (parser-dsl)       — L2/G2, C1, C6, S3-AST
3. Test corpus                   — one file per item above
4. Gap 1 docs                    — update dsl/reference/behavior.md
```

Grammar must be updated before AST mapper — the AST mapper tests run against the grammar output. The test corpus validates both layers end-to-end.
