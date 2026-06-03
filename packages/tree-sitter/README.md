# dot-agent DSL & Tree-sitter

Canonical grammars and specification for the .agent DSL ecosystem — `.description` manifests, `.type` declarations, and `.behavior` files.

Part of the [dot-agent](https://github.com/dot-agent-spec/dot-agent) ecosystem.

---

**Language Specification:** `1.0.0-draft`  
**Parser Version:** `0.2.1` (see [package.json](package.json))

---

## 1. Documentation Index

Following the Diátaxis framework, our documentation is split by user intent:

### 💡 Concepts (Understanding-oriented)
- [The .agent Ecosystem](docs/concepts/ecosystem.md) — Architecture and Division of Responsibility.
- [Design Principles](docs/concepts/design-principles.md) — Zero Noise, Determinism, and Semantic Indentation.
- [Roadmap & Open Questions](docs/concepts/roadmap.md) — Future of the DSL.

### 📖 Reference (Information-oriented)
- [The Manifest (.description)](docs/reference/manifest.md) — Metadata, Inputs, Outputs, and Capabilities.
- [The Behavior (.behavior)](docs/reference/behavior.md) — States, Transitions, and Flow Orchestration.
- [Type System](docs/reference/types.md) — Custom Types, Namespaces, and Semantic Anchors.

### 🛠️ Guides & Tutorials (Task-oriented)
- [Three-Layer Packaging](docs/guides/packaging.md) — How agents are versioned and distributed.
- [Examples](examples/) — Canonical `.description` and `.behavior` snippets.

---

## 2. File types

| Grammar | Scope | File extensions |
|---------|-------|----------------|
| `grammar.js` | `source.description` | `.description`, `.type` |
| `behavior/grammar.js` | `source.behavior` | `.behavior` |

---

## 3. Editor integration

**Zed** — native Tree-sitter support via the Zed extension (zed-agent).

**Neovim** — use `nvim-treesitter`. Add the parser path to your `parser-install-dir` or use the local build directly.

**VS Code** — install the [vscode-dot-agent](https://github.com/dot-agent-spec/vscode-dot-agent) extension. Tree-sitter here powers diagnostics via the [language server](https://github.com/dot-agent-spec/language-server); the extension also bundles a `.tmLanguage.json` for syntax highlighting.

---

## 4. Package structure

```
tree-sitter/
├── index.js              ← entry point — exports WASM paths
├── grammar.js            ← .description / .type grammar
├── tree-sitter.json      ← grammar scope declarations
├── dist/
│   ├── tree-sitter-agent.wasm    ← compiled WASM parser (.description / .type)
│   └── tree-sitter-behavior.wasm ← compiled WASM parser (.behavior)
├── docs/                 ← Language Specification & Documentation
├── src/
│   ├── scanner.c         ← manual INDENT/DEDENT scanner
│   └── tree_sitter/      ← runtime headers (MIT, see NOTICE)
├── queries/
│   └── highlights.scm    ← highlight queries for .description / .type
├── scripts/
│   └── clean.js          ← cleans dist/ before WASM build
├── test/corpus/
│   └── types.txt         ← grammar test cases
└── behavior/                 ← .behavior grammar (separate Tree-sitter grammar)
    ├── grammar.js
    ├── src/scanner.c
    ├── queries/highlights.scm
    └── test/corpus/basic.txt
```

---

## 5. Development setup

```bash
npm install
npx tree-sitter generate      # compile the .description grammar
npm run generate-behavior      # compile the .behavior grammar
```

Re-run `generate` every time you edit `grammar.js`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow.

---

## 6. WASM / JavaScript

The package ships pre-compiled WebAssembly parsers for use in JavaScript environments (browser, Node.js, Deno):

```js
const { agentWasmPath, behaviorWasmPath } = require('@dot-agent/tree-sitter');
// agentWasmPath    → absolute path to dist/tree-sitter-agent.wasm
// behaviorWasmPath → absolute path to dist/tree-sitter-behavior.wasm
```

---

## 7. Daily commands

```bash
# Parse a file and display the syntax tree
npx tree-sitter parse path/to/file.description

# Syntax highlight in the terminal
npx tree-sitter highlight path/to/file.description

# Run corpus tests
npx tree-sitter test          # .description grammar
npm run test-behavior          # .behavior grammar
```

---

## 8. License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).

This product includes header files from the tree-sitter project (MIT). See [`NOTICE`](NOTICE) for full attribution.
