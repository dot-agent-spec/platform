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
- Mode B (autonomous test-drive) skill, `lspServers` for `.agent` authoring diagnostics, and
  push-driven engine-transition notifications (background monitor / Channels) are roadmap items, not
  v1.
- **No runtime is bundled, by design.** The plugin shells out to the one globally-installed
  `dot-agent` CLI rather than vendoring a copy of it — neither a Bun-compiled standalone binary nor a
  vendored `dist/cli.mjs`. A second copy of the runtime would drift from the published package.

## Requirements

Node.js. The `dot-agent` CLI must be on `PATH` — the skill's **Step 0** installs it on first use
(`npm i -g @dot-agent/cli`) if it isn't already there, so no manual setup is needed. See
[`apps/dot-agent-cli`](../../apps/dot-agent-cli).

One caveat on a machine that didn't have the CLI beforehand: the two `mcpServers` above start when the
plugin is *enabled*, which is before any skill runs, so they fail that first time. After Step 0 installs
the CLI, `/reload-plugins` brings them up. Plain `dot-agent run ...` commands work immediately.

## Full plan

See [`project/tasks/dot-agent-claude-skill.md`](../../project/tasks/dot-agent-claude-skill.md)
(tracker: platform#13).
