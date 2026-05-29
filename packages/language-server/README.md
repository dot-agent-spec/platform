# Agent DSL Language Server

A standalone [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) server for the **Agent DSL** (`.agent`) and **Flow DSL** (`.flow`) file formats. Shared by the VS Code and Zed extensions.

## Features

| Capability | `.agent` | `.flow` |
|---|---|---|
| **Hover** | Keyword documentation | Keyword documentation |
| **Completion** | Manifest keywords, custom types | Keywords, state names, memory domains (`context.`, `session.`, …) |
| **Diagnostics** | Deprecated keywords, strict block lint, undeclared types | Dangling `next` transitions, dead-end `interact` |
| **Go-to-Definition** | Type name → `type` declaration | `next stateName` → `state` declaration |
| **Find References** | All uses of a type | All `next` references to a state |
| **Rename** | Type and its references | State and all `next` references |
| **Document Symbols** | Agents, types | States, `on event` observers |
| **Formatting** | 0 / 2-space indentation | 0 / 2 / 4-space indentation by block depth |

> The VS Code extension adds two capabilities on top: **Flow Graph** (Mermaid state diagram WebView) and **status bar** (current state indicator). Those are VS Code-specific and live in [`extension.js`](https://github.com/daniloborges/vscode-dot-agent/blob/main/extension.js).

## Architecture

```
┌──────────────┐   LSP/stdio   ┌─────────────────────────────┐
│  VS Code     │ ←──────────── │  server.js                  │
│  Zed         │               │   ├── features/hover.js      │
│  Neovim/etc  │               │   ├── features/completions.js│
└──────────────┘               │   ├── features/diagnostics.js│
                               │   ├── features/definition.js │
                               │   ├── features/references.js │
                               │   ├── features/rename.js     │
                               │   ├── features/symbols.js    │
                               │   └── features/formatting.js │
                               │   parser.js  (shared helpers)│
                               └─────────────────────────────┘
```

The server speaks LSP over `stdio`. Each editor starts it as a subprocess and communicates via JSON-RPC messages.

## Installation

**Standalone (Neovim, Helix, or any LSP-capable editor):**

```bash
git clone git@github.com:daniloborges/language-server.git
cd language-server
npm install
```

**As a git submodule:**

```bash
git submodule add git@github.com:daniloborges/language-server.git dsl/language-server
```

## Usage

Run directly over stdio:

```bash
node server.js --stdio
```

### Neovim (nvim-lspconfig)

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.agent_dsl then
  configs.agent_dsl = {
    default_config = {
      cmd = { 'node', '/path/to/language-server/server.js', '--stdio' },
      filetypes = { 'agent', 'flow' },
      root_dir = lspconfig.util.root_pattern('.git'),
    },
  }
end

lspconfig.agent_dsl.setup {}
```

### Helix (`~/.config/helix/languages.toml`)

```toml
[[language]]
name = "agent"
language-servers = ["agent-dsl-lsp"]

[[language]]
name = "flow"
language-servers = ["agent-dsl-lsp"]

[language-server.agent-dsl-lsp]
command = "node"
args = ["/path/to/language-server/server.js", "--stdio"]
```

## VS Code Integration

The [VS Code extension](https://github.com/daniloborges/vscode-dot-agent) installs the server as an npm dependency and starts it automatically via `vscode-languageclient`. No manual setup needed — install the `.vsix` and the server starts with the editor.

## Zed Integration

Configured in `zed-agent/extension.toml` under `[language_servers.agent-dsl-lsp]`. Note: Zed extensions with full LSP support may require Rust bindings depending on the Zed version.

## Development

### Adding a new LSP capability

1. Create `features/my-feature.js` exporting a `provideXxx(langId, text, ...)` function.
2. Import and wire it in `server.js` via `connection.onXxx(...)`.

### Shared parsing helpers (`parser.js`)

| Export | Description |
|---|---|
| `collectStates(text)` | Returns `[{ name, offset }]` for all `state` declarations |
| `collectTypes(text)` | Returns `[{ name, offset }]` for all `type` declarations |
| `offsetToPosition(text, offset)` | Converts a byte offset to `{ line, character }` |
| `getCurrentStateName(text, offset)` | Returns the name of the enclosing `state` at a given offset |
| `escapeRegex(str)` | Escapes a string for use in a RegExp |

### Testing a feature manually

```bash
node -e "
const { diagnose } = require('./features/diagnostics');
console.log(diagnose('flow', \`
state greeting
  interact
  next missing
\`));
"
```

### Testing the full LSP protocol

```bash
node -e "
const { spawn } = require('child_process');
const p = spawn('node', ['server.js', '--stdio']);
const msg = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} } });
p.stdin.write('Content-Length: ' + Buffer.byteLength(msg) + '\r\n\r\n' + msg);
p.stdout.on('data', d => { console.log(d.toString()); p.kill(); });
"
```

---

## License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).
