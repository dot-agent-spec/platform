# @dot-agent/compiler — Agent Guidelines

AI collaboration guide for maintaining and evolving this package.

---

## What this package is

`@dot-agent/compiler` is the **Level 1 tooling engine** of the dot-agent ecosystem. It is the single source of truth for:

- Tree-sitter AST parsing of `.description` and `.behavior` files
- Syntax and semantic linting (diagnostic codes `E*` / `W*`)
- Behavior graph extraction (states, transitions, entry points)
- Manifest construction and serialisation (`aboutme.json`)
- Agent ID formatting (`namespace/name:version~digest`)
- ZIP packaging pipeline (`.agent` bundles)

It does **not** contain CLI argument parsing, LSP JSON-RPC protocol handling, or runtime execution — those belong in `dot-agent-cli`, `language-server`, and `@dot-agent/sdk` respectively.

---

## Package layout

```
packages/compiler/
├── src/
│   ├── index.ts          # Public re-exports — the package surface
│   ├── types.ts          # Shared type definitions (LintMessage, AboutMe, etc.)
│   ├── parser.ts         # WASM init, parse(), nodesOfType(), AST helpers
│   ├── linter.ts         # lintDescription() + lintBehavior() + diagnostic rules
│   ├── graph.ts          # extractBehaviorGraph()
│   ├── manifest.ts       # parseAboutme(), buildAboutme(), aboutmeToJson()
│   ├── id.ts             # parseId(), buildId()
│   ├── zip.ts            # readZip(), writeZip(), extractFiles(), validateZipBomb()
│   ├── pack.ts           # collectFiles(), pack()
│   └── types.kernel-dsl.d.ts  # Module augmentation: adds init() to kernel-dsl types
├── tests/                # One test file per src module
├── docs/
│   ├── concepts/pipeline.md   # How the compiler pipeline works internally
│   ├── guides/linting.md      # How to call lintDescription/lintBehavior in code
│   └── reference/lint-codes.md # Full table of diagnostic codes
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## Evolving the compiler

### Adding a new lint rule

1. Implement the rule in `src/linter.ts` — choose an unused `E*` code for hard errors, `W*` for warnings.
2. Add at least one positive (triggers the rule) and one negative (valid input, no trigger) test in `tests/linter.test.ts`.
3. Add a row to `docs/reference/lint-codes.md`.

### Changing tree-sitter node types

Tree-sitter node type names (`state_decl`, `goal_stmt`, `oriented_state_body`, etc.) come from the grammars in `@dot-agent/tree-sitter`. Never hardcode a node type string without verifying it against:
- `dsl/tree-sitter/grammar.js` (description grammar)
- `dsl/tree-sitter/behavior/grammar.js` (behavior grammar)

The node type `Parser.SyntaxNode` / `Parser.Tree` namespace does **not** exist in web-tree-sitter v0.25+; use the standalone `Node` and `Tree` imports.

### Grammar rules to remember

- Every `state` with `interact` **must** declare `goal` — `oriented_state_body` requires it.
- Every `oriented_state_body` **must** end with `on offtopic`.
- `goal` can only appear inside an `oriented_state_body`; transit states use only `transition to`, `set`, `run`, etc.
- Description block order is strict: `description → persona → behavior → capabilities → requires → input → output`.
- The description grammar uses `agent_meta` nodes (with `key`/`value` fields) for `domain`, `license`, `terms`, `privacy` — there is no `domain_declaration` node.

### Running tests

```bash
npm test
```

Tests require `pool: 'forks', singleFork: true` in vitest config because WASM initialisation is process-global and cannot be shared across worker threads.

---

## Language rule

All documentation and code comments in this package must be written in **English**.
