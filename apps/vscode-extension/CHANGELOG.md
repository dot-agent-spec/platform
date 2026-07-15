# Changelog

All notable changes to the `.agent DSL` VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.10.1] - 2026-07-14

### Changed
- Rebuilt and republished to pick up bundled fixes from `@dot-agent/tree-sitter` 0.10.1 (`tree-sitter generate` under `type: module`) and `@dot-agent/compiler` 0.10.1 (`E018` false-positive packing fix). This extension bundles those packages' build output directly into the `.vsix` rather than resolving them via npm, so it doesn't inherit fixes automatically — no source change in `apps/vscode-extension` itself this round.

---

## [0.10.0] - 2026-07-10

- First public release on the VS Code Marketplace and Open VSX.
