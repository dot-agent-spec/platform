# AGENTS.md — tasks/

## Status of this folder

Documents in `tasks/` are **implementation work items** — technical debt, planned features, and prerequisite changes that have already been decided (either informally or via an accepted RFC).

- Tasks here describe **what to build**, not whether to build it — that decision was made elsewhere
- A task file may be a prerequisite for an RFC, a consequence of an accepted RFC, or standalone technical debt
- Tasks are **not** design proposals — if something still needs design discussion, it belongs in `rfcs/` first

## What is NOT implemented yet

**Everything in this folder is pending.** No task file here reflects work that has been done. Before assuming a task is complete:

1. Check the task file's `Status` field
2. Verify the actual package code — the task file describes intent, not outcome
3. If a task references types, functions, or exports, grep the relevant package to confirm they exist

## Task lifecycle

```
Planned → In Progress → Done → (file removed or archived)
```

Tasks do not accumulate forever. When a task is fully implemented, remove or archive the file — the canonical record of what was built lives in the package code and its `AGENTS.md`.

## Folder structure

```
tasks/
├── AGENTS.md          ← this file
└── <topic>.md         ← one file per work area
```

## Relationship to RFCs

| `rfcs/` | `tasks/` |
|---|---|
| "Should we do X, and how?" | "We decided to do X — here is what exactly needs to change" |
| Requires ratification | No ratification needed |
| Frozen after implementation | Removed after implementation |

## Naming convention

**Standalone tasks** (not derived from a specific RFC): `<topic>.md`
Examples: `pre-public-consolidation.md`, `compiler-api.md`

**RFC-derived tasks**: `<RFC-ID>-<topic>.md`
Examples: `0021-grammar-unfreeze.md`, `0021-compiler-work.md`

The RFC ID prefix signals which RFC owns the "why" — when the RFC is the source of truth, the task only needs to say *what* and *in what order*, not why the decision was made. Always link to the RFC in the task header.
