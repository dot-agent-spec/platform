# DSL — Consolidated Specification

Unified specification for the two file formats of the agent ecosystem: `.agent` (manifest) and `.flow` (behavior).

## Documents

| File | Purpose |
|------|---------|
| [`language.md`](language.md) | Language design, architecture, type system, security model, packaging — the main spec |
| [`roadmap.md`](roadmap.md) | Spec evolution roadmap |

## Tooling

| Package | Purpose |
|---------|---------|
| [tree-sitter-agent](https://github.com/daniloborges/dot-agent-tree-sitter) | Tree-sitter parsers for `.agent` and `.flow` (git submodule) — canonical grammar source |
| [language-server](https://github.com/daniloborges/language-server) | Standalone LSP server — hover, completions, diagnostics, go-to-definition, references, rename, symbols, formatting (git submodule) |
| [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) | VS Code extension — thin LSP client + Flow Graph and status bar |
| zed-agent/ | Zed extension — syntax highlighting + LSP client configuration |

### LSP architecture

The [language-server](https://github.com/daniloborges/language-server) package implements all IDE intelligence as a standalone Node.js process that speaks the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) over stdio. Both the VS Code and Zed extensions act as thin clients that start this server and delegate IDE features to it. This means any LSP-capable editor (Neovim, Helix, Emacs, …) can use the same server with minimal configuration.

## Mental model

```
.agent  =  manifest  (the public contract — what the agent is, consumes, and exposes)
.flow   =  behavior  (the implementation — how it executes, state by state)
```

The `.agent` points to its `.flow` via `behavior main.flow`. The Runtime reads the manifest for sandboxing and discovery; it executes the flow for orchestration.

Both `.flow` and `.run` (WASM) serve the same purpose: deterministic state orchestration. `.flow` is a text-based subset of `.run` — designed for authoring agents without writing compiled code. See [`language.md §1.3`](language.md#13-flow-and-run-same-purpose-different-formats) for the full explanation.

## History

This directory was consolidated from two separate specs (`DSL/` for `.agent` and `flow-lang/` for `.flow`). Prior state is preserved in the git history.
