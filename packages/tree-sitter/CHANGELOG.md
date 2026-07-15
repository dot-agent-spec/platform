# Changelog

All notable changes to the .agent DSL (Language) and the Tree-sitter Parser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the Parser.

---

## [0.10.1] - 2026-07-14

### Fixed
- `tree-sitter generate` failed under `"type": "module"` — fixed to run correctly regardless of the package's own module type.

### Changed
- Build tooling migrated from `tsup` to `tsdown`; upgraded to TypeScript 7. No output-shape change.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
