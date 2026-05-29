# dot-agent

A domain-specific language for defining autonomous agents and their behavioral state machines. The ecosystem consists of two file formats — `.agent` (manifest) and `.flow` (behavior) — together with the tooling that parses, validates, and executes them.

## Specification

| Document | Description |
|----------|-------------|
| [`dsl/language.md`](dsl/language.md) | Language design, type system, memory model, security model, and packaging — the main spec |
| [`dsl/roadmap.md`](dsl/roadmap.md) | Spec evolution roadmap |

## Tooling

| Package | Description |
|---------|-------------|
| [tree-sitter-agent](https://github.com/daniloborges/dot-agent-tree-sitter) | Tree-sitter parsers for `.agent` and `.flow` — canonical grammar source |
| [language-server](https://github.com/daniloborges/language-server) | Standalone LSP server — hover, completions, diagnostics, go-to-definition, references, rename, symbols, formatting |
| [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) | VS Code extension — thin LSP client + Flow Graph panel and status bar |
| dot-agent-kernel | WASM execution engine — Rust library that parses and runs `.flow` files compiled to WebAssembly |

## Examples

The [`examples/`](examples/) directory contains annotated `.agent` + `.flow` pairs demonstrating common agent patterns:

```
examples/
  builder/        # Agent that plans and delegates subtasks
  customer-support/
  booking/
```

Each example folder contains a `.agent` manifest, one or more `.flow` behavior files, and a brief README.

## License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).
