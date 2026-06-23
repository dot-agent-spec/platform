# dot-agent — Agent Guidelines

AI collaboration guide for maintaining and evolving this repository.

---

## What this repo is

`dot-agent-spec` is the specification and implementation repository for the dot-agent ecosystem. It contains:

- Language specification (`dsl/`) — syntax, semantics, and design of `.description` and `.behavior`
- Implementation packages (`packages/`) — compiler, parser, kernel, SDK, language server
- Developer-facing apps (`apps/`) — CLI, VS Code extension
- Design proposals (`rfcs/`) — RFCs for proposed language and protocol changes
- Implementation tasks (`tasks/`) — technical debt and planned work items
- Annotated examples (`examples/`) — canonical `.description` + `.behavior` pairs

There is **no executable code** at the root level. Every package under `packages/` and every app under `apps/` is a **git submodule** — each is its own repository with its own `AGENTS.md`. `org-spec/` (the org-wide `.github` repo) is a submodule too. Run `git submodule update --init` before working on a package, and commit a submodule's changes in that submodule before bumping its pointer in the superproject.

---

## Repository layout

```
dot-agent-spec/
├── LICENSE
├── README.md
├── AGENTS.md                      ← this file
├── ROADMAP.md                     ← language roadmap, version policy, freeze/editions model
├── GOVERNANCE.md                  ← decision process (RFC / ADR / task lifecycles)
├── templates/                     ← copy-ready templates: rfc, adr, task
├── adr/                           ← architecture decision records
│   └── AGENTS.md                  ← ADR lifecycle rules
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
│   ├── vscode-extension/          ← submodule — VS Code LSP client (pending v2 update)
│   └── agy/                       ← submodule — Antigravity CLI runtime plugin
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
| Decision process | `GOVERNANCE.md` |
| Roadmap & version policy | `ROADMAP.md` |
| Architecture decisions (settled) | `adr/` |
| Document templates | `templates/` |

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

## Keeping docs in sync — definition of done

Doc drift across the layered packages is the main failure mode. **Treat the doc update as part of the change, not a follow-up.** After any change, walk the affected row in [`docs/explanation/architecture/implementation-status.md`](docs/explanation/architecture/implementation-status.md), update every layer it touches, then run the `/sync-implementation-status` skill to regenerate the tracker and surface what was missed.

By change type:

| If you change… | Also update… |
|---|---|
| Grammar / new syntax (`packages/tree-sitter`) | `dsl/reference/` · `packages/parser-dsl` AST · `packages/compiler` lint · `packages/kernel-dsl` (if it has runtime behavior) · `examples/` · the `implementation-status.md` row · that package's `AGENTS.md` |
| A kernel effect (`packages/kernel-dsl`) | `packages/sdk` handler · `dsl/reference/behavior.md` · `implementation-status.md` |
| An `aboutme` / pack field (`packages/compiler`) | `dsl/reference/description.md` · `implementation-status.md` |
| Top-level folders or packages | `README.md` · this file (layout tree + source-of-truth) · `docs/explanation/architecture/map.md` |

New syntax is gated by an RFC first; a hard-to-reverse decision is recorded as an ADR (`adr/`). See [`GOVERNANCE.md`](GOVERNANCE.md).

---

## Working with subagents and skills

When delegating to a subagent, choose its model by the **tier** of the task, not by habit:

- judgment-heavy (architecture, design, ambiguous trade-offs) → strongest tier
- structured execution (drafting from a template/brief, multi-file edits) → mid tier
- mechanical (boilerplate, reformatting, known-value fills) → cheap tier; raise `effort` only when needed

Default to `inherit` when unsure. **Do not change the `model` of an existing subagent** — it was chosen
deliberately; this applies to *new* subagents. Skills carry `model` / `effort` in frontmatter for the
same routing. Rationale and the obsolescence/reversal plan: [ADR-0002](adr/0002-model-tiering-for-agent-routing.md).

---

## Submodule table

| Directory | Purpose | Status |
|-----------|---------|--------|
| `packages/tree-sitter/` | WASM grammar — canonical grammar source | ✅ Active |
| `packages/parser-dsl/` | Rust/WASM — parses `.behavior` + `.description` | ✅ Active |
| `packages/kernel-dsl/` | Rust/WASM — FSM execution engine | ✅ Active |
| `packages/compiler/` | TypeScript — linter, AST analysis, ZIP packaging | ✅ Active |
| `packages/sdk/` | TypeScript — browser dispatch layer | ✅ Active |
| `packages/language-server/` | Node.js — LSP server | ✅ Active |
| `apps/dot-agent-cli/` | Developer CLI | ⚠️ Pending v2 update |
| `apps/vscode-extension/` | VS Code LSP client | ⚠️ Pending v2 update |
| `apps/agy/` | Antigravity CLI runtime plugin | 🚧 In Progress |
| `org-spec/` | Org-wide `.github` (community-health defaults) | ✅ Active |

`apps/zed-agent/` has been removed. Historical reference only in git history. The `transpiler-*` packages in the layout are aspirational (RFC-0018) and are not yet submodules.

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
