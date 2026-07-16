---
name: dot-agent
description: "Use when the user asks you to run, build, or interact with a .agent file or dot-agent project. Also use when generating a new .agent from scratch — the helper has authoring templates. Trigger: /dot-agent"
---

# /dot-agent

dot-agent is a platform for building FSM-based agents that communicate via MCP. An agent is a directory (or `.agent` bundle) containing a `.description` file, a `.behavior` file, and optional knowledge and guide files.

## CLI commands

```
dot-agent run <dir | file.agent>                   # load and start an agent
dot-agent run <source> --mcp                       # start MCP server (stdio)
dot-agent run <source> --mcp --mcp-transport http  # start MCP server (HTTP)
dot-agent run --helper                             # interactive DSL guide via MCP
dot-agent pack --dir <dir> --out <file.agent>      # bundle agent to archive
dot-agent unpack <file.agent> --out <dir>          # extract archive to directory
dot-agent init --name <name> --domain <domain>     # scaffold new agent project
```

## Interactive helper

For DSL reference, authoring templates, and MCP interaction guidance, run the embedded helper agent:

```
dot-agent run --helper
```

This starts a stdio MCP server. After connecting, always read `dot-agent://intents` first —
valid intents are state-dependent and change between releases, so treat any topic list below
as illustrative, not authoritative. As of this writing, the top-level topics from `init` are
roughly: `dsl` (the .description/.behavior format), `gen` (authoring a new agent), `cli`
(CLI/MCP usage), `pack` (packaging). Re-read `dot-agent://intents` after every `send_intent`
call — do not assume a topic name still applies after a transition.

## MCP interaction loop

When an agent is running with `--mcp`:

1. Read `dot-agent://state` and `dot-agent://intents` to understand current state
2. Call `send_intent` with one of the listed intents
3. Read the `effects` array in the response: `goal`, `guide`, `teach` (its `text` is a path already prefixed with `guides/`/`knowledge/` — fetch via `dot-agent://<text>` verbatim), `request_interact`
4. If `request_interact` is present, collect user input and call `send_intent` or `send_offtopic`
5. Repeat from step 1

Topic/intent names are state-dependent and may change between releases — the list in
"Interactive helper" above is illustrative only, never authoritative.

## Agent Simulation / Emulation Mode

When the user asks you to "simulate" or "emulate" an interaction with a specific `.agent`, you MUST act as a proxy (an echo) between the running MCP server and the user. **DO NOT run the interaction loop on your own.**

**CRITICAL RULES FOR EMULATION:**
1. **Never invent user input.** You must stop and wait for the human to reply.
2. **Read State & Intents:** Read `dot-agent://state` and `dot-agent://intents`. 
3. **Internalize Goals:** Absorb any `goal` effect silently to guide your persona.
4. **Present the Persona:** Surface any `guide` text or `teach` files to the user in a natural, conversational way, acting as the agent.
5. **HALT EXECUTION:** If the state expects user input (has valid intents or a `request_interact` effect), STOP tool execution. Present the agent's message to the user and wait.
6. **Map Response:** When the user replies in the chat, map their natural language to one of the available `intents` and call `send_intent`. If it doesn't match, call `send_offtopic`.
7. Repeat the cycle, always pausing for the human.

## Authoring a new agent

1. `dot-agent init --name my-agent --domain example.com` — scaffold project
2. Edit `my-agent.description` — set name, description block, capabilities
3. Edit `my-agent.behavior` — define FSM states with `on intent` handlers
4. `dot-agent run ./my-agent` — validate (lint errors block, warnings to stderr)
5. `dot-agent pack --dir ./my-agent --out my-agent.agent` — bundle

For syntax templates and patterns, consult `dot-agent run --helper` and navigate to `generate`.
