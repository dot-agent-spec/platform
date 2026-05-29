# dot-agent — Agent Guidelines

AI collaboration guide for maintaining and evolving this specification repository.

---

## What this repo is

`dot-agent-spec` (branch `dsl` of `https://github.com/daniloborges/dot-agent.git`) is the **specification and examples** repository for the dot-agent ecosystem. It contains:

- The language specification (`dsl/language.md`) — the authoritative definition of `.agent` and `.flow` syntax and semantics
- The evolution roadmap (`dsl/roadmap.md`)
- Annotated examples (`examples/`) — `.agent` + `.flow` file pairs
- Git submodule references to all implementation packages

There is **no executable code** at the root level. All implementations live in standalone repos referenced as git submodules under `dsl/`.

---

## Repository layout

```
dot-agent-spec/
├── LICENSE
├── README.md
├── AGENTS.md
├── dsl/
│   ├── language.md          ← main specification (single source of truth)
│   ├── roadmap.md           ← evolution roadmap
│   ├── tree-sitter-agent/   ← submodule: github.com/daniloborges/dot-agent-tree-sitter
│   ├── language-server/     ← submodule: github.com/daniloborges/language-server
│   ├── vscode-extension/    ← submodule: github.com/daniloborges/vscode-dot-agent
│   └── zed-agent/           ← Zed extension (local, no separate GitHub repo)
├── examples/                ← annotated .agent + .flow pairs
└── org-spec/                ← organizational spec (separate submodule)
```

---

## Evolving the specification

- **All language changes belong in `dsl/language.md`** — this is the single source of truth for syntax and semantics.
- After changing `language.md`, check whether any of the implementation submodules need to be updated to match.
- Grammar changes must be reflected in `dsl/tree-sitter-agent/` (the canonical grammar source).
- Example files in `examples/` must remain valid according to the current spec.

---

## Submodule table

| Directory | GitHub repo | Purpose |
|-----------|-------------|---------|
| `dsl/tree-sitter-agent/` | [dot-agent-tree-sitter](https://github.com/daniloborges/dot-agent-tree-sitter) | Tree-sitter grammars for `.agent` and `.flow` |
| `dsl/language-server/` | [language-server](https://github.com/daniloborges/language-server) | Standalone LSP server |
| `dsl/vscode-extension/` | [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) | VS Code extension |
| `dsl/zed-agent/` | *(no separate repo)* | Zed extension |

Each submodule has its own `LICENSE`, `README.md`, and `AGENTS.md`. Refer to those files when making changes to the respective packages.

---

## Language rule

**All documentation in this repository must be written in English.** This includes `README.md`, `AGENTS.md`, `dsl/language.md`, `dsl/roadmap.md`, comments in example files, and any future spec documents.

---

## Example files

- `.agent` and `.flow` files in `examples/` are specification documents, not compiled code.
- No license headers are needed on `.agent` or `.flow` files — they are covered by the root `LICENSE`.
- Each example should have a brief `README.md` explaining what pattern it demonstrates.

---

## License rules

- New `.md` documents at the repo root or under `dsl/` need **no license header** — JSON and Markdown do not support comments, and the root `LICENSE` covers the entire repository.
- `.agent` and `.flow` example files need **no license header**.
- The `LICENSE` file at the root covers everything in this repository.
- No `NOTICE` file is needed — no third-party source code is committed here; submodules have their own licenses.

---

## Key references

| Resource | Link |
|----------|------|
| Language specification | [`dsl/language.md`](dsl/language.md) |
| Tree-sitter grammars | [dot-agent-tree-sitter](https://github.com/daniloborges/dot-agent-tree-sitter) |
| Language server | [language-server](https://github.com/daniloborges/language-server) |
| VS Code extension | [vscode-dot-agent](https://github.com/daniloborges/vscode-dot-agent) |
