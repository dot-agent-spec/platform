# Changelog

All notable changes to the .agent DSL (Language) and the Tree-sitter Parser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the Parser.

---

## [Unreleased]

### Language (Spec 1.0.0-draft)
- **Changed**: `on offtopic` is now optional in oriented states. At least one `on intent` handler already guarantees a state exit path. Off-topic handling belongs in a dedicated state reached by explicit routing — not enforced at every state boundary.

### Parser
- **Changed**: `offtopic_handler` wrapped in `optional()` in `oriented_state_body` grammar rule.
- **Updated**: `tree-sitter-behavior/test/corpus/basic.txt` — removed `on offtopic` from states that don't need it; added explicit case for oriented state without offtopic; added `greeting_with_offtopic` case to confirm offtopic still parses when present.

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
