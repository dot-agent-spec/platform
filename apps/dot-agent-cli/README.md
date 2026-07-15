# dot-agent CLI

The official command-line interface for the **dot-agent** specification. Build, validate, package, and execute AI agents with a simple, declarative DSL.

## Installation

```bash
npm install -g dot-agent
```

Or use directly with `npx`:

```bash
npx dot-agent <command>
```

## Quick Start

### 1. Initialize a new agent project

```bash
dot-agent init --name my-agent --domain example.com --dir ./my-agent
```

This creates a scaffold with:
- `agent.description` — Agent manifest (domain, name, capabilities)
- `agent.behavior` — FSM state machine definition
- `SOUL.md` — Agent persona and voice
- `README.md`, `LICENSE` — Project metadata
- `behaviors/`, `guides/`, `knowledge/` — Content directories (only files referenced by a `guide`/`teach` statement are packed)

### 2. Edit your agent

Customize the generated files:
- Describe your agent in `agent.description`
- Define behavior states and transitions in `agent.behavior`
- Add knowledge and guides as needed

### 3. Package your agent

```bash
dot-agent pack --dir ./my-agent --version v1.0.0
```

This validates the DSL and creates `my-agent.agent` (a ZIP archive) with:
- `.agent/aboutme.json` — Agent metadata
- `.agent/files.json` — File manifest
- Source files and content

### 4. Run your agent

```bash
dot-agent run ./my-agent.agent
```

Loads the agent and returns an `AgentContext` for execution in Electron, Node, or another runtime.

### 5. Extract an agent (optional)

```bash
dot-agent unpack my-agent.agent --out ./unpacked
```

Restores the original source files from a `.agent` package.

---

## Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `init` | Scaffold a new agent project | `dot-agent init --name myagent --domain example.com` |
| `pack` | Validate and package agent into `.agent` ZIP | `dot-agent pack --dir . --version v1.0.0` |
| `unpack` | Extract `.agent` file to sources | `dot-agent unpack myagent.agent --out ./src` |
| `run` | Load agent and return AgentContext | `dot-agent run myagent.agent` |

---

## Agent Definition

### `agent.description`

Declares the agent's identity, capabilities, and requirements:

```
agent MyAgent
  domain example.com
  license Apache-2.0

description
  A helpful AI assistant for customer support.

behavior agent.behavior

capabilities
  RespondToQuery "Answer customer questions"
  EscalateToHuman "Transfer to human agent when needed"
```

### `agent.behavior`

Defines the finite state machine (FSM) that governs agent behavior:

```
state init
  transition to ready

state ready
  goal "Help the user with their query."
  interact
  on intent "ask-question" transition to answering
  on intent "escalate" transition to escalated

state answering
  goal "Provide a helpful answer."
  interact
  on intent "follow-up" transition to answering
  on intent "resolved" transition to ready

state escalated
  goal "Transfer conversation to human support."
  transition to ready
```

---

## API Usage

Use `dot-agent` as a module in Node.js or Electron:

```typescript
import { init, pack, unpack, run } from 'dot-agent'

// Initialize a project
const initResult = await init({
  name: 'my-agent',
  domain: 'example.com',
  dir: './agents/my-agent'
})

// Package an agent
const packResult = await pack({
  dir: './agents/my-agent',
  version: 'v1.0.0'
})
console.log(`Agent packaged: ${packResult.id}`)

// Load an agent
const context = await run({
  source: './my-agent.agent'
})

// Listen to loading progress
context.on('progress', (event) => {
  console.log(`${event.step}: ${event.pct}%`)
})

context.on('ready', (ctx) => {
  console.log(`Agent ready: ${ctx.id}`)
})
```

---

## Package Format (.agent)

A `.agent` file is a ZIP archive containing:

```
my-agent.agent (ZIP)
├── .agent/
│   ├── aboutme.json        ← Agent metadata (required)
│   ├── files.json          ← File manifest
│   └── types.json          ← Type definitions (optional)
├── agent.description       ← Agent manifest
├── agent.behavior          ← FSM definition
├── behaviors/              ← Behavior includes
├── guides/                 ← Files named by a `guide "x.md"` statement
├── knowledge/              ← Files named by a `teach "x.md"` statement
└── SOUL.md                 ← Agent persona
```

Only files the behavior actually references are bundled. `pack` resolves each `guide "x.md"` /
`teach "x.md"` against `guides/x.md` / `knowledge/x.md` first, then against a file sitting loose next
to `agent.behavior`; a reference that resolves to neither fails with `E018`. A file left in `guides/`
or `knowledge/` that no statement names is reported as `W015` and **left out of the bundle** — nothing
could reach it at runtime anyway, since the host only ever learns a filename from a `teach` effect.

### `aboutme.json`

```json
{
  "schemaVersion": "dot-agent/1.0",
  "id": "example.com/my-agent:v1.0.0~a1b2c3d4",
  "name": "My Agent",
  "description": "A helpful AI assistant",
  "version": "v1.0.0",
  "domain": "example.com",
  "license": "Apache-2.0",
  "persona": "SOUL.md",
  "compiler": "dot-agent/1.0.0",
  "skills": [],
  "requires": [],
  "integrity": {
    "sha256": "...",
    "files": ".agent/files.json"
  }
}
```

---

## Validation & Linting

The `pack` command validates:

1. **Syntax** — `.description` and `.behavior` DSL structure (tree-sitter)
2. **Semantics** — FSM state references, memory access, capability definitions (kernel-dsl)
3. **Files** — All referenced files exist and are readable

Error codes:
- `E001` — Missing required field in `.description`
- `E003` — `.description` file not found
- `E004` — Syntax error in `.behavior` DSL
- `E006` — Semantic parse error in FSM
- `E007` — `.behavior` file not found
- `W003` — Domain still set to default `example.com`

---

## Requirements

- **Node.js** 18.0.0 or higher
- **npm** or compatible package manager

## Dependencies

- `@dot-agent/compiler` — Agent compiler, static analysis, linter, validation, and package builder
- `@dot-agent/sdk` — Browser and Node.js-compatible SDK runtime dispatch layer (loads `.agent` files and manages execution)

---

## Status

**V1 Release Candidate** — All 4 core commands (`init`, `pack`, `unpack`, `run`) implemented and tested.

---

## License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).
