# .agent DSL & Tree-sitter

Canonical grammars and specification for the .agent DSL ecosystem — `.description` manifests, `.type` declarations, and `.behavior` files.

Part of the [dot-agent](https://github.com/dot-agent-spec) ecosystem.

---

## 1. File types

| Grammar | Scope | Used in |
|---------|-------|----------------|
| `tree-sitter-description/grammar.js` | `source.description` | `.description`, `type` |
| `tree-sitter-behavior/grammar.js` | `source.behavior` | `.behavior` |

---

## 2. Package structure

```
tree-sitter/
├── index.js                      ← entry point — exports WASM paths
├── tree-sitter-description/      ← .description / .type grammar
│   ├── grammar.js
│   ├── tree-sitter.json
│   ├── src/
│   │   ├── scanner.c             ← newline scanner
│   │   └── tree_sitter/          ← runtime headers (MIT, see NOTICE)
│   ├── queries/highlights.scm    ← highlight queries
│   └── test/corpus/types.txt     ← grammar test cases
├── tree-sitter-behavior/         ← .behavior grammar
│   ├── grammar.js
│   ├── tree-sitter.json
│   ├── src/
│   │   └── tree_sitter/
│   ├── queries/highlights.scm
│   └── test/corpus/basic.txt
├── dist/
│   ├── tree-sitter-description.wasm ← compiled WASM parser (.description / .type)
│   └── tree-sitter-behavior.wasm    ← compiled WASM parser (.behavior)
└── scripts/
    └── clean.js                  ← cleans dist/ before WASM build
```

---

## 3. Examples

### `.description` file

```description
agent Text Assistant
  domain text.local
  license Apache-2.0

description
  Reviews and summarizes texts.
  Can adjust the tone and clarity of a text according to the objective,
  or generate a summary at different levels of detail.

capabilities
  ReviseAction "Reviews a text focusing on the tone and objective indicated by the user."
  SummarizeAction "Summarizes a text at the desired level of detail (executive, full, or bullet points)."
```

### `.behavior` file

```behavior
state responsive
  goal "Initiate text summarization"
  guide "Greet the user and request the text they wish to have summarized. Be concise and maintain a helpful tone."
  interact
  on intent "proceed" transition to process
  on intent "end" transition to goodbye
  on offtopic transition to responsive

state summary
  goal "Generate and present the summary"
  guide "Analyze the provided text to generate a clear, accurate summary. Present the result and invite the user to provide a new text or conclude the session."
  teach "maintopics.md"
  interact
  on intent "new_text" transition to responsive
  on intent "end" transition to goodbye
  on offtopic transition to responsive

state goodbye
  goal "Conclude the interaction"
  guide "Deliver a polite farewell message, acknowledging the end of the session and letting the user know they can return at any time."
  interact
  on intent "new_text" transition to responsive
  on offtopic transition to goodbye
```

---

## 4. Development setup

```bash
npm install
npx tree-sitter generate      # compile the .description grammar
npm run generate-behavior      # compile the .behavior grammar
```

Re-run `generate` every time you edit `grammar.js`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow.

---

## 5. WASM / JavaScript

The package ships pre-compiled WebAssembly parsers for use in JavaScript environments (browser, Node.js, Deno):

```js
const { descriptionWasmPath, behaviorWasmPath } = require('@dot-agent/tree-sitter');
// descriptionWasmPath → absolute path to dist/tree-sitter-description.wasm
// behaviorWasmPath    → absolute path to dist/tree-sitter-behavior.wasm
```

---

## 6. Daily commands

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

## 7. License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).

This product includes header files from the tree-sitter project (MIT). See [`NOTICE`](NOTICE) for full attribution.