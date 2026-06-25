# Changelog

All notable changes to the .agent DSL (Language) and the Tree-sitter Parser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the Parser.

---

## [Unreleased]

### Language (Spec 1.0.0-draft)
- **Changed**: `on offtopic` is now optional in oriented states. At least one `on intent` handler already guarantees a state exit path. Off-topic handling belongs in a dedicated state reached by explicit routing — not enforced at every state boundary.
- **Changed**: `.behavior` grammar is now **keyword-driven**. Structure is held entirely by keywords and an explicit `end` terminator; newlines are cosmetic. This completes the direction started in 0.3.4 ("keyword-delimited blocks") and removes the last remaining reliance on newline position for block delimiting.
- **Added**: `end` keyword terminates every multi-statement block that could be followed by a sibling statement of the same kind: `if`, `on failure` (block form), `on intent`/`on offtopic` (block form), `after`, and `parallel`. A handler containing a single action stays inline with NO `end` (e.g. `on failure transition to error`, `on intent "x" transition to y`).
- **Changed**: `on failure` has catch-and-resume semantics: after the handler body executes, flow falls through to the next statement in the enclosing block. To abort-and-divert, place a `transition` inside the handler. This is a runtime/linter contract enforced by the Linter, not the grammar.
- **Removed**: `on success` removed entirely from the language. Success is always the implicit sequential fall-through. `on success` is no longer valid on `parallel` (where it was briefly defined in 0.3.4) or anywhere else. TODO(review): confirm whether any corpus tests, examples, or docs still reference `on success` in `parallel` and need updating.
- **Changed**: `run` nested inside a `parallel` block is a restricted variant — it declares a concurrent task but carries no own `on failure` handler. Group failure handling belongs on the enclosing `parallel` block.
- **Changed**: Block order, `interact`-required constraint, FSM-exit guarantee (at least one reachable `transition`), and block uniqueness are no longer enforced by the grammar. The grammar is now maximally permissive ("liberal in what it accepts"). These rules are enforced by the Linter (Semantic Validation). TODO(review): Linter rules for block order / interact-required / FSM-exit are not yet implemented — confirm scheduling relative to this grammar freeze.

### Parser
- **Changed**: `offtopic_handler` wrapped in `optional()` in `oriented_state_body` grammar rule.
- **Updated**: `tree-sitter-behavior/test/corpus/basic.txt` — removed `on offtopic` from states that don't need it; added explicit case for oriented state without offtopic; added `greeting_with_offtopic` case to confirm offtopic still parses when present.
- **Changed**: Newlines moved to `extras` in `tree-sitter-behavior`. `$._newline` removed from all structural positions in the grammar. Horizontal whitespace continues to be silently consumed via `extras` as before.
- **Removed**: `success_stmt` rule removed from `tree-sitter-behavior` grammar.
- **Changed**: `state_body` flattened to `repeat(statement)`. The grammar accepts any sequence of statements in any order.
- **Changed**: `failure_stmt` accepts either inline single-action form (no `end`) or block form (multiple statements followed by `end`).
- **Changed**: `run` inside `parallel` uses a restricted production with no `failure_stmt` clause.
- **Updated**: Corpus reorganized — existing cases updated to remove reliance on newline position; new corpus directory `test/corpus/forgiving-syntax/` added for keyword-driven test cases. TODO(review): list specific new corpus files to add (one per §4.1 item: `D3-G7`, `Gap1`, `KD-1` through `KD-5`).

---

## [0.4.0] - 2026-06-18

### Tooling / Package Structure
- **Changed**: Grammar folders reorganized for symmetry — description grammar moved from root into `tree-sitter-description/`, behavior grammar renamed from `behavior/` to `tree-sitter-behavior/`.
- **Changed**: Grammar name `dot_agent` renamed to `description`; compiled WASM renamed from `tree-sitter-dot_agent.wasm` to `tree-sitter-description.wasm`.
- **Changed**: `index.js` export `agentWasmPath` renamed to `descriptionWasmPath` (breaking).
- **Changed**: npm scripts made symmetric — `generate-description` / `generate-behavior` / `generate` (all); `test-description` / `test-behavior` / `test` (all); `build:wasm-description` / `build:wasm-behavior`.
- **Added**: `bindings/rust/src/lib.rs` restored and updated — `language_agent()` renamed to `language_description()` (breaking); `include_str!` path updated for new folder layout.

---

## [0.3.4] - 2026-06-16

### Language (Spec 1.0.0-draft)
- **Changed**: Oriented state structure is now `goal` → `guide?` → `teach*` → `interact` → `handler+`: `goal` is required, `guide` is optional.
- **Changed**: `guide` accepts inline text or a filepath; `teach` accepts filepaths only.
- **Changed**: `on fallback` removed; error handling split into `on failure` (for `run`/`apply`/`remove`) and `on success` (for `parallel`).
- **Changed**: `run` syntax is now `run <type> "target" ["parameters"]` — `[label]` and modifiers (`silent`, `in background`) removed.
- **Changed**: `apply`/`remove` support `css` only; `html` and `video` targets removed.

### Parser
- **Changed**: Grammar rewritten to use keyword-delimited blocks; external scanner (`scanner.c`) removed — structure is now delimited by keywords and newlines instead of INDENT/DEDENT tokens.
- **Fixed**: `guide_stmt` in `oriented_state_body` wrapped in `optional()` to match spec intent.
- **Updated**: `behavior/queries/highlights.scm` synced with current node types — removed stale keywords (`silent`, `in`, `background`, `each`, `fallback`, `complete`, `failed`, `html`, `video`); fixed node type references (`interact_stmt` node, `null` named node, `state_name`, `intent_handler`).
- **Updated**: `behavior/test/corpus/basic.txt` rewritten for current grammar (all 8 cases).

---

## [0.3.3] - 2026-06-10

### Language (Spec 1.0.0-draft)
- **Changed**: `category` is now a required first line in every `type` declaration; `concept` remains optional and follows `category` when present.
- **Removed**: `schema` property from type declarations (was `schema <file.json>`).

### Parser (0.3.3)
- **Removed**: INDENT/DEDENT tokenization — `src/scanner.c` no longer emits indentation tokens. Newlines are now explicit in the grammar via `$._newline`; horizontal whitespace is still silently consumed by `extras`, so files remain visually indentable.
- **Changed**: All agent blocks (`description`, `behavior`, `persona`, `requires`, `input`, `output`, `capabilities`) are now optional fields nested inside `agent_decl` instead of top-level statements.
- **Fixed**: `type_reference` node name corrected in `queries/highlights.scm` (was `type_ref`).
- **Fixed**: `ontology_label` node type used for `category`/`concept` label fields in `queries/highlights.scm` (was `bare_string`).

---

## [0.2.1] - 2026-06-03
- Initial release of the unified tree-sitter package.
