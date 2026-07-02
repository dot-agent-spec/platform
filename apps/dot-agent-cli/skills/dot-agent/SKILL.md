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

This starts a stdio MCP server. Connect to it and send intents to navigate topics:
- `about` — platform overview
- `dsl` — .description and .behavior format
- `mcp` — tools, resources, interaction loop
- `generate` — authoring a new agent step by step
- `example` — complete minimal agent

## MCP interaction loop

When an agent is running with `--mcp`:

1. Read `dot-agent://state` and `dot-agent://intents` to understand current state
2. Call `send_intent` with one of the listed intents
3. Read the `effects` array in the response: `goal`, `guide`, `teach` (fetch via `dot-agent://knowledge/{name}`), `request_interact`
4. If `request_interact` is present, collect user input and call `send_intent` or `send_offtopic`
5. Repeat from step 1

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
