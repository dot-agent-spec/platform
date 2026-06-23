# AGENTS.md — adr/

## Status of this folder

Documents in `adr/` are **Architecture Decision Records** — each captures one decision that is hard to
reverse: "we chose X, because Y, and we accept consequence Z". Smaller grain than an RFC.

- An RFC argues a *direction* ("should we do X, and how?"); an ADR records a *settled choice*.
- ADRs are often distilled out of an RFC's *Decisions Closed* section so the decision becomes findable
  on its own, but an ADR can also stand alone for a decision made outside any RFC.
- If the design is still open, it does **not** belong here — write or update an RFC first.

## ADR lifecycle

```
Proposed → Accepted → (Deprecated | Superseded by ADR-NNNN)
```

**An ADR is immutable once Accepted.** To change a decision, write a *new* ADR that supersedes the old
one, and set the old one's `Superseded by` field. Never edit the substance of an accepted ADR and never
delete one — the chain of ADRs is the project's decision history.

## Creating an ADR

1. Copy [`../templates/adr.md`](../templates/adr.md) to `adr/<NNNN>-<kebab-title>.md`.
2. One decision per file. The title is the decision as a short noun phrase.
3. Fill Context → Decision → Options considered → Consequences. Including rejected options is the point.

## Folder structure

```
adr/
├── AGENTS.md              ← this file
└── <NNNN>-<kebab-title>.md
```

## Relationship to rfcs/ and tasks/

| `rfcs/` | `adr/` | `tasks/` |
|---|---|---|
| "Should we do X, and how?" | "We decided X, because Y" | "We decided — here's what to change" |
| Requires ratification | Is the record of the decision | No ratification needed |
| Frozen after implementation | Immutable once Accepted | Removed after implementation |

See [`../GOVERNANCE.md`](../GOVERNANCE.md) for the full process.
