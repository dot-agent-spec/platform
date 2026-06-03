# Changelog

All notable changes to the .agent DSL (Language) and the Tree-sitter Parser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the Parser.

---

## [Unreleased]

### Language (Spec 1.0.0-draft)
- **Added**: Formal documentation for `apply` and `remove` statements (UI manipulation).
- **Added**: Optional labels for `concept` (in types) and `run` (in behavior).
- **Changed**: Improved consistency for state handlers—`on offtopic` and `on fallback` now support inline `transition to`, matching `on intent`.
- **Changed**: Established Diátaxis-based documentation structure in `/docs`.

### Parser (0.2.2)
- **Added**: Support for inline `transition to` in `offtopic` and `fallback` handlers in `.behavior` files.
- **Fixed**: Corrected several documentation-to-grammar inconsistencies.
- **Improved**: Reorganized repository structure for better maintainability.

---

## [0.2.1] - 2026-06-03
- Initial release of the unified tree-sitter package.
