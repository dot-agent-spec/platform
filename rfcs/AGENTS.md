# AGENTS.md — rfcs/

## Status of this folder

Documents in `rfcs/` are **design proposals**, not final specifications.

- Code, schemas, and interfaces described here are **illustrative** — they exist to communicate design intent, not to be implemented directly
- No RFC here should be treated as a source of truth for implementation
- The source of truth for the language is `dsl/language.md`
- The source of truth for the compiler is `packages/compiler/`

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
