# Governance

How decisions are made and recorded in this project. The aim is that the *process* — not the size of
the team — is what makes the project legible: every change has a known shape, a known lifecycle, and a
durable record of why it happened.

---

## The three document types

Each kind of change has a home. Picking the right one is the first decision.

| Type | Answers | Lives in | Template | Ratified? |
|---|---|---|---|---|
| **RFC** | "Should we do X, and how?" | [`rfcs/`](rfcs/) | [`templates/rfc.md`](templates/rfc.md) | Yes |
| **ADR** | "We decided X, because Y" | `adr/` | [`templates/adr.md`](templates/adr.md) | The decision itself |
| **Task** | "We decided to do X — here's what to change" | [`tasks/`](tasks/) | [`templates/task.md`](templates/task.md) | No |

Rule of thumb: if the design is still open, it is an **RFC**. Once a load-bearing choice is settled,
distill it into an **ADR** so it is findable. When work is greenlit, write a **task**.

---

## RFC lifecycle

Modeled on staged proposal processes (TC39 stages, Rust RFCs). A proposal earns its way forward and
may be rejected at any stage without prejudice.

```
Draft → Review → Accepted → Implemented
              ↘ Rejected      (→ moved to rfcs/implemented/, frozen)
              ↘ Superseded
```

| Stage | Meaning | Gate to advance |
|---|---|---|
| **Draft** | Under discussion. Content may change without notice. | A champion + a complete first draft from the template. |
| **Review** | Open for explicit review. | All `?` cells in the package-impact table resolved. |
| **Accepted** | Ratified. May spawn tasks. | Maintainer sign-off, recorded in the header. |
| **Implemented** | Shipped. RFC is frozen and moved to `rfcs/implemented/`. | Code merged; canonical docs live in `dsl/` or `packages/*/docs/`. |

An RFC never edits after **Implemented** — the living documentation takes over. See [`rfcs/AGENTS.md`](rfcs/AGENTS.md).

## ADR lifecycle

```
Proposed → Accepted → (Deprecated | Superseded by ADR-NNNN)
```

ADRs are **immutable once Accepted**. To change a decision, write a new ADR that supersedes the old one
and update the old one's `Superseded by` field. The chain of ADRs is the project's decision history.

## Task lifecycle

```
Planned → In Progress → Done → (file removed or archived)
```

Tasks do not accumulate — the canonical record of what was built is the code and its `AGENTS.md`. See
[`tasks/AGENTS.md`](tasks/AGENTS.md).

---

## Versioning & stability

The project tracks two version axes (DSL version vs package versions) and treats the grammar as
*preview* while `0.x`. The public stability commitment is **v1.0**, with editions as the post-1.0
evolution path. The full policy lives in [`ROADMAP.md`](ROADMAP.md).

---

## Decision record

Decisions made through this process leave a trail in one of: an RFC's *Decisions Closed* section, an
ADR, or a task's `Sources`. When a decision is hard to reverse or will be questioned later, prefer an
ADR — a buried decision is a decision that gets relitigated.
