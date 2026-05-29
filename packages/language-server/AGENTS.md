# Agent DSL Language Server — Agent Guidelines

AI collaboration guide for maintaining and evolving the LSP server for `.agent` and `.flow` files.

---

## What this package is

A standalone [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server that provides all IDE intelligence for the Agent DSL. It speaks LSP over `stdio` and is shared by the VS Code extension, Zed, Neovim, Helix, and any other LSP-capable editor. The server is intentionally editor-agnostic — no VS Code APIs, no Electron, no DOM.

---

## Module responsibilities

| File | Responsibility |
|------|---------------|
| `server.js` | LSP wiring — creates the connection, registers all `connection.onXxx()` handlers, delegates to `features/` |
| `parser.js` | Shared text-analysis helpers used by multiple features |
| `features/hover.js` | Hover documentation for all DSL keywords |
| `features/completions.js` | Context-aware completions (keywords, state names, types, memory domains) |
| `features/diagnostics.js` | Linting — dangling transitions, dead-end interact, deprecated keywords, undeclared types |
| `features/definition.js` | Go-to-definition for state and type names |
| `features/references.js` | Find all references for states and types |
| `features/rename.js` | Rename symbol with cross-file edit generation |
| `features/symbols.js` | Document and workspace symbol index |
| `features/formatting.js` | Indentation normalization for both languages |
| `features/links.js` | Document links — clickable file references in `run`, `behavior`, `schema`, `teach` |

**Invariant:** `server.js` contains only LSP wiring. All analysis logic lives in `features/` or `parser.js`.

---

## Adding a new LSP capability

1. Create `features/my-feature.js` exporting a `provideXxx(langId, text, uri, ...)` function.
2. Import it in `server.js`.
3. Wire it: `connection.onXxx((params) => { ... return provideXxx(...); })`.
4. Add the capability to the `capabilities` object in the `initialize` response in `server.js`.

Never put analysis logic directly in `server.js` handlers — always delegate to a feature module.

---

## `parser.js` helpers

| Export | Returns |
|--------|---------|
| `collectStates(text)` | `[{ name, offset }]` — all `state` declarations |
| `collectTypes(text)` | `[{ name, offset }]` — all `type` declarations |
| `offsetToPosition(text, offset)` | `{ line, character }` LSP position |
| `getCurrentStateName(text, offset)` | name of the enclosing `state` at offset |
| `escapeRegex(str)` | string escaped for use in a `RegExp` |

Add shared helpers here — never duplicate text-analysis logic across feature files.

---

## Dependency constraints

`vscode-languageserver` and `vscode-languageserver-textdocument` are the only production dependencies. Keep it this way — the server must start with a bare `node server.js --stdio` in any environment. Do not add framework dependencies, bundlers, or anything that requires a build step.

---

## License rules

- **Every new `.js` file** must carry the Apache 2.0 header using `/* */` block comment style at the top.
- No NOTICE file — npm dependencies are not distributed as source.

The Apache 2.0 header:
```
/*
 * Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
```

---

## Key references

| Resource | Link |
|----------|------|
| Language specification | [language.md](https://github.com/daniloborges/dot-agent/blob/main/dsl/language.md) |
| .flow grammar (canonical) | [tree-sitter-agent/flow/grammar.js](https://github.com/daniloborges/dot-agent-tree-sitter/blob/main/flow/grammar.js) |
| VS Code extension | [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) |
| WASM execution engine | [dot-agent-kernel](https://github.com/daniloborges/dot-agent-kernel) |
