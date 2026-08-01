# .agent DSL — VS Code Extension — Agent Guidelines

AI collaboration guide for maintaining and evolving the VS Code extension.

---

## What this extension is

A **thin LSP client**. Almost all IDE intelligence (hover, completions, diagnostics, go-to-definition,
references, rename, symbols, formatting, document links) comes from
[`packages/language-server/`](../../packages/language-server/) — a separate Node.js process started
automatically on activation. This extension owns only what cannot be delivered over LSP.

**The server is bundled, not installed.** `scripts/build.mjs` bundles
`packages/language-server/server.js` straight from the monorepo path into `dist/server.mjs`. The
`@dot-agent/language-server` entry in `package.json` is not what ships — reading `package.json` alone
leads you to assume npm resolution, and that assumption is wrong.

---

## File responsibilities

| File | Responsibility |
|------|---------------|
| `extension.js` | `activate()` / `deactivate()`, LSP client lifecycle, status bar, Behavior Graph WebView, `behavior.openGraph` command |
| `agent.tmLanguage.json` | TextMate grammar for `.description` and `.type` syntax highlighting |
| `behavior.tmLanguage.json` | TextMate grammar for `.behavior` syntax highlighting |
| `language-configuration.json` | Comment characters, bracket pairs, folding for `.description` files |
| `behavior-language-configuration.json` | Same for `.behavior` plus indentation rules |
| `snippets.json` | Code snippets for `.description` files |
| `behavior-snippets.json` | Code snippets for `.behavior` files |
| `agent-icon.svg`, `behavior-icon.svg`, `description-icon.svg` (+ `-light` variants) | File-type icons in the Explorer, registered under `contributes.languages` |

**Rule:** Never add LSP feature logic to `extension.js`. A new hover, completion, diagnostic or definition
belongs in [`packages/language-server/features/`](../../packages/language-server/features/) instead.

---

## VS Code-only features (belong in `extension.js`)

Things that require the VS Code API and cannot be expressed as LSP responses:
- **Status bar** — shows the current `state` name as the cursor moves
- **Behavior Graph WebView** — Mermaid `stateDiagram-v2` rendered in a panel via `vscode.WebviewPanel`
- **Commands** — `behavior.openGraph` and any future palette commands
- **Custom notifications** — LSP `window/showMessage` wrapping, progress indicators

---

## `agent/behaviorGraph` — response format

The LSP request `agent/behaviorGraph` returns an **SCXML string** (W3C State Chart XML), produced by the
`@dot-agent/parser-dsl` WASM from the document text.

The extension converts it to a Mermaid `stateDiagram-v2` with `scxmlToMermaid()` in `extension.js`, which
extracts:

- `initial="X"` on the root `<scxml>` element → `[*] --> X` (entry point)
- `<state id="X"><transition target="Y"/></state>` → `X --> Y`
- `<transition event="E" target="Y"/>` inside a state → `X --> Y : E`
- states with no connections → an isolated line (a node with no edges in the diagram)

---

## Build and release

```bash
npm run compile       # node scripts/build.mjs → dist/
npm run package       # vsce package --no-dependencies → vscode-dot-agent-X.Y.Z.vsix
npm run install-ext   # installs the latest .vsix into VS Code
```

**The monorepo-root `npm run build` does not include this package.** From the root, use
`npm run compile -w apps/vscode-extension`. Debugging is the `Run Extension` config in
`.vscode/launch.json` (F5), which opens an Extension Development Host.

**Never commit `.vsix` files** — they are in `.gitignore` and are build artifacts.

### What `scripts/build.mjs` arranges, and why not to flatten it

Three packages are deliberately kept **external** from the server bundle and copied verbatim into
`dist/node_modules/`: `@dot-agent/parser-dsl`, `@dot-agent/tree-sitter` and `web-tree-sitter`. They locate
their WASM relative to their own file, so bundling them breaks that path math. The server is emitted as
ESM with a `.mjs` extension and a `createRequire` banner, because `vscode-languageserver` is CJS and does a
`require()` esbuild cannot statically resolve — in plain ESM output that becomes a throwing stub.

**Verifying a change to any of this needs more than an `initialize` handshake.** `initialize` returns all
nine providers before anything has parsed, so it only proves the bundle loads. Drive
`textDocument/didOpen` with `languageId: "behavior"` — the short id the server filters on, not the
selector this extension registers — and assert real diagnostics come back. That is what exercises the
externalized WASM chain and the banner.

---

## Key references

These were standalone repositories before the monorepo flatten
([DA00-05](../../project/adr/DA00-05-monorepo-flatten.md)); the canonical code is in this tree now.

| Resource | Link |
|----------|------|
| Language reference | [`dsl/reference/`](../../dsl/reference/) |
| Language server (LSP features) | [`packages/language-server/`](../../packages/language-server/) |
| Tree-sitter grammar | [`packages/tree-sitter/`](../../packages/tree-sitter/) |
| WASM execution engine | [`packages/kernel-dsl/`](../../packages/kernel-dsl/) |
