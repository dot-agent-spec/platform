# Agent DSL Language Server — Agent Guidelines

AI collaboration guide for maintaining and evolving the LSP server for `.agent DSL` files.

---

## What this package is

A standalone [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server that
provides all IDE intelligence for the .agent DSL. It speaks LSP over `stdio` and is intentionally
editor-agnostic — no VS Code APIs, no Electron, no DOM — so any LSP-capable editor can drive it. The only
integration built and tested in this repository is [`apps/vscode-extension/`](../../apps/vscode-extension/),
which **bundles this server into its own build output** rather than installing it from npm. `apps/zed-agent/`
was removed; there is no Neovim or Helix packaging here.

All structural analysis is performed on **tree-sitter ASTs** (not regex). `parser.js` owns the WASM parser lifecycle, document cache, and the helper functions that feature modules use to traverse parse trees.

The package is **ESM** (`"type": "module"` in `package.json`). All files use `import`/`export` — no `require()` or `module.exports`.

---

## Module responsibilities

| File | Responsibility |
|------|---------------|
| `server.js` | LSP wiring — creates the connection, awaits `initParsers()` and `bpInit()` in `onInitialize`, registers all `connection.onXxx()` handlers, delegates to `features/` |
| `parser.js` | Tree-sitter engine — WASM initialization, per-document AST cache, and shared traversal helpers |
| `features/hover.js` | Hover documentation for all DSL keywords (static lookup, no tree traversal) |
| `features/completions.js` | Context-aware completions using `getContextNode` and `nodesOfType` for name lookups |
| `features/diagnostics.js` | Thin adapter — delegates to `lintDescription`/`lintBehavior` from `@dot-agent/compiler`, maps `LintMessage[]` → LSP `Diagnostic[]` |
| `features/definition.js` | Go-to-definition via `state_decl` / `type_decl` node lookup |
| `features/references.js` | Find all references via `transition_stmt`, `intent_handler`, `type_ref` traversal |
| `features/rename.js` | Rename symbol — same traversal as references, produces `TextEdit[]` |
| `features/symbols.js` | Document symbol index from `state_decl`, `trigger_decl`, `agent_decl`, `type_decl` nodes |
| `features/formatting.js` | Indentation normalization (text-based, no tree traversal needed) |
| `features/links.js` | Document links from `behavior_block`, `persona_block`, `category_prop`, `concept_prop` (description) and `merge_decl`, `run_stmt` (behavior) |
| `merge-graph.js` | Resolves the agent root and collects the `.behavior` files a `merge` pulls in — `findAgentRoot`, `findMergeRoot`, `collectBehaviorFiles`. Used by both `server.js` and `features/diagnostics.js` |

**The intended shape:** `server.js` is LSP wiring, analysis lives in `features/` or `parser.js`. Treat that
as the direction of travel, not as a description of the file — **it is currently violated in three places**,
and writing it here as an invariant is what let the drift go unnoticed:

- `agent/currentState` does `state_decl` traversal and position-matching inline in the handler.
- `agent/behaviorGraph` does inline merge-detection, calls `consolidate()`, and carries a try/catch
  fallback — all in the handler.
- `merge-graph.js` is a third home for logic that is neither `features/` nor `parser.js`.

The last two are the same knot: merge resolution is scattered across three call sites, which is
[issue #4](https://github.com/dot-agent-spec/platform/issues/4). Do not add a fourth.

---

## Adding a new LSP capability

1. Create `features/my-feature.js` exporting a `provideXxx(langId, tree, text, ...)` function.
2. Import it in `server.js`.
3. Wire it: `connection.onXxx((params) => { ... return provideXxx(langId, getTree(doc), doc.getText(), ...); })`.
4. Add the capability to the `capabilities` object in the `initialize` response in `server.js`.

Delegate to a feature module rather than writing analysis in the handler. The three existing exceptions are
listed above; they are debt, not precedent.

---

## `parser.js` — tree-sitter API

| Export | Signature | Description |
|--------|-----------|-------------|
| `initParsers()` | `async () => void` | Initializes WASM parsers for both grammars. **Must** be awaited in `onInitialize` before any handler runs. |
| `parse(uri, langId, text, version)` | `→ Tree \| null` | Returns a cached `Tree`, doing a **full reparse** when the version changes. Returns `null` if parsers are not yet initialized. Incremental reparsing is deliberately not used — it corrupts node byte ranges here, and `parser.js` says so at the call site. Do not "optimize" it back. |
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
| `intent_handler` | `on intent "text" (transition to state \| block)` | `intent`, `state` (inline only), `block` |
| `offtopic_handler` | `on offtopic block` | `block` |
| `run_stmt` | `run type "target" …` | `run_type`, `target` |
| `interact_stmt` | `interact [requiring "text"]` | — |

### `.agent` grammar

| Node type | Represents | Useful fields |
|-----------|-----------|---------------|
| `agent_decl` | `agent Name …` | `name` (agent_name) |
| `type_decl` | `type Name …` | `name` (identifier) |
| `behavior_block` | `behavior file.behavior` | `file` (bare_string) |
| `persona_block` · `category_prop` · `concept_prop` | the description blocks `links.js` actually resolves | — |
| `type_ref` | `TypeName` or `ns.TypeName` | first named child = identifier |
| `input_block` / `output_block` / `requires_block` / `capabilities_block` | strict blocks | contain `typed_item`, `type_reference`, `cap_item` |

> **Known limitation:** `on offtopic transition to X` in inline form (no block indent) parses as an ERROR
> node, so those transitions are invisible to references/rename/diagnostics. The fix is in
> `offtopic_handler` in
> [`packages/tree-sitter/tree-sitter-behavior/grammar.js`](../tree-sitter/tree-sitter-behavior/grammar.js).
> There is no `fallback_stmt` and no `on fallback` in the grammar — an earlier version of this note named
> both, alongside a `behavior/grammar.js` path that predates the monorepo flatten.

---

## Dependency constraints

Production dependencies:
- `vscode-languageserver` and `vscode-languageserver-textdocument` — LSP protocol implementation
- `web-tree-sitter` — WASM-based tree-sitter runtime
- `@dot-agent/tree-sitter` — Agent and Behavior grammar WASM binaries
- `@dot-agent/compiler` — Linting (`lintDescription`, `lintBehavior`). Do not reimplement lint rules locally; always delegate to the compiler.
- `@dot-agent/parser-dsl` — FSM WASM; used directly in `server.js` for `agent/behaviorGraph` (returns an
  SCXML string via `get_graph(text)`). There is no `@dot-agent/behavior-parser` package and there never
  was one under that name in this repository.

Do not add framework dependencies, bundlers, or anything that requires a build step on the language-server side. The server must start with a bare `node server.js --stdio`.

The grammar WASM binaries are built by `npm run build` in [`packages/tree-sitter/`](../tree-sitter/) —
Docker, not a local Emscripten install (see [CONTRIBUTING.md](../../CONTRIBUTING.md)). When published to
npm, `dist/` is included and no build is needed. The compiler must be built (`npm run build` in
[`packages/compiler/`](../compiler/)) before the language-server can use it inside the monorepo.

---

## Async lifecycle rule

`web-tree-sitter` and `@dot-agent/parser-dsl` initialize asynchronously. The `onInitialize` handler is the only safe place to call both:

```js
connection.onInitialize(async () => {
    await initParsers();   // tree-sitter WASMs (agent + behavior grammars)
    await bpInit();        // parser-dsl WASM (FSM parser + get_graph)
    return { capabilities: { ... } };
});
```

No feature handler will fire before `initialize` completes, so this guarantees all WASMs are ready before any request arrives. Never call these outside `onInitialize`.

---

## `agent/behaviorGraph` custom request

Returns a **SCXML string** (W3C State Chart XML) generated by the parser-dsl WASM from the document text. The VS Code extension consumes this to render a state diagram.

```js
connection.onRequest('agent/behaviorGraph', ({ uri }) => {
    const doc = documents.get(uri)
    if (!doc || doc.languageId !== 'behavior') return null
    return get_graph(doc.getText())  // → SCXML string
})
```

---

## Key references

These were standalone repositories before the monorepo flatten
([DA00-05](../../project/adr/DA00-05-monorepo-flatten.md)); the canonical code is in this tree now.

| Resource | Link |
|----------|------|
| Language reference | [`dsl/reference/`](../../dsl/reference/) |
| `.description` grammar (canonical) | [`packages/tree-sitter/tree-sitter-description/grammar.js`](../tree-sitter/tree-sitter-description/grammar.js) |
| `.behavior` grammar (canonical) | [`packages/tree-sitter/tree-sitter-behavior/grammar.js`](../tree-sitter/tree-sitter-behavior/grammar.js) |
| VS Code extension | [`apps/vscode-extension/`](../../apps/vscode-extension/) |
| WASM execution engine | [`packages/kernel-dsl/`](../kernel-dsl/) |
