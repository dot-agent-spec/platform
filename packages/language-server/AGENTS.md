# Agent DSL Language Server — Agent Guidelines

AI collaboration guide for maintaining and evolving the LSP server for `.agent DSL` files.

---

## What this package is

A standalone [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server that provides all IDE intelligence for the .agent DSL. It speaks LSP over `stdio` and is shared by the VS Code extension, Zed, Neovim, Helix, and any other LSP-capable editor. The server is intentionally editor-agnostic — no VS Code APIs, no Electron, no DOM.

All structural analysis is performed on **tree-sitter ASTs** (not regex). `parser.js` owns the WASM parser lifecycle, document cache, and the helper functions that feature modules use to traverse parse trees.

---

## Module responsibilities

| File | Responsibility |
|------|---------------|
| `server.js` | LSP wiring — creates the connection, awaits `initParsers()` in `onInitialize`, registers all `connection.onXxx()` handlers, delegates to `features/` |
| `parser.js` | Tree-sitter engine — WASM initialization, per-document AST cache, and shared traversal helpers |
| `features/hover.js` | Hover documentation for all DSL keywords (static lookup, no tree traversal) |
| `features/completions.js` | Context-aware completions using `getContextNode` and `nodesOfType` for name lookups |
| `features/diagnostics.js` | Linting — dangling transitions, dead-end interact (AST), deprecated keywords (line scan), undeclared types (AST) |
| `features/definition.js` | Go-to-definition via `state_decl` / `type_decl` node lookup |
| `features/references.js` | Find all references via `transition_stmt`, `intent_trigger`, `type_ref` traversal |
| `features/rename.js` | Rename symbol — same traversal as references, produces `TextEdit[]` |
| `features/symbols.js` | Document symbol index from `state_decl`, `trigger_decl`, `agent_decl`, `type_decl` nodes |
| `features/formatting.js` | Indentation normalization (text-based, no tree traversal needed) |
| `features/links.js` | Document links from `behavior_block`, `schema_prop`, `merge_decl`, `run_stmt` nodes |

**Invariant:** `server.js` contains only LSP wiring. All analysis logic lives in `features/` or `parser.js`.

---

## Adding a new LSP capability

1. Create `features/my-feature.js` exporting a `provideXxx(langId, tree, text, ...)` function.
2. Import it in `server.js`.
3. Wire it: `connection.onXxx((params) => { ... return provideXxx(langId, getTree(doc), doc.getText(), ...); })`.
4. Add the capability to the `capabilities` object in the `initialize` response in `server.js`.

Never put analysis logic directly in `server.js` handlers — always delegate to a feature module.

---

## `parser.js` — tree-sitter API

| Export | Signature | Description |
|--------|-----------|-------------|
| `initParsers()` | `async () => void` | Initializes WASM parsers for both grammars. **Must** be awaited in `onInitialize` before any handler runs. |
| `parse(uri, langId, text, version)` | `→ Tree \| null` | Returns a cached `Tree`, reparsing incrementally when the version changes. Returns `null` if parsers are not yet initialized. |
| `evict(uri)` | `(uri) → void` | Removes a document's cached tree (call in `onDidClose`). |
| `nodesOfType(tree, type)` | `→ SyntaxNode[]` | All descendants of the given node type string. |
| `nodeAtOffset(tree, offset)` | `→ SyntaxNode \| null` | Deepest node at a byte offset. |
| `nodeToRange(node)` | `→ Range` | Converts a `SyntaxNode` to an LSP `Range` using `startPosition`/`endPosition`. |
| `positionToOffset(text, line, character)` | `→ number` | Converts an LSP `{line, character}` to a byte offset. |
| `wordAtPosition(text, line, character)` | `→ {word, start, end}` | Extracts the identifier (including dots) around a cursor position. |
| `getContextNode(tree, offset)` | `→ SyntaxNode` | Walks up past `ERROR`/`MISSING` nodes to find a clean context ancestor. Use in completions and hover to handle partially-typed input. |

Add shared helpers here — never duplicate tree traversal logic across feature files.

---

## Key node types

### `.behavior` grammar

| Node type | Represents | Useful fields |
|-----------|-----------|---------------|
| `state_decl` | `state name block` | `name` (path) |
| `trigger_decl` | `on event "name" block` | `event` (quoted_string) |
| `merge_decl` | `merge "file"` | `path` (quoted_string) |
| `transition_stmt` | `transition to stateName` | `state` (path) |
| `intent_trigger` | `on intent "text" (transition to state \| block)` | `intent`, `state` (inline only), `block` |
| `offtopic_stmt` | `on offtopic block` | `block` |
| `run_stmt` | `run type "target" …` | `run_type`, `target` |
| `interact_stmt` | `interact [requiring "text"]` | — |

### `.agent` grammar

| Node type | Represents | Useful fields |
|-----------|-----------|---------------|
| `agent_decl` | `agent Name …` | `name` (agent_name) |
| `type_decl` | `type Name …` | `name` (identifier) |
| `behavior_block` | `behavior file.behavior` | `file` (bare_string) |
| `schema_prop` | `schema file.json` | `file` (filename) |
| `type_ref` | `TypeName` or `ns.TypeName` | first named child = identifier |
| `input_block` / `output_block` / `requires_block` / `capabilities_block` | strict blocks | contain `typed_item`, `type_reference`, `cap_item` |

> **Known limitation:** `on offtopic transition to X` and `on fallback transition to X` in inline form (no block indent) parse as ERROR nodes in the current grammar. Those transitions are not captured by references/rename/diagnostics. Fix requires updating `offtopic_stmt` and `fallback_stmt` in `behavior/grammar.js` to support the inline form.

---

## Dependency constraints

Production dependencies:
- `vscode-languageserver` and `vscode-languageserver-textdocument` — LSP protocol implementation
- `web-tree-sitter` — WASM-based tree-sitter runtime
- `@dot-agent/tree-sitter` — Agent and Flow grammar WASM binaries

Do not add framework dependencies, bundlers, or anything that requires a build step on the language-server side. The server must start with a bare `node server.js --stdio` once the WASM binaries are in `@dot-agent/tree-sitter/dist/`.

The grammar WASM binaries are built by running `npm run build` in the `tree-sitter-agent` package (requires Emscripten). When published to npm, `dist/` is included in the package and no build is needed.

---

## Async lifecycle rule

`web-tree-sitter` initializes asynchronously. The `onInitialize` handler is the only safe place to call `await initParsers()`:

```js
connection.onInitialize(async () => {
    await initParsers();   // blocks until both WASMs are loaded
    return { capabilities: { ... } };
});
```

No feature handler will fire before `initialize` completes, so this guarantees parsers are ready before any `onHover`, `onCompletion`, etc. request arrives. Never call `initParsers()` outside `onInitialize`.

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
| Agent grammar (canonical) | [tree-sitter-agent/grammar.js](https://github.com/daniloborges/tree-sitter-agent/blob/main/grammar.js) |
| Flow grammar (canonical) | [tree-sitter-agent/flow/grammar.js](https://github.com/daniloborges/tree-sitter-agent/blob/main/flow/grammar.js) |
| VS Code extension | [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) |
| WASM execution engine | [dot-agent-kernel](https://github.com/daniloborges/dot-agent-kernel) |
