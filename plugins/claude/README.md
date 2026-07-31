<h1 align="center">dot-agent for Claude Code</h1>

<p align="center">
  <b>Run any <code>.agent</code> inside Claude Code — the universal file format for portable AI.</b><br>
  Point Claude at an <code>.agent</code> and it becomes that agent: it adopts the persona, and the
  agent's own state machine decides what it may say next.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-000?logo=anthropic&logoColor=white" alt="Claude Code plugin">
  <a href="https://www.npmjs.com/package/@dot-agent/cli"><img src="https://img.shields.io/npm/v/@dot-agent/cli?label=%40dot-agent%2Fcli" alt="@dot-agent/cli on npm"></a>
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#what-it-bundles">What it bundles</a> ·
  <a href="#known-limits">Known limits</a> ·
  <a href="https://dot-agent.ai">dot-agent.ai</a>
</p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/dot-agent-spec/platform/main/docs/images/claude-plugin.png" alt="Claude Code running the Fridge Assistant example agent: it adopts the persona, matches the user's ingredients to a recipe from the agent's catalog, then declines to invent one that isn't in it" width="720">
</p>

## Why

Telling a model to stay on script is a request, and it is granted right up until it isn't.

The refusal above is not the model being careful. `mushroom risotto` is a perfectly good vegetarian dish
that any model could improvise, and the agent declined anyway — because the state it was in has no
transition that produces a recipe from outside its catalog. The constraint is not advice in a prompt; it is
the shape of the flow.

That flow is a `.behavior` file: states, goals, and the intents that move between them, in text you can
read, review and diff like any other source. This plugin is what runs it inside Claude Code — no separate
CLI session to babysit, no `~/.claude.json` to edit.

## Install

```bash
claude plugin marketplace add dot-agent-spec/platform
claude plugin install dot-agent@dot-agent-spec
```

The marketplace is added from the repository (`dot-agent-spec/platform`) but registers under its own name
(`dot-agent-spec`), which is what the plugin is qualified by.

Or try it from a local checkout with `claude --plugin-dir ./plugins/claude`.

## Quickstart

Point Claude at an agent — a `.agent` bundle or a project directory:

```
/dot-agent:run path/to/your-agent.agent
```

Plain language works too, since the skill is model-invocable:

```
load path/to/your-agent.agent and follow its flow
```

Claude adopts the agent's persona and drives its states with you, signalling transitions as you go. Say it
again with a different `.agent` — or the same one — any time to restart the flow.

To dry-run an agent yourself, without a human in the loop:

```
test path/to/your-agent.agent — walk the whole flow and tell me where it breaks
```

The screenshot above is [`examples/2. Fridge Assistant`](https://github.com/dot-agent-spec/platform/tree/main/examples), which you can clone and run as-is.

## What it bundles

- **`/dot-agent:run`** — the default skill: embodies and drives a loaded agent, and also guides authoring a
  new agent from scratch.
- **`/dot-agent:test`** — opt-in autonomous test-drive: triggers only on an explicit "test/dry-run this
  agent" ask, never on an ordinary "load this agent."
- **`dot-agent` MCP server** — scaffold/pack/lint tooling plus the agent runtime. It starts with no agent
  loaded; `load_agent(source)` loads (or reloads) one, after which `send_intent` and friends drive it.
- **`dot-agent-helper` MCP server** — an interactive DSL reference/authoring guide, kept separate since
  it's itself a loaded agent (folding it into `dot-agent` would mean loading your own project evicts the
  helper mid-authoring).

## Known limits

- One loaded agent per session — loading a new one replaces whatever was running.
- A subagent sharing the main thread's connection shares its loaded agent too; a subagent calling
  `load_agent` evicts whatever the main thread had loaded.
- `after N prompts` transitions aren't ticked automatically on this surface yet.
- No `.description`/`.behavior` authoring diagnostics (go-to-def, live lint) yet.

On a machine that didn't have the CLI beforehand, the MCP servers may fail to start the first time (they
start on enable, before the skill can install the CLI) — run `/reload-plugins` once it has.

## Requirements

Node.js. The `dot-agent` CLI must be on `PATH`; the skill installs it on first use
(`npm i -g @dot-agent/cli`) if it isn't already there.

## License

Apache-2.0 — see [LICENSE](https://github.com/dot-agent-spec/platform/blob/main/LICENSE). Why the plugin
ships no bundled runtime:
[DA00-07](https://github.com/dot-agent-spec/platform/blob/main/project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
