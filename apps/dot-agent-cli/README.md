<h1 align="center">dot-agent CLI</h1>

<p align="center">
  <strong>The command line for <code>.agent</code> — the universal file format for portable AI.</strong><br>
  Author, validate, package and run autonomous agents declared as text, not code.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dot-agent/cli"><img alt="npm" src="https://img.shields.io/npm/v/@dot-agent/cli.svg"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#use-as-a-library">Library API</a> ·
  <a href="https://github.com/dot-agent-spec/platform/tree/main/dsl/reference">Language reference</a> ·
  <a href="https://dot-agent.ai/">dot-agent.ai</a>
</p>

---

An agent is a folder: a `.description` manifest, a `.behavior` state machine, an optional persona, and the
knowledge it teaches. This CLI turns that folder into a single portable `.agent` file, and runs one back.

```console
$ npm install -g @dot-agent/cli
$ mkdir my-agent && cd my-agent
$ dot-agent init --name my-agent --domain example.com
✓ Scaffolded agent project in /tmp/my-agent
  Files: LICENSE, README.md, SOUL.md, agent.behavior, agent.description,
         behaviors/.gitkeep, guides/.gitkeep, knowledge/.gitkeep

$ dot-agent pack --dir . --out my-agent.agent
✓ Packed → my-agent.agent
  ID: example.com/my-agent
  Warnings: 1
⚠ agent.description:2:10 W003 domain still has default value "example.com"
```

The warning is the point: `pack` lints before it writes, so a broken agent fails at authoring time rather
than at run time.

## Install

```bash
npm install -g @dot-agent/cli
```

Or run it without installing:

```bash
npx @dot-agent/cli <command>
```

## Commands

| Command | What it does |
|---|---|
| `dot-agent init [--name <name>] [--domain <domain>] [--dir <dir>]` | Scaffold an agent project |
| `dot-agent pack [--dir <dir>] [--out <file>] [--version <tag>] [--commit <hash>]` | Lint and package into a `.agent` archive |
| `dot-agent unpack <file.agent> [--out <dir>] [--force]` | Extract an `.agent` back to editable sources |
| `dot-agent run <file.agent \| dir>` | Load an agent and start its state machine |
| `dot-agent run <src> --mcp` | Serve a loaded agent over MCP |
| `dot-agent run --helper` | Serve the interactive authoring helper over MCP |
| `dot-agent configure --claude` | Install the native Claude Code plugin and remove any legacy MCP entries this CLI wrote before |
| `dot-agent configure [--gemini] [--agy] [--murici] [--skill] [--mcp]` | Write the skill file and/or MCP config directly, for hosts with no dot-agent plugin (yet) |
| `dot-agent server-mcp` | Serve the authoring tools over MCP |
| `dot-agent agents list` · `agents path <name>` | List installed agents, or resolve one to a path |

The MCP commands take `--mcp-transport stdio|http` and `--mcp-port <n>`.

**`init` writes into the current directory** unless you pass `--dir`, and it overwrites existing files
without asking — including `LICENSE` and `README.md`. Run it in a new, empty folder.

Without `--version`, `pack` prompts for one in a terminal and packs versionless otherwise; it never
invents a default.

## Use as a library

Every command is also an exported function, for embedding in a Node or Electron host:

```typescript
import { pack, run } from '@dot-agent/cli'

const packed = await pack({ dir: './my-agent', out: './my-agent.agent' })
console.log(packed.id, packed.path, packed.warnings.length)

const { bundle, session } = await run({ source: './my-agent.agent' })
```

Also exported: `init`, `unpack`, `configure`, `listAgents`, `getAgentPath`, `startDevMcpServer`, and the
`AgentBundle` / `PackResult` / `LintMessage` types.

## Writing an agent

The `.description` and `.behavior` formats, the memory model and the full lint-code list are the language
specification, not CLI surface:

- [Language reference](https://github.com/dot-agent-spec/platform/tree/main/dsl/reference) — `.description`, `.behavior`, types, memory
- [Lint codes](https://github.com/dot-agent-spec/platform/blob/main/packages/compiler/docs/reference/lint-codes.md) — every `E`/`W` code `pack` can raise
- [`.agent` package format](https://github.com/dot-agent-spec/platform/tree/main/docs/reference) — archive layout and `aboutme.json`

Or let the CLI teach you interactively: `dot-agent run --helper` starts an agent whose whole purpose is
explaining how to write one.

## Requirements

Node.js 24 or newer.

## License

Copyright (c) 2026 Danilo Borges. Licensed under the Apache License 2.0 — see [`LICENSE`](LICENSE).
