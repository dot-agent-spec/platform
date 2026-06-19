# dot-agent — Agent Guidelines

AI collaboration guide for maintaining and evolving this repository.

---

## What this repo is

`dot-agent-spec` is the specification and implementation repository for the dot-agent ecosystem. It contains:

- Language specification (`dsl/`) — syntax, semantics, and design of `.description` and `.behavior`
- Language specification (`dsl/`) — syntax, semantics, and design of `.description` and `.behavior`
- Implementation packages (`packages/`) — compiler, parser, kernel, SDK, language server
- Developer-facing apps (`apps/`) — CLI, VS Code extension
- Design proposals (`rfcs/`) — RFCs for proposed language and protocol changes
- Implementation tasks (`tasks/`) — technical debt and planned work items
- Annotated examples (`examples/`) — canonical `.description` + `.behavior` pairs

There is **no executable code** at the root level. Packages live under `packages/` (as workspace members) and apps under `apps/` (as git submodules).

---

## Repository layout

```
dot-agent-spec/
├── LICENSE
├── README.md
├── AGENTS.md                      ← this file
├── dsl/                           ← language spec (Diátaxis structure)
│   ├── README.md
│   ├── reference/                 ← syntax: .behavior, .description, types, memory
│   ├── explanation/               ← design: principles, scope, .behavior vs WASM
│   ├── how-to/                    ← recipes for agent authors
│   └── tutorials/                 ← step-by-step guides (WIP)
├── docs/                          ← implementation docs (Diátaxis structure)
│   ├── README.md
│   ├── reference/                 ← BehaviorFile, DescriptionFile, kernel API, agent-id
│   ├── explanation/               ← architecture map, ecosystem overview, design decisions
│   └── how-to/                    ← packaging, SDK usage
├── rfcs/                          ← design proposals
│   ├── AGENTS.md                  ← RFC lifecycle rules
│   ├── implemented/               ← RFCs that reached Implemented (frozen)
│   └── rejected/                  ← RFCs that were Rejected (frozen)
├── tasks/                         ← implementation tasks and technical debt
│   └── AGENTS.md                  ← task lifecycle rules
├── packages/
│   ├── tree-sitter/               ← WASM grammar (submodule) — canonical grammar source
│   ├── parser-dsl/                ← Rust/WASM — parses .behavior + .description
│   ├── kernel-dsl/                ← Rust/WASM — FSM execution engine
│   ├── compiler/                  ← TypeScript — linter, AST analysis, ZIP packaging
│   ├── sdk/                       ← TypeScript — browser-compatible dispatch layer
│   ├── language-server/           ← Node.js — LSP server
│   ├── transpiler-core/           ← ⚠️ aspirational — types/interface only (RFC-0018)
│   ├── transpiler-langgraph/      ← ⚠️ aspirational — codegen target (RFC-0018)
│   └── transpiler-appintent/      ← ⚠️ aspirational — codegen target (RFC-0018)
├── apps/
│   ├── dot-agent-cli/             ← submodule — developer CLI (pending v2 update)
│   └── vscode-extension/          ← submodule — VS Code LSP client (pending v2 update)
└── examples/                      ← canonical .description + .behavior pairs (CI-tested)
```

---

## Source of truth

| What | Where |
|---|---|
| Language syntax and semantics | `dsl/reference/` |
| Language design decisions | `dsl/explanation/` |
| Package implementation | `packages/*/` (code is canonical) |
| Package internals docs | `packages/*/docs/` |
| Architecture overview | `docs/explanation/architecture/map.md` |
| Proposed changes | `rfcs/` (Draft status — not canonical) |
| Pending implementation work | `tasks/` |

**When code and docs diverge, the code wins.** Docs describe intent; code is what runs.

---

## After structural changes

When adding, removing, or renaming top-level folders or packages, **always update these two files**:

1. **`README.md`** — Documentation table and Packages table
2. **`AGENTS.md`** (this file) — Repository layout tree and Source of truth table

These are the entry points for both human contributors and AI collaborators. Stale layout information here is a primary source of hallucination.

Also update [`docs/explanation/architecture/map.md`](docs/explanation/architecture/map.md) — View 1 (directory structure) and the Implementation Status table.

---

## Evolving the language

- Language changes must be reflected in **both** `dsl/reference/` and the grammar in `packages/tree-sitter/`
- Grammar changes take effect only after regenerating `parser.c` in `packages/tree-sitter/tree-sitter-behavior/src/`
- Example files in `examples/` must remain valid against the current grammar
- Proposed new syntax goes in an RFC first (`rfcs/`) before touching the grammar

---

## Submodule table

| Directory | Purpose | Status |
|-----------|---------|--------|
| `packages/tree-sitter/` | WASM grammar — canonical grammar source | ✅ Active |
| `apps/dot-agent-cli/` | Developer CLI | ⚠️ Pending v2 update |
| `apps/vscode-extension/` | VS Code LSP client | ⚠️ Pending v2 update |

`apps/zed-agent/` has been removed. Historical reference only in git history.

Each active submodule has its own `AGENTS.md`. Read it before making changes to that package.

---

## Language rule

All documentation in this repository must be written in English.

---

## Example files

- `.description` and `.behavior` files in `examples/` are specification documents, not compiled code
- Each example has a companion `src/` folder with the source files and a compiled output in `<Name> - content/`
- No license headers are needed on `.description` or `.behavior` files — covered by the root `LICENSE`

---

## License rules

- New `.md` documents need **no license header** — the root `LICENSE` covers the repository
- `.description` and `.behavior` example files need **no license header**
- Rust and TypeScript source files in `packages/` use Apache 2.0 headers — follow the existing pattern
