# Task: Grammar Unfreeze — DA01-01 §4.1–§4.2

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-06-25 |
| Author | Danilo Borges |
| Decision Log | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |

---

## §4.1 Grammar Relaxations (packages/tree-sitter)

The tree-sitter grammar for `.behavior` is redesigned to be keyword-driven and permissive, moving syntactic enforcement to the compiler linter.

### KD-1 — Move newlines to `extras`
- **Change:** In `tree-sitter-behavior/grammar.js`, add `/\s/` (which matches any whitespace including newlines) to the `extras` list. Remove the `$._newline` rule and all references to it in the structural rules.
- **Why:** This makes newlines completely insignificant to the parser, allowing flexible layout for human and LLM authors.

### KD-2 — Add `end` terminator to multi-statement blocks
- **Change:** Update the rules for `if/else`, `on failure` (block form), `on intent` (block form), `on offtopic` (block form), `after`, and `parallel` to require an explicit `end` keyword to close multi-statement blocks. Inline single-action handlers (e.g. `on failure transition to error_state`) do not require `end`.
- **Why:** Delimits multi-statement blocks unambiguously since newlines are no longer structural.

### KD-3 — Flatten `state_body`
- **Change:** Redefine `state_body` as a flat repetition of statements (`repeat1(choice($.goal_stmt, $.guide_stmt, ...))`) allowing orientation blocks, handlers, and actions to be parsed in any order.
- **Why:** Prevents parsing crashes due to ordering. The compiler linter is responsible for verifying structural constraints (such as block uniqueness and state type shapes).

### KD-4 — Remove `success_stmt` / `on success`
- **Change:** Delete the `success_stmt` rule and the `on success` keyword entirely from `tree-sitter-behavior`.
- **Why:** Success is the implicit sequential fall-through; explicit `on success` handlers are removed from the language design to prevent control-flow complexity.

### KD-5 — Restrict `run` inside `parallel`
- **Change:** Define a simplified internal run variant (`_parallel_run`) for use inside `parallel` blocks that does not allow a nested `on failure` clause.
- **Why:** Group failure handling belongs on the `parallel` block itself.

### D3/G7 — Description block order
- **Change:** In `tree-sitter-description/grammar.js`, change `agent_decl` from `seq(...)` to `repeat(choice(...))` so `.description` blocks are accepted in any order.
- **Why:** Prevents syntax errors when blocks are unordered.

### Superseded / Cancelled Items (Old proposed relaxations)
- **L3/G3 — `on failure` on the next line:** *Superseded* by **KD-1** (newlines are extras, so this parses for free).
- **S1 — `parallel` with multi-line statements:** *Superseded* by **KD-1**.
- **S3 — `on success` for individual `run_stmt`:** *Cancelled* (per **KD-4**, `on success` is removed).

---

## Test Corpus

Corpus test cases are organized inside the thematic `.txt` files under the submodules' `test/corpus/` directories:

### `packages/tree-sitter/tree-sitter-behavior/test/corpus/`
- **`whitespace.txt`:** Verifies KD-1 (newlines as extras, ignoring layout spacing).
- **`control-flow.txt`:** Verifies KD-2 (`end` terminators on `if/else`, `after`, `parallel`) and KD-4 (no `on success`).
- **`states.txt`:** Verifies KD-3 (flat state bodies and unordered orientation/handlers).
- **`error-handling.txt`:** Verifies KD-5 (parallel run failure restrictions) and inline/block failure blocks.
- **`handlers.txt`:** Verifies block-form vs inline-form handlers for `on intent` and `on offtopic`.
- **`actions.txt`:** Verifies setup and inline actions (`run`, `apply`, `remove`, `set`).
- **`triggers-merge.txt`:** Verifies merge preambles and global event triggers.

### `packages/tree-sitter/tree-sitter-description/test/corpus/`
- **`agent.txt`:** Verifies description block order flexibility (D3/G7).

---

## Implementation order

```
1. Grammar changes (tree-sitter) — KD-1 to KD-5, D3/G7, and corpus tests ✅ Done
2. AST mapper (parser-dsl)       — see DA01-01-ast-mapper-fixes.md
3. Error Reporting (parser/comp) — see DA01-01-diagnostics-dx.md
4. Docs updates                  — dsl/reference/behavior.md ✅ Done; description.md (D3/G7) ✅ Done
```
