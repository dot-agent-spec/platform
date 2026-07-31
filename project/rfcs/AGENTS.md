# AGENTS.md — rfcs/

The RFC **lifecycle**, numbering and freeze rules are in
[`.agents/rules/governance.md`](../../.agents/rules/governance.md), which loads automatically for any
file under `project/`. This file holds only what is specific to authoring an RFC *in this repository*:
the package-impact table.

Two reminders that the rule states and are worth repeating at the point of use: an RFC is a **proposal,
not a specification** — code and schemas in one are illustrative, never a source of truth for
implementation — and an RFC only leaves `Draft` after explicit review.

```
rfcs/
├── AGENTS.md              ← this file
├── <NNNN>-<name>.md       ← active RFCs (Draft / Review / Accepted)
├── implemented/           ← frozen after shipping
└── rejected/              ← frozen record of what was considered
```

---

## Package impact table

Every RFC header includes a package impact table immediately after the metadata fields and before the
first `---` separator. It answers: "which packages need code changes if this RFC is implemented?"

### Format

```markdown
| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| SYMBOL | SYMBOL | SYMBOL | SYMBOL | SYMBOL |
```

When the RFC also touches packages outside the core five (e.g. `transpiler-core`, `dot-agent-cli`), add a
note block on the next line:

```markdown
> **Also impacts:** transpiler-core, transpiler-langgraph
```

### Symbol legend

| Symbol | Meaning |
|---|---|
| `—` | Not related — this package requires no changes |
| `⚠️` | Impacted — this package needs code changes to implement the RFC |
| `🔄` | Consumes — this package reads the output of another without itself changing |
| `?` | Ambiguous — impact depends on an unresolved design decision (see RFC body) |

### When to update

Update the table whenever a pending decision (`?`) is resolved. Moving an RFC from `Draft` to `Accepted`
requires every `?` cell resolved to `—`, `⚠️` or `🔄` — that is the gate, not a formality.

### Quick reference: package responsibilities

| Package | Layer | Responsibility |
|---|---|---|
| `@dot-agent/tree-sitter` | L0 | WASM grammar — syntax rules only |
| `@dot-agent/parser-dsl` | L1 | Rust/WASM parser → `BehaviorFile` + `DescriptionFile` |
| `@dot-agent/compiler` | L2 | Linting, semantic validation, `.agent` ZIP packaging |
| `@dot-agent/kernel-dsl` | L2 | Micro-kernel FSM execution, emits `Effect[]` |
| `@dot-agent/sdk` | L3 | Browser-compatible dispatch layer, loads `.agent` bundles |
