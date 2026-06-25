<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0021: Forgiving Syntax and Prettifier Architecture

| Field | Value |
|---|---|
| Status | Draft |
| Author | Danilo Borges |
| Created | 2026-06-24 |
| Target Release | v0.1 |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| ⚠️ | ⚠️ | ⚠️ | — | — |

---

## 1. Summary

This RFC proposes an architectural shift in the `dot-agent` language parser and tooling. Instead of enforcing strict formatting and block order via the `tree-sitter` grammar, we will relax the grammar to be highly forgiving. In exchange, we introduce a strict, mandatory **Prettifier** (auto-formatter) in `@dot-agent/compiler` that re-serializes valid code into a canonical, highly readable format. Structural and logical restrictions (such as duplicate blocks, state ordering, and FSM-exit guarantees) will be enforced by the Linter (Semantic Validation) rather than the parser.

The mechanism for relaxation is: **newlines are moved to `extras`** (cosmetic) in `.behavior`, and **structure is held entirely by keywords and an explicit `end` terminator**. This makes the grammar keyword-driven: the parser never needs to count newlines to understand block boundaries.

This RFC also serves as the **master plan for the v0.1 tree-sitter and parser-dsl unfreeze window.** All grammar and AST changes must be batched into this single window. Each grammar change in §4.1 requires a corresponding corpus test case under `packages/tree-sitter/test/corpus/forgiving-syntax/`.

---

## 2. Motivation

During three dogfooding passes — [`dogfood/rfc-author/EXPRESSIVENESS.md`](../dogfood/rfc-author/EXPRESSIVENESS.md), [`dogfood/sync-implementation-status/EXPRESSIVENESS.md`](../dogfood/sync-implementation-status/EXPRESSIVENESS.md), and [`dogfood/new-adr/EXPRESSIVENESS.md`](../dogfood/new-adr/EXPRESSIVENESS.md) — we identified a cluster of usability failures:

1. **LLM Token Waste:** LLMs struggle to guess invisible syntactic constraints (exact block order in `.description`, implicit newline rules in `parallel` and `on failure`), leading to generic `E004: Syntax error` and wasted generation roundtrips.
2. **Confusing Error Messages:** Syntactic errors surface prematurely, preventing semantic context. AST mapping errors (`E006`) leak internal Rust type names (`IntentBody`) at `line 1:1`, with no relationship to the actual offending line. Grammar errors (`E004`) and semantic errors (`E006`) share a flat error code, making the fix path opaque.
3. **Incomplete Grammar Coverage:** The validity of `run script … on failure` inside `if/else` bodies is undocumented and untested, forcing conservative workarounds.
4. **Rigid Developer Experience:** Strict same-line `on failure`, strict block order, and strict newline rules in `handler_block` make the language feel brittle for both human authors and LLMs.

The DSL is designed to be a highly readable human-AI contract. Enforcing readability at the parser level creates a hostile authoring environment. By applying Postel's Law ("Be conservative in what you do, be liberal in what you accept"), we can allow chaotic inputs from LLMs and enforce readability through tooling.

---

## 3. Design Details

### 3.1. Keyword-Driven Grammar (tree-sitter)

The `tree-sitter` grammar for `.behavior` files will be redesigned around **keywords as the sole structural signal**. Newlines are moved to `extras` (cosmetic whitespace) so the parser treats them identically to spaces. The grammar is maximally permissive in what it accepts — "liberal in what you accept."

The two structural mechanisms are:

- **Keywords delimit blocks:** every multi-statement block opens with a keyword (`if`, `on failure`, `on intent`, `on offtopic`, `after`, `parallel`) and is closed by an explicit `end` terminator.
- **`end` is the universal block terminator:** any block that could be followed by a sibling statement of the same kind — `if`, `on failure` (block form), `on intent`/`on offtopic` (block form), `after`, `parallel` — MUST close with `end`. A handler that contains a single action stays inline with NO `end` (e.g. `on failure transition to error`, `on intent "x" transition to y`). This inline single-action form has no ambiguity and no `end`.

Because newlines are extras, constructs that previously required same-line placement (like `on failure` after `run`) or strict multi-line layout (like multiple `run` statements inside `parallel`) work for free with no special grammar rules.

The `.description` file format is NOT changed by this RFC: it retains newline-sensitivity inside its free-text `description` block. All other `.description` structure is already keyword-driven. Only `.behavior` is affected.

Block order in `agent_decl` (`.description`) will change from a fixed `seq(...)` to `repeat(choice(...))` to allow blocks in any order (item D3/G7).

### 3.2. Semantic Validation (Linter)

Because the grammar is now permissive, structural and semantic rules move entirely to the compiler Linter. Rules that were previously "free" in the grammar now require explicit linter code and test coverage:

- **Block order:** The Linter enforces the canonical `goal` → `guide` → `teach*` → `interact` ordering in oriented states. The grammar accepts any order.
- **`interact` required in oriented states:** The Linter emits an error if an oriented state omits `interact`. The grammar accepts its absence.
- **At-least-one-exit (FSM guarantee):** The Linter verifies every state has at least one `transition` reachable from it. The grammar is blind to this.
- **Block uniqueness:** The grammar will accept multiple `input` blocks (for example). The `@dot-agent/compiler` Linter will emit `E010: Block 'input' declared multiple times`.
- **Contextual Errors:** AST mapping errors (`E006`) will be enriched to report semantic context (e.g., "Inside state X, on intent Y: statement type 'set' is not valid here").
- **Error Code Reform:** `E004` (grammar/tree-sitter) and `E006` (AST mapper/semantic) will be distinguished in error messages with a clear prose label so authors know whether the file failed to parse or parsed but was semantically invalid. Sub-codes or a dedicated `E007` for mapper failures are under evaluation.

### 3.3. The Prettifier (Formatter)

The Prettifier is **more central than in the original framing**: since the grammar now ignores newlines entirely, the canonical whitespace/indentation that human authors and LLMs expect to see is NOT enforced at parse time. The Prettifier is the sole mechanism that re-imposes it. Every pipeline that produces `.behavior` output for human consumption must run the Prettifier.

- **Implementation:** Built in TypeScript within `@dot-agent/compiler`.
- **Comment Preservation:** The formatter walks the `web-tree-sitter` syntax tree (which preserves `//` comments) to ensure developer notes are preserved and moved alongside their respective blocks.
- **Integration Points:**
  - **LSP:** `textDocument/formatting` support (Format on Save).
  - **CLI:** `dot-agent-cli format <file>` for batch processing.
  - **Packer:** The `pack` command will automatically strip comments to produce a lean execution artifact (`.agent` ZIP), but the user's source files on disk will NOT be stripped, preserving their development workflow.

### 3.4. Key Semantic Decisions

**`end` as universal block terminator**

The `end` keyword closes every multi-statement block. It is NOT required for inline single-action handlers:

```
# inline — no end
on failure transition to error_state

# block form — requires end
on failure
  run script "cleanup.sh"
  transition to error_state
end
```

The same rule applies to `if`, `on intent`/`on offtopic`, `after`, and `parallel`. This keeps inline handlers terse while making multi-statement blocks unambiguous without newline counting.

**`on failure` = catch-and-resume semantics**

The `on failure` handler is a catch-and-resume construct: the handler runs, then flow falls through to the next statement in the enclosing block. This is a **runtime and linter contract**, not a grammar rule. To abort-and-divert (exit the current state entirely), place a `transition` inside the handler:

```
run script "fetch.sh"
on failure
  run script "notify.sh"
  transition to error_state   # abort-and-divert
end
run script "process.sh"       # only reached if fetch.sh succeeded
```

**`on success` does not exist**

There is no `on success` handler — not on `run`, not on `parallel`, not anywhere. Success is always the implicit sequential fall-through. This is a deliberate design decision: adding `on success` as a symmetric construct would invite control-flow spaghetti. Authors who need conditional post-run routing should use `if` blocks or dedicated states.

The 0.3.4 CHANGELOG scoped `on success` to `parallel` only; this RFC removes it entirely from the language.

**`run` inside `parallel` carries no own `on failure`**

A `run` statement nested inside a `parallel` block is a restricted variant: it declares a concurrent task but cannot carry its own `on failure`. Group failure handling belongs on the `parallel` block itself.

**Flat `state_body`**

`state_body` in the grammar becomes a flat `repeat(statement)`. The grammar accepts any sequence of statements in any order. All ordering, structural, and semantic constraints (block order, `interact` required, FSM-exit guarantee, block uniqueness, native-states allowlist) are enforced by the Linter, not the grammar.

**`purpose` is not a DSL keyword**

`purpose` belongs to the intermediate (interop/inferable) abstraction layer and is filled by the runtime/LLM. It stays hardcoded `unknown` for now. No grammar change is needed (pre-public-consolidation C4).

---

## 4. Implementation Scope (v0.1 Unfreeze)

This RFC is the master plan for the upcoming `tree-sitter` and `parser-dsl` unfreeze window. The work is split into two layers that ship sequentially:

**Layer 1 — tree-sitter freeze (this window):** grammar changes in §4.1, corpus tests, `queries/highlights.scm`.

**Layer 2 — parser-dsl unfreeze (immediately after the freeze):** AST changes in §4.2 (L2/G2, C1, C6). These have no grammar dependency but should not race the grammar rewrite.

Each grammar change in §4.1 must have a corresponding corpus test case under `packages/tree-sitter/test/corpus/forgiving-syntax/` (one file per item, named after the item ID).

> **Scheduling note:** Native States (§4.3) is a compiler-only change with no grammar dependency — it can be shipped as a standalone fix before or after the unfreeze window.

### 4.1. Grammar Changes (packages/tree-sitter)

| Item | Source | Problem | Fix | Status |
|---|---|---|---|---|
| **D3/G7** | rfc-author G7 | `.description` blocks must follow a strict order (`agent_decl` uses `seq`) or fail with E004. | Change `agent_decl` to `repeat(choice(...))` so blocks are accepted in any order. | Active |
| **L3/G3** | rfc-author G3 | `on failure` rejected if placed on the next line after `run`. | ~~Add optional `_newline` before `failure_stmt` in `run_stmt`.~~ **SUPERSEDED:** once newlines are extras, `on failure` can appear anywhere after `run` with no special rule. No grammar change needed beyond the newline-to-extras migration. | Superseded |
| **S1** | sync-status S1 | `parallel` block crashes with E004 if multiple `run` statements are on separate lines. | ~~Fix `handler_block` to accept `_newline` between statements.~~ **SUPERSEDED:** once newlines are extras, multiple `run` statements on separate lines parse for free. No grammar change needed beyond the newline-to-extras migration. | Superseded |
| **S3** | sync-status S3 | `run_stmt` has no `on success` handler; `success_stmt` only exists for `parallel`. | **CANCELLED/REJECTED.** `on success` has been removed from the language entirely (including from `parallel`). Success is always the implicit sequential fall-through. Adding symmetric `on success` would invite control-flow spaghetti and was rejected as a design principle (see §3.4). | Cancelled |
| **Gap 1** | new-adr Gap 1 | `run script … on failure` inside an `if/else` body is undocumented and untested. | The keyword-driven grammar makes this valid for free. Add corpus test cases (`if-body-run-on-failure.behavior`). Document in `dsl/reference/behavior.md`. | Active |

The following are NEW grammar changes introduced by the keyword-driven design (not in the original RFC):

| Item | Description | Status |
|---|---|---|
| **KD-1** | Move newlines to `extras` in `tree-sitter-behavior`. `$._newline` removed from structural positions throughout the grammar. | Active |
| **KD-2** | Add `end` terminator to the grammar. All multi-statement blocks (`if`, `on failure` block, `on intent`/`on offtopic` block, `after`, `parallel`) close with `end`. Inline single-action handlers have no `end`. | Active |
| **KD-3** | Flatten `state_body` to `repeat(statement)`. All ordering rules move to the Linter. | Active |
| **KD-4** | Remove `success_stmt` rule entirely from `tree-sitter-behavior`. | Active |
| **KD-5** | Restrict `run` inside `parallel` to a simplified variant (no `on failure` clause). | Active |

### 4.2. AST Mapper Changes (packages/parser-dsl)

> **Scheduling:** These items ship in the parser-dsl layer (after the tree-sitter freeze). They have no grammar dependency.

| Item | Source | Problem | Fix | Status |
|---|---|---|---|---|
| **L2/G2** | rfc-author G2 | `set` statement inside `on intent` crashes AST mapper (`IntentBody` enum has no `Set` variant). | Add `Statement::Set` to `IntentBody`, or restrict the grammar and document the restriction. Preference: allow `set` in intent blocks (matches author mental model). | Active — next layer |
| **C1** | pre-public-consolidation C1 | Grammar emits `on failure` for `apply`/`remove`, but AST structs drop it silently. | Add `on_failed` field to `Apply` and `Remove` AST structs. | Active — next layer |
| **C6** | pre-public-consolidation C6 | Dead AST nodes in Rust (`OnComplete`, `OnFailed`, `RunStmt.each`) with no grammar counterpart. Additionally: `Parallel.on_complete` and `Statement::OnComplete` become dead once `on success` is removed from the language. | Remove dead variants from `parser-dsl`: `OnComplete`, `OnFailed`, `RunStmt.each`, `Parallel.on_complete`, `Statement::OnComplete`. | Active — next layer |
| ~~**S3-AST**~~ | sync-status S3 | `RunStmt` has no `on_success` field. | **CANCELLED** — `on success` has been removed from the language. No `on_success` field will be added. | Cancelled |

### 4.3. Compiler Work (packages/compiler)

| Item | Source | Description |
|---|---|---|
| **Native States** | rfc-author G5, sync-status S5 | Add `online`, `offline`, `ended` to the known-states allowlist so `transition to ended` doesn't yield `E005`. Compiler-only; no grammar dependency. |
| **Prettifier MVP** | Architecture (§3.3) | Build a `toCanonicalString(ast)` function using `web-tree-sitter` to enable the auto-formatting phase. **This is now the central enforcer of readable whitespace** — the grammar ignores newlines, so the Prettifier is what re-imposes canonical indentation and line breaks for human consumption. |
| **Linter Rules (migrated from grammar)** | Architecture (§3.2) | Implement linter rules for: block order in oriented states, `interact` required in oriented states, at-least-one-exit FSM guarantee, block uniqueness. These rules were previously enforced (imperfectly) by grammar constraints. |
| **AST Context (E006)** | rfc-author D1 | Upgrade `E006` to provide the current AST context (state name + handler) instead of `line 1:1` with a Rust internal type name. |
| **Error Code Reform (D4)** | rfc-author D4 | Distinguish grammar errors (`E004`, tree-sitter) from semantic/mapper errors (`E006`, AST) in user-facing messages with a clear prose label ("grammar error" vs. "AST mapping error"). Evaluate sub-codes (`E004` → `E004.grammar`, `E006` → `E006.mapper`) or a new `E007` for mapper failures. |

---

## 5. Deferred Items

The following gaps were surfaced in dogfooding but fall outside the grammar/AST-mapper scope of this RFC. They are tracked separately:

| Gap | Description | Tracked in |
|---|---|---|
| **S2** | `guide`/`goal` text with session variable interpolation (`guide "Drift: {{session.drift_summary}}"`) | [RFC-0019](0019-memory-binding.md) Open Question 4 — deferred to a future RFC extending memory binding |
| **S4 output** | Capturing script output into session memory (`capture session.features` after `run script`) | [RFC-0019](0019-memory-binding.md) — extends the memory-binding surface; needs a separate RFC or RFC-0019 amendment |
| **Gap 3** | Two-terminal-state pattern for branching `done` messages (`done_plain`/`done_superseded`) | Documentation task — add canonical workaround to `dsl/reference/behavior.md` |
| **Gap 4** | Entry-point declaration — first `state` is entry point by implicit convention, undocumented | Documentation task — add to `dsl/reference/behavior.md` |
| **Gap 5** | Effort/model annotation on `run subagent` (`run subagent "x.behavior" effort "high"`) | [RFC-0006](0006-experimental-roadmap.md) — tracked under "Subagent Contracts" open question |

---

## 6. Drawbacks & Trade-offs

- **Prettifier is now load-bearing:** The Prettifier is no longer a nice-to-have — it is the only mechanism that enforces readable whitespace. Any pipeline that produces `.behavior` output for human consumption must run it. This raises the shipping bar for Prettifier MVP.
- **Linter Burden:** Rules that were "free" in the grammar (block uniqueness, state ordering, `interact` required, FSM-exit guarantee) now require explicit linter code and test coverage. This is a net increase in compiler complexity.
- **`end` as new keyword:** Authors must learn that multi-statement blocks close with `end`. The inline single-action form (no `end`) and the block form (`end` required) coexist. The Prettifier is responsible for making this visually unambiguous in canonical output.
- **`on success` removal:** Authors who previously relied on `on success` in `parallel` (defined in grammar 0.3.4) must migrate to `if` blocks or dedicated success states. This is a breaking change to the 0.3.4 spec.

---

## 7. Alternatives Considered

- **Keep Grammar Strict, Improve Parser Errors:** We could keep the strict `seq()` and write complex error recovery logic. This does not solve the token waste problem — the LLM still executes another generation turn to fix block order. Auto-formatting saves an entire roundtrip.
- **Implement Prettifier in Rust:** We could add `.to_canonical_string()` to the `parser-dsl` structs. However, the Rust structs discard comments by design. Moving this to TypeScript using `web-tree-sitter` is the only safe way to preserve developer workflow.
- **Relax `_newline` incrementally (original approach):** The original §3.1 proposed making `_newline` optional in specific positions (`handler_block`, `failure_stmt`, etc.). This was rejected because it requires auditing every position individually and still leaves the grammar newline-sensitive. Moving newlines to `extras` globally is simpler, more complete, and consistent.
- **`on success` as sugar for `transition to`:** We considered keeping `on success` as a symmetric construct to `on failure`. This was rejected: success is always the implicit sequential fall-through, and adding an explicit `on success` handler would invite authors to create non-linear control flow where simple sequencing suffices. The asymmetry is intentional — `on failure` exists to handle the exception; the happy path needs no annotation.

---

## Related

- [`dogfood/rfc-author/EXPRESSIVENESS.md`](../dogfood/rfc-author/EXPRESSIVENESS.md) — primary source: G2, G3, G5, G7, D1–D4
- [`dogfood/sync-implementation-status/EXPRESSIVENESS.md`](../dogfood/sync-implementation-status/EXPRESSIVENESS.md) — S1, S3, S5
- [`dogfood/new-adr/EXPRESSIVENESS.md`](../dogfood/new-adr/EXPRESSIVENESS.md) — Gap 1
- [RFC-0019: Memory Binding](0019-memory-binding.md) — S2 and S4 deferred here; G1 and G4 resolved there
- [RFC-0006: Experimental Roadmap](0006-experimental-roadmap.md) — Gap 5 (effort annotation on subagent) tracked there
- [`dsl/reference/behavior.md`](../dsl/reference/behavior.md) — canonical `run`, `on failure`, `parallel`, `if` semantics
- [`dsl/reference/description.md`](../dsl/reference/description.md) — description block ordering (D3/G7)
