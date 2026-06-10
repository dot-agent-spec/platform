# Changelog

All notable changes to the .agent DSL (Language) and the Tree-sitter Parser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the Parser.

---

## [Unreleased]

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
