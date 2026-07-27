# dot-agent (Claude Code plugin)

A native Claude Code plugin that loads and drives any [dot-agent](https://dot-agent.ai) FSM-based
`.agent` project. Say "load this agent and follow its flow" and Claude embodies it — no separate
CLI setup, no `~/.claude.json` edit.

## Install

```
/plugin marketplace add dot-agent-spec/platform
/plugin install dot-agent
```

Requires Node.js. The `dot-agent` CLI must be on `PATH` — the skill installs it on first use
(`npm i -g @dot-agent/cli`) if it isn't already there.

## Quickstart

```
load path/to/your-agent.agent and follow its flow
```

Claude adopts the agent's persona and drives its states with you, signalling transitions as you go.
Say it again with a different `.agent` (or the same one) any time to restart the flow.

To dry-run an agent yourself, without a human in the loop:

```
test path/to/your-agent.agent — walk the whole flow and tell me where it breaks
```

## What it bundles

- **`/dot-agent:run`** — the default skill: embodies and drives a loaded agent (Mode A), and also
  guides authoring a new agent from scratch.
- **`/dot-agent:test`** — opt-in autonomous test-drive (Mode B): triggers only on an explicit
  "test/dry-run this agent" ask, never on an ordinary "load this agent."
- **`dot-agent` MCP server** — scaffold/pack/lint tooling plus the agent runtime. It starts with no
  agent loaded; `load_agent(source)` loads (or reloads) one, after which `send_intent` and friends
  drive it.
- **`dot-agent-helper` MCP server** — an interactive DSL reference/authoring guide, kept separate
  since it's itself a loaded agent (folding it into `dot-agent` would mean loading your own project
  evicts the helper mid-authoring).

## Known limits

- One loaded agent per session — loading a new one replaces whatever was running.
- A subagent sharing the main thread's connection shares its loaded agent too; a subagent calling
  `load_agent` evicts whatever the main thread had loaded.
- `after N prompts` transitions aren't ticked automatically on this surface yet.
- No `.description`/`.behavior` authoring diagnostics (go-to-def, live lint) yet.

On a machine that didn't have the CLI beforehand, the MCP servers may fail to start the first time
(they start on enable, before Step 0 can install the CLI) — run `/reload-plugins` after Step 0
installs it.

## More

Design rationale: [`DA00-07`](../../project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
Work items and status: [`project/tasks/DA00-07-dot-agent-claude-skill.md`](../../project/tasks/DA00-07-dot-agent-claude-skill.md)
(tracker: platform#13). Sync invariants between this plugin's skills and the CLI's own copy:
[`AGENTS.md`](AGENTS.md).
