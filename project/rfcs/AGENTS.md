# AGENTS.md — rfcs/

## Status of this folder

Documents in `rfcs/` are **design proposals**, not final specifications.

- Code, schemas, and interfaces described here are **illustrative** — they exist to communicate design intent, not to be implemented directly
- No RFC here should be treated as a source of truth for implementation
- The source of truth for the **language** is `dsl/` (reference, explanation, how-to)
- The source of truth for **implementation** is `packages/*/` (code) and `packages/*/docs/` (package docs)

## Before implementing anything based on an RFC

1. Check that the RFC has status `Accepted` in its header table — RFCs with status `Draft` are still under discussion
2. Confirm with the repository maintainer that the RFC has been ratified
3. Read the `AGENTS.md` at the repository root for general contribution rules

## RFC lifecycle

```
Draft → Review → Accepted → Implemented
                ↘ Rejected
                ↘ Superseded (by another RFC)
```

An RFC only leaves `Draft` after explicit review. While in `Draft`, its content may change without notice.

After `Implemented`: the RFC is **frozen** — move it to `rfcs/implemented/`. Do not edit it further. The canonical documentation for the implemented feature lives in `dsl/` (for language features) or `packages/*/docs/` (for tooling features).

After `Rejected`: move the RFC to `rfcs/rejected/`. It serves as a record of what was considered and why it was not pursued.

## Folder structure

```
rfcs/
├── AGENTS.md              ← this file
├── <number>-<name>.md     ← active RFCs (Draft / Review / Accepted)
├── implemented/           ← RFCs that reached Implemented status (frozen)
└── rejected/              ← RFCs that were Rejected (frozen)
```

## Relationship to tasks/

| `rfcs/` | `tasks/` |
|---|---|
| "Should we do X, and how?" | "We decided to do X — here is what exactly needs to change" |
| Requires ratification | No ratification needed |
| Frozen after implementation | Removed after implementation |

An RFC that reaches `Accepted` often produces one or more task files describing the concrete implementation steps.

---

## Package impact table

Every RFC header includes a package impact table immediately after the metadata fields and before the first `---` separator. It answers: "which packages need code changes if this RFC is implemented?"

### Format

```markdown
| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| SYMBOL | SYMBOL | SYMBOL | SYMBOL | SYMBOL |
```

When the RFC also touches packages outside the core five (e.g. `transpiler-core`, `dot-agent-cli`), add a note block on the next line:

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

Update the table whenever a pending decision (`?`) is resolved. When moving an RFC from `Draft` to `Accepted`, all `?` cells must be resolved to `—`, `⚠️`, or `🔄`.

### Quick reference: package responsibilities

| Package | Layer | Responsibility |
|---|---|---|
| `@dot-agent/tree-sitter` | L0 | WASM grammar — syntax rules only |
| `@dot-agent/parser-dsl` | L1 | Rust/WASM parser → `BehaviorFile` + `DescriptionFile` |
| `@dot-agent/compiler` | L2 | Linting, semantic validation, `.agent` ZIP packaging |
| `@dot-agent/kernel-dsl` | L2 | Micro-kernel FSM execution, emits `Effect[]` |
| `@dot-agent/sdk` | L3 | Browser-compatible dispatch layer, loads `.agent` bundles |
