# dot-agent (Claude Code plugin)

A native Claude Code plugin for building and running [dot-agent](https://dot-agent.ai) FSM-based
`.agent` projects — not a CLI wrapper. Enabling the plugin auto-registers everything below; there is
no `dot-agent-cli configure` step and no `~/.claude.json` edit.

## What it bundles

- **`skills/run`** — the `/dot-agent:run` skill: comportment for embodying and driving a loaded
  agent (Mode A), plus authoring guidance for new agents. Canonical source of this comportment is
  [`dsl/reference/comportment.md`](../../dsl/reference/comportment.md); this skill mirrors it (see
  [AGENTS.md](AGENTS.md) for the sync rule).
- **`skills/test`** — the `/dot-agent:test` skill: Mode B, autonomous test-drive. Opt-in
  only (triggers on an explicit "test/dry-run this agent" ask, never on an ordinary "load this agent");
  points back at `/dot-agent:run` for comportment rather than duplicating them, and adds only the one
  behavioral delta (synthesize the human's turn instead of waiting) plus the subagent isolation caveat.
- **`mcpServers`** (auto-started on enable, both agent-agnostic — neither needs a chosen `.agent` to
  start):
  - `dot-agent` — scaffold/pack/lint tooling (`dot_agent_init`/`pack`/`unpack`/`configure`) **and**
    the agent runtime, on one server. It boots with no agent loaded; its `load_agent(source)` tool
    loads (or reloads) one, after which `send_intent`/`send_event`/`tick_prompt`/`inject_memory` and
    the `dot-agent://state`/`intents`/`graph`/`memory`/`persona`/`guides`/`knowledge` resources drive
    it. Calling `load_agent` again replaces whatever was loaded — that's also how you restart a flow.
  - `dot-agent-helper` — interactive DSL reference/authoring guide (`dot-agent run --helper`), kept
    separate on purpose: it's itself a loaded agent, and folding it into `dot-agent` would mean
    `load_agent`-ing your own project evicts the helper mid-authoring.

Why one runtime tool list works for *any* agent without a restart: the server's tools are registered
once at boot against an empty holder, not against a fixed session — see
[`apps/dot-agent-cli/src/commands/mcp-run.ts`](../../apps/dot-agent-cli/src/commands/mcp-run.ts)'s
`Runtime` type. Claude Code fixes a server's tool list at connect time and can't attach to a server
launched mid-session, so a per-agent server that only exists once an agent is chosen — the earlier
design here — could never actually be reached from the skill; see the plan doc's item 3 for why.

## What it does NOT bundle (yet)

- No `UserPromptSubmit` hook in v1: `after N prompts` transitions stay a documented degradation on
  this surface until a tick channel is designed (see the plan doc referenced below).
- `lspServers` for `.agent` authoring diagnostics, and push-driven engine-transition notifications
  (background monitor / Channels) are roadmap items, not v1.
- **No runtime is bundled, by design.** The plugin shells out to the one globally-installed
  `dot-agent` CLI rather than vendoring a copy of it — neither a Bun-compiled standalone binary nor a
  vendored `dist/cli.mjs`. A second copy of the runtime would drift from the published package.
- **One loaded agent per `dot-agent` server process.** Under stdio that's one process per Claude Code
  session, so sessions never bleed into each other — but a subagent sharing the main thread's MCP
  connection also shares its loaded agent, so a subagent calling `load_agent` evicts whatever the main
  thread had loaded. Relevant mainly to the still-unshipped Mode B skill.

## Requirements

Node.js. The `dot-agent` CLI must be on `PATH` — the skill's **Step 0** installs it on first use
(`npm i -g @dot-agent/cli`) if it isn't already there, so no manual setup is needed. See
[`apps/dot-agent-cli`](../../apps/dot-agent-cli).

One caveat on a machine that didn't have the CLI beforehand: the two `mcpServers` above start when the
plugin is *enabled*, which is before any skill runs, so they fail that first time. After Step 0 installs
the CLI, `/reload-plugins` brings them up — then `load_agent` works with no further restart.

## Full plan

See [`project/tasks/dot-agent-claude-skill.md`](../../project/tasks/dot-agent-claude-skill.md)
(tracker: platform#13).
