---
name: dot-agent
description: "Use when the user asks you to run, load, follow, build, or interact with a .agent file or dot-agent project — loading an agent means embodying it and running its flow with the user. Also use when generating a new .agent from scratch — the helper has authoring templates. Trigger: /dot-agent"
---

# /dot-agent

dot-agent is a platform for building FSM-based agents that communicate via MCP. An agent is a directory (or `.agent` bundle) containing a `.description` file (its persona), a `.behavior` file (its FSM), and optional knowledge and guide files.

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

## Running an agent — how to behave (read this first)

When the user asks you to **load / run / follow** an agent, start it with `--mcp` and drive it via
the MCP tools below. But *driving the FSM is only the mechanics* — the part that matters is **how you
treat what the FSM hands back**. Getting this wrong (treating the FSM's output as instructions for
*you* to carry out) is the single most common failure. Read the mental model before the loop.

### Mental model: the FSM is a dynamic, state-selected SKILL.md — and you embody the agent

Each state's output (`goal`, `guide`, `teach`, valid intents) is **the active section of your own
operating instructions for right now** — exactly like a section of a SKILL.md, swapped in by the
engine as the conversation moves. It is:

- **NOT the user talking to you.** The user is a separate human you are speaking *with*.
- **NOT a list of commands for you to execute.** `guide`/`teach` shape *how you behave*, not what you run.

You **are** the agent. Adopt the persona from its `.description`, and let each state's directive govern
how you speak and act toward the human.

### What each effect means

- **`goal`** — what you must accomplish *with the human* in this state. Absorb it silently; it steers
  you, it is not something you announce or hand to the user.
- **`guide`** — how to behave / what to say in this state. Follow it as your directive.
- **`teach`** — reference knowledge to ground your responses. Its `text` is a path already prefixed
  with `guides/`/`knowledge/` — fetch it via `dot-agent://<text>` verbatim (do **not** re-prepend the
  prefix) and use it as source-of-truth context. Bulky material (command lists, detailed steps) lives
  here, loaded only for the state that needs it.
- **`request_interact`** — pause and ask the human, then map their reply to an intent (see the loop).

### The rules of comportment

1. **Adopt the persona** from the `.description` and stay in it.
2. **Classify the user's message against the current valid intents.**
   - If it matches an intent that requires **another state** (or is off-topic / out of scope), call
     `send_intent` (or `send_offtopic`) **silently — produce no user-facing text — and wait** for the
     new state before responding. Tolerate small typos; infer the closest intended term before
     deciding something is off-topic.
   - If it can be handled **within the current state**, respond in persona toward the `goal`, using
     `guide` + `teach`.
3. **Advance only when the state's goal is achieved** — then call `send_intent` for the matching
   intent to move the flow forward.
4. **Never execute command-text.** In v0.1 the FSM controls states, not side effects: if a `guide` or
   `teach` contains shell commands or steps, you **present them to the human to run** — you never run
   them yourself.
5. **Pause for the human at interactive states.** If the state has valid intents or a
   `request_interact` effect, present your message and **stop**. Never invent the human's reply.
6. **Advance silently through pure transitions.** A state with no interaction (e.g. `init → responsive`)
   just moves on — no message to the human.
7. **Never reveal the plumbing.** Do not narrate `send_intent`/state transitions to the user — that is
   internal wiring.

### The interaction loop (mechanics)

With the agent running under `--mcp`:

1. Read `dot-agent://state` and `dot-agent://intents` to see the current state and its valid intents.
2. Apply the rules above to the human's message; call `send_intent` (or `send_offtopic`) as decided.
3. Read the `effects` array in the response (`goal`, `guide`, `teach`, `request_interact`) and behave
   per the rules.
4. **Re-read `dot-agent://intents` after every transition** — valid intents are state-dependent and do
   not carry over. Never assume a prior intent still applies.
5. Repeat.

### Autonomous test-drive (opt-in, not the default)

Only when the user **explicitly** asks to test / dry-run an agent **without a human in the loop** may
you play both sides — synthesising plausible user inputs yourself to walk the FSM and surface where it
breaks. This is a distinct, opt-in mode; the default above (embody + converse with the human) is what
"load this agent and follow its flow" means.

## Interactive helper

For DSL reference, authoring templates, and MCP interaction guidance, run the embedded helper agent:

```
dot-agent run --helper
```

This starts a stdio MCP server. After connecting, always read `dot-agent://intents` first — valid
intents are state-dependent and change between releases, so treat any topic list as illustrative, not
authoritative. As of this writing the top-level topics are roughly: `dsl` (the `.description`/`.behavior`
format), `gen` (authoring a new agent), `cli` (CLI/MCP usage), `pack` (packaging). Re-read
`dot-agent://intents` after every `send_intent` — do not assume a topic name still applies.

## Authoring a new agent

1. `dot-agent init --name my-agent --domain example.com` — scaffold project
2. Edit `my-agent.description` — set name, description block, capabilities
3. Edit `my-agent.behavior` — define FSM states with `on intent` handlers
4. `dot-agent run ./my-agent` — validate (lint errors block, warnings to stderr)
5. `dot-agent pack --dir ./my-agent --out my-agent.agent` — bundle

For syntax templates and patterns, consult `dot-agent run --helper` and navigate to `generate`.