# @dot-agent/compiler

AST parser, linter, graph extractor, and `.agent` packager for the dot-agent DSL.

This is **Level 1** of the dot-agent tooling hierarchy (see [`architecture_map.md`](../../architecture_map.md)): it sits between the raw WASM grammars and the higher-level SDK and LSP. Both the CLI and the language server import from this package to guarantee identical diagnostics everywhere.

---

## Install

```bash
npm install @dot-agent/compiler
```

---

## Quick start

```ts
import { lintDescription, lintBehavior, pack } from '@dot-agent/compiler'

// Lint a .description source
const descMsgs = await lintDescription(source, 'agent.description')

// Lint a .behavior source
const behMsgs = await lintBehavior(source, 'agent.behavior')

// Package a directory into a .agent ZIP
const result = await pack({ dir: './my-agent', version: 'v1.0.0' })
console.log(result.id)     // e.g. "health.example.com/Doctor:v1.0.0~a1b2c3d4"
console.log(result.path)   // path to the written .agent file
```

Diagnostic messages follow the `LintMessage` shape:

```ts
{
  file: string      // source file label
  line: number      // 1-based line
  col: number       // 1-based column
  severity: 'error' | 'warning'
  code: string      // e.g. 'E004', 'W002'
  message: string   // human-readable description
}
```

See [`docs/reference/lint-codes.md`](docs/reference/lint-codes.md) for the full code table.

---

## Public API

| Export | Description |
|--------|-------------|
| `initParsers()` | Initialise the WASM tree-sitter parsers (called automatically on first `parse`) |
| `parse(langId, text, prev?)` | Parse `.description` or `.behavior` source into a tree-sitter `Tree` |
| `parseSync(langId, text, prev?)` | Synchronous parse — returns `null` if parsers are not yet initialised |
| `nodesOfType(tree, type)` | Collect all descendant nodes of a given type |
| `nodeAtOffset(tree, offset)` | Locate the deepest node at a byte offset |
| `nodeToRange(node)` | Convert a node to an LSP-style `{start, end}` range |
| `positionToOffset(text, line, char)` | Convert `(line, character)` to a byte offset |
| `getContextNode(tree, offset)` | Return the best non-error context node at an offset |
| `lintDescription(text, file?)` | Lint a `.description` source; returns `LintMessage[]` |
| `lintBehavior(text, file?, docPath?)` | Lint a `.behavior` source; returns `LintMessage[]` |
| `extractBehaviorGraph(tree)` | Extract states, transitions and entry points from a behavior tree |
| `parseAboutme(json)` | Deserialise an `aboutme.json` object into `AboutMe` |
| `buildAboutme(opts)` | Construct an `AboutMe` from build-time options |
| `aboutmeToJson(aboutme)` | Serialise `AboutMe` back to a plain JSON object |
| `parseId(id)` | Parse `namespace/name:version~digest` into `IdParts` |
| `buildId(parts)` | Construct an agent ID string from `IdParts` |
| `collectFiles(dir)` | Collect agent source files from a directory |
| `pack(options)` | Full lint → hash → zip pipeline; produces a `.agent` file |
| `readZip(path)` | Open a `.agent` ZIP from disk |
| `writeZip(zip, path)` | Write a JSZip instance to disk |
| `extractFiles(zip, prefixes?)` | Extract file contents from a ZIP as a `Map<string, string>` |
| `validateZipBomb(zip)` | Guard against decompression bombs |

Full type definitions are in `dist/index.d.ts` after building.

---

## Development

```bash
npm install
npm test          # run 91 unit tests with vitest
npm run build     # compile to dist/ with tsup
npm run typecheck # tsc --noEmit
```

Tests live in `tests/`. Each module has a dedicated test file. WASM parsers require `pool: 'forks'` (configured in `vitest.config.ts`) to initialise correctly across test files.
