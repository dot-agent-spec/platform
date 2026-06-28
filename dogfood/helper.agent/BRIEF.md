# Brief — Embed a `helper.agent` in the CLI (+ DSL dogfood)

## Context

As part of DA01-03 (CLI run refactor + MCP server), a secondary goal emerged: instead of
a static `dot-agent://howto` MCP resource, embed a **real running agent** inside the CLI
package that teaches the platform interactively. Invoked via `dot-agent run --helper`, it
starts as an MCP server and navigates the author through DSL syntax, MCP interaction, and
agent authoring via FSM state transitions.

Unlike the other dogfood entries in this folder, this was a **full implementation** — the
agent was authored, linted, packed to `assets/helper.agent`, and shipped as part of the
CLI. The DSL modeling exercise is therefore grounded in a live artifact.

## Task

Model a 20-state interactive guide as a `.behavior` / `.description`:

- **Topics covered:** about, dsl (description/behavior/states/effects/memory/persona),
  mcp (tools/resources/effects), generate (description/behavior/patterns/validate/pack),
  and example
- **Navigation pattern:** every state has `on intent "back" → init` and `on offtopic`
  as a catch-all; `teach "filename.md"` references knowledge files for rich content
- **Generate branch:** walks an LLM author through scaffolding a new `.agent` step by step

## Authoring environment

- CLI at `apps/dot-agent-cli/`, source in `helper-src/`
- Linted and packed with `dot-agent run` and `dot-agent pack`
- Knowledge files in `helper-src/knowledge/` hold all rich content (code examples, tables)
