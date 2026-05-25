# DSL — Consolidated Specification

Unified specification for the two file formats of the agent ecosystem: `.agent` (manifest) and `.flow` (behavior).

## Documents

| File | Purpose |
|------|---------|
| [`language.md`](language.md) | Language design, architecture, type system, security model, packaging — the main spec |
| [`roadmap.md`](roadmap.md) | Spec evolution roadmap |

## Tooling

| Directory | Purpose |
|-----------|---------|
| [`tree-sitter/`](tree-sitter/) | Tree-sitter parsers for `.agent` and `.flow` (git submodule) — canonical grammar source |
| [`vscode-extension/`](vscode-extension/) | VS Code extension for `.agent` |
| [`zed-agent/`](zed-agent/) | Zed extension for `.agent` |

> `.flow` tooling (TextMate grammar, snippets) is in `dsl-old/flow-lang/syntax/`. Consolidation into a unified extension is Stage 5 of the roadmap.

## Mental model

```
.agent  =  manifest  (the public contract — what the agent is, consumes, and exposes)
.flow   =  behavior  (the implementation — how it executes, state by state)
```

The `.agent` points to its `.flow` via `behavior main.flow`. The Runtime reads the manifest for sandboxing and discovery; it executes the flow for orchestration.

Both `.flow` and `.run` (WASM) serve the same purpose: deterministic state orchestration. `.flow` is a text-based subset of `.run` — designed for authoring agents without writing compiled code. See [`language.md §1.3`](language.md#13-flow-and-run-same-purpose-different-formats) for the full explanation.

## History

Consolidated from two separate directories:
- `dot-agent-spec/DSL/` — original `.agent` spec
- `flow-lang/` — original `.flow` spec

Prior state is preserved in `entelekheia/dsl-old/`.
