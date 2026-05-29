# Agent & Flow DSL — VS Code Extension — Agent Guidelines

AI collaboration guide for maintaining and evolving the VS Code extension.

---

## What this extension is

A **thin LSP client**. Almost all IDE intelligence (hover, completions, diagnostics, go-to-definition, references, rename, symbols, formatting, document links) is provided by the [Agent DSL Language Server](https://github.com/daniloborges/language-server) — a separate Node.js process started automatically on activation. This extension is responsible only for VS Code-specific features that cannot be delivered over LSP.

---

## File responsibilities

| File | Responsibility |
|------|---------------|
| `extension.js` | `activate()` / `deactivate()`, LSP client lifecycle, status bar, Flow Graph WebView, `flow.openGraph` command |
| `agent.tmLanguage.json` | TextMate grammar for `.agent` syntax highlighting |
| `flow.tmLanguage.json` | TextMate grammar for `.flow` syntax highlighting |
| `language-configuration.json` | Comment characters, bracket pairs, folding for `.agent` |
| `flow-language-configuration.json` | Same for `.flow` plus indentation rules |
| `snippets.json` | Code snippets for `.agent` files |
| `flow-snippets.json` | Code snippets for `.flow` files |
| `agent-icon.svg`, `flow-icon.svg` | File-type icons in the Explorer |

**Rule:** Never add LSP feature logic to `extension.js`. If you need a new hover, completion, diagnostic, or definition behavior, add it to [`language-server/features/`](https://github.com/daniloborges/language-server) instead.

---

## VS Code-only features (belong in `extension.js`)

Things that require the VS Code API and cannot be expressed as LSP responses:
- **Status bar** — shows the current `state` name as the cursor moves
- **Flow Graph WebView** — Mermaid `stateDiagram-v2` rendered in a panel via `vscode.WebviewPanel`
- **Commands** — `flow.openGraph` and any future palette commands
- **Custom notifications** — LSP `window/showMessage` wrapping, progress indicators

---

## Build and release

```bash
npm run package       # runs vsce package → produces agent-dsl-syntax-X.Y.Z.vsix
npm run install-ext   # installs the latest .vsix into VS Code
```

**Never commit `.vsix` files** — they are in `.gitignore` and are build artifacts. Regenerate with `npm run package` when needed.

---

## License rules

- **`extension.js`** must carry the Apache 2.0 header using `/* */` block comment style.
- **`.json` files** (grammars, snippets, config): no license header — JSON does not support comments.
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
| Language server (LSP features) | [language-server](https://github.com/daniloborges/language-server) |
| Tree-sitter grammar | [dot-agent-tree-sitter](https://github.com/daniloborges/dot-agent-tree-sitter) |
| WASM execution engine | [dot-agent-kernel](https://github.com/daniloborges/dot-agent-kernel) |
