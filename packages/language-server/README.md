# Agent DSL Language Server

A standalone [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) server for the **.agent DSL** (`.description`, `.type`, `.behavior`) files. Shared by the VS Code and Zed extensions.

## Features

| Capability | `.agent` | `.behavior` |
|---|---|---|
| **Hover** | Keyword documentation | Keyword documentation |
| **Completion** | Manifest keywords, custom types | Keywords, state names, memory domains (`context.`, `session.`, …) |
| **Diagnostics** | Deprecated keywords, strict block lint, undeclared types | Dangling `transition` targets, dead-end `interact` |
| **Go-to-Definition** | Type name → `type` declaration | `transition to stateName` → `state` declaration |
| **Find References** | All uses of a type | All `transition` references to a state |
| **Rename** | Type and its references | State and all `transition` references |
| **Document Symbols** | Agents, types | States, `on event` observers |
| **Formatting** | 0 / 2-space indentation | 0 / 2 / 4-space indentation by block depth |

> The VS Code extension adds two capabilities on top: **Behavior Graph** (Mermaid state diagram WebView) and **status bar** (current state indicator). Those are VS Code-specific and live in [`extension.js`](https://github.com/daniloborges/vscode-dot-agent/blob/main/extension.js).

## Architecture

```
┌──────────────┐   LSP/stdio   ┌─────────────────────────────────┐
│  VS Code     │ ←──────────── │  server.js                      │
│  Zed         │               │   ├── features/hover.js          │
│  Neovim/etc  │               │   ├── features/completions.js    │
└──────────────┘               │   ├── features/diagnostics.js    │
                               │   ├── features/definition.js     │
                               │   ├── features/references.js     │
                               │   ├── features/rename.js         │
                               │   ├── features/symbols.js        │
                               │   └── features/formatting.js     │
                               │   parser.js  (tree-sitter engine)│
                               └─────────────────────────────────┘
```

The server speaks LSP over `stdio`. Each editor starts it as a subprocess and communicates via JSON-RPC messages.

All structural analysis uses the **tree-sitter** parse trees from [`@dot-agent/tree-sitter-agent`](https://github.com/daniloborges/tree-sitter-agent). `parser.js` initializes the WASM-based parsers during `initialize` and maintains a per-document AST cache with incremental reparse.

## Prerequisites

The grammar package must have its WASM binaries built before first use:

```bash
cd dsl/tree-sitter-agent
npm run build          # requires Emscripten; generates dist/*.wasm
```

When consuming the package from npm (published), `dist/` is already included — no build step needed.

## Installation

**Standalone (Neovim, Helix, or any LSP-capable editor):**

```bash
git clone git@github.com:daniloborges/language-server.git
cd language-server
# Build the grammar WASMs first (see Prerequisites above)
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
      filetypes = { 'agent', 'behavior' },
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
name = "behavior"
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

1. Create `features/my-feature.js` exporting a `provideXxx(langId, tree, text, ...)` function.
2. Import and wire it in `server.js` via `connection.onXxx(...)`, passing `getTree(doc)` and `doc.getText()`.

### Shared parsing helpers (`parser.js`)

| Export | Description |
|---|---|
| `initParsers()` | Async — initializes both WASM parsers. Called once inside `onInitialize`. |
| `parse(uri, langId, text, version)` | Returns a cached `Tree` for the document, reparsing incrementally on version change. |
| `evict(uri)` | Removes a document's cached tree on close. |
| `nodesOfType(tree, type)` | `SyntaxNode[]` — all descendants of the given node type. |
| `nodeAtOffset(tree, offset)` | The deepest node at a byte offset. |
| `nodeToRange(node)` | Converts a `SyntaxNode` to an LSP `Range` via `startPosition`/`endPosition`. |
| `positionToOffset(text, line, character)` | Converts an LSP `{line, character}` to a byte offset. |
| `wordAtPosition(text, line, character)` | Extracts the identifier (including dots) around a cursor position. |
| `getContextNode(tree, offset)` | Walks up past `ERROR`/`MISSING` nodes to find a clean context ancestor. |

### Testing features manually

```bash
# Parse a real file and inspect the AST
node -e "
const { initParsers, parse, nodesOfType } = require('./parser');
(async () => {
  await initParsers();
  const text = require('fs').readFileSync('../examples/doctor/doctor.behavior', 'utf8');
  const tree = parse('f', 'behavior', text, 1);
  console.log(nodesOfType(tree, 'state_decl').map(n => n.childForFieldName('name').text));
})();
"

# Run a diagnostic check
node -e "
const { initParsers, parse } = require('./parser');
const { diagnose } = require('./features/diagnostics');
(async () => {
  await initParsers();
  const text = 'state greeting\n  interact\n  transition to missing\n';
  const tree = parse('f', 'behavior', text, 1);
  console.log(diagnose('behavior', tree, text));
})();
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
