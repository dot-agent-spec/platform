# dot-agent (Claude Code plugin)

A native Claude Code plugin for building and running [dot-agent](https://dot-agent.ai) FSM-based
`.agent` projects — not a CLI wrapper. Enabling the plugin auto-registers everything below; there is
no `dot-agent-cli configure` step and no `~/.claude.json` edit.

## What it bundles

- **`skills/dot-agent`** — the `/dot-agent` skill: comportment for embodying and driving a loaded
  agent (Mode A), plus authoring guidance for new agents. Canonical source of this comportment is
  [`dsl/reference/comportment.md`](../../dsl/reference/comportment.md); this skill mirrors it (see
  [AGENTS.md](AGENTS.md) for the sync rule).
- **`mcpServers`** (auto-started on enable):
  - `dot-agent-dev` — scaffold/pack/lint tooling (`dot-agent server-mcp`).
  - `dot-agent-helper` — interactive DSL reference/authoring guide (`dot-agent run --helper`).

## What it does NOT bundle (yet)

- The **per-agent runtime** MCP server (`dot-agent run <src> --mcp`, exposing `send_intent` /
  `tick_prompt`) is launched on demand by the skill when the user loads a specific `.agent` — it can't
  auto-start at enable-time because it needs a chosen agent source.
- No `UserPromptSubmit` hook in v1: `after N prompts` transitions stay a documented degradation on
  this surface until a tick channel is designed (see the plan doc referenced below).
- Mode B (autonomous test-drive) skill, a bundled standalone binary, `lspServers` for `.agent`
  authoring diagnostics, and push-driven engine-transition notifications (background monitor /
  Channels) are roadmap items, not v1.

## Requirements

`dot-agent` (the CLI) must be on `PATH`. Install via `npm i -g @dot-agent/cli` or see
[`apps/dot-agent-cli`](../../apps/dot-agent-cli).

## Full plan

See [`project/tasks/dot-agent-claude-skill.md`](../../project/tasks/dot-agent-claude-skill.md)
(tracker: platform#13).
