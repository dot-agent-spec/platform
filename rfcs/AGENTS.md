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
