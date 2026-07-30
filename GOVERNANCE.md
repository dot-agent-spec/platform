# Governance

How decisions are made and recorded in this project. The aim is that the *process* — not the size of
the team — is what makes the project legible: every change has a known shape, a known lifecycle, and a
durable record of why it happened.

---

## The four document types

Each kind of change has a home. Picking the right one is the first decision.

| Type | Answers | Lives in | Template | Ratified? |
|---|---|---|---|---|
| **RFC** | "Should we do X, and how?" | [`project/rfcs/`](project/rfcs/) | [`project/templates/rfc.md`](project/templates/rfc.md) | Yes |
| **ADR** | "We decided X, because Y" | [`project/adr/`](project/adr/) | [`project/templates/adr.md`](project/templates/adr.md) | The decision itself |
| **Plan** | "How do we build X?" | [`project/plans/`](project/plans/) | [`project/templates/plan.md`](project/templates/plan.md) | No |
| **Task** | "We decided to do X — here's what to change" | [`project/tasks/`](project/tasks/) | [`project/templates/task.md`](project/templates/task.md) | No |

Rule of thumb: if the design is still open, it is an **RFC**. Once a load-bearing choice is settled,
distill it into an **ADR** so it is findable. When work is greenlit, write a **plan** if it will land in
phases over time, or a **task** if it is one concrete work order.

**Plan or task?** They differ by lifespan, not by size. A task is deleted when its work is done, so it
suits work that finishes at one moment. A plan is permanent and carries a living record — `Progress`,
`Surprises & Discoveries`, `Decision Log`, `Outcomes & Retrospective` — kept current *while* the work
happens, so it suits work whose phases ship at different times and whose reasoning someone will want a
year later. A task still holding open roadmap items long after its first item shipped is a plan wearing
the wrong template.

Records are scaffolded from `project/templates/` using the
[`vibe-ops`](https://github.com/entelekheia-ai/vibe-ops) Claude Code plugin — `/vibe-ops:new-rfc`,
`new-adr`, `new-plan`, `new-task` to open one, `/vibe-ops:close-plan` and `/vibe-ops:close-task` to close
one properly. **The templates and the lifecycles in this file are the contract; the plugin is only how
they are applied** — a contributor without it copies the template by hand and nothing is lost.

---

## Pre-1.0 Incubation (DA scheme)

While the language is pre-v1.0, the project iterates rapidly and decisions break on the way to a stable v1.0. Decisions use the **DA traceability scheme** instead of plain consecutive `0001` numbering. The scheme, its rationale, and the rejected alternatives are the decision record [DA00-01](project/adr/DA00-01-traceability-scheme.md); this section is the operational summary.

- **ID format `DA<minor>-<seq>`.** `DA00-xx` for decisions that govern **all** milestones (cross-cutting); `DA0N-xx` for decisions anchored to milestone v0.N. Boundary test: *one milestone or all?* Numeric only; **never renumbered**.
- **ADRs are the index** (`project/adr/`) — the terse "what we decided". Breaks across milestones are tracked with `Supersedes` / `Superseded by` (e.g. `DA02-03` supersedes `DA01-11`).
- **Long-form logs are optional appendices** in `project/pre-release/v<minor>/` (e.g. `DA01-021-forgiving-syntax.md`) — rich context for LLM agents, no community review. Not every decision needs one, so log numbering has gaps.
- **External proposals** during incubation use the public RFC lifecycle (`project/rfcs/`), not the DA scheme.

---

## RFC lifecycle

Modeled on staged proposal processes (TC39 stages, Rust RFCs). A proposal earns its way forward and
may be rejected at any stage without prejudice.

```
Draft → Review → Accepted → Implemented
              ↘ Rejected      (→ moved to project/rfcs/implemented/, frozen)
              ↘ Superseded
```

| Stage | Meaning | Gate to advance |
|---|---|---|
| **Draft** | Under discussion. Content may change without notice. | A champion + a complete first draft from the template. |
| **Review** | Open for explicit review. | All `?` cells in the package-impact table resolved. |
| **Accepted** | Ratified. May spawn tasks. | Maintainer sign-off, recorded in the header. |
| **Implemented** | Shipped. RFC is frozen and moved to `project/rfcs/implemented/`. | Code merged; canonical docs live in `dsl/` or `packages/*/docs/`. |

An RFC never edits after **Implemented** — the living documentation takes over. The package-impact table
every RFC carries is documented in [`project/rfcs/AGENTS.md`](project/rfcs/AGENTS.md).

## ADR lifecycle

```
Proposed → Accepted → (Deprecated | Superseded by DA<minor>-<seq>)
```

ADRs are **immutable once Accepted**. To change a decision, write a new ADR that supersedes the old one
and update the old one's `Superseded by` field. The chain of ADRs is the project's decision history.

## Plan lifecycle

```
Backlog → In Progress → Shipped     (the file is never deleted)
```

A plan is the permanent design record for a multi-phase build. Its four living sections are maintained
while the work happens, not written at the end — filled in retrospectively they are worthless. Closing
one means writing the retrospective against the plan's own goals and routing each discovery to a durable
surface; the issue closes, the file stays.

## Task lifecycle

```
Planned → In Progress → Done → (file removed or archived)
```

Tasks do not accumulate — the canonical record of what was built is the code and its `AGENTS.md`.

---

The operational detail behind all four — the DA numbering scheme, folder conventions, and what closing
each one requires — is [`.agents/rules/governance.md`](.agents/rules/governance.md), which loads
automatically whenever a file under `project/` is in context.

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
