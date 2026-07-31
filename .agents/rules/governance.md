---
description: Lifecycles for project/ governance artifacts (ADR / RFC / plan / task / pre-release log) — the DA numbering scheme, when each is immutable, frozen, permanent or ephemeral, and which skill closes which.
paths: ["project/**"]
---

## project/ governance — lifecycles

The **what and why** of each artifact type lives in [`../../GOVERNANCE.md`](../../GOVERNANCE.md) (the
human-facing doc). This rule is the **operational detail** for working inside `project/` — it loads only
when a file under here is in context.

Records are scaffolded from [`../../project/templates/`](../../project/templates/) with the
[`vibe-ops`](https://github.com/entelekheia-ai/vibe-ops) plugin (`/vibe-ops:new-adr`, `new-rfc`,
`new-plan`, `new-task`). The templates and the numbering below are the contract; the plugin is only how
they are applied — do not copy its skills into this repo, and do not hand-roll a record when a template
exists.

### The DA numbering scheme

Decisions are numbered `DA<minor>-<seq>` while the language is pre-v1.0, not with plain consecutive
integers. `DA00-xx` governs **all** milestones; `DA0N-xx` is anchored to milestone v0.N — the boundary
test is *one milestone or all?* Numeric only, **never renumbered**; supersession may cross milestones
(`DA02-03` supersedes `DA01-11`). The scheme and its rejected alternatives are
[DA00-01](../../project/adr/DA00-01-traceability-scheme.md).

This applies to ADRs and to the pre-release logs. **RFCs and plans do not use it** — RFCs are the public
lane and keep plain `NNNN`; plans use `NNN`.

### ADR (`project/adr/`)

```
Proposed → Accepted → (Deprecated | Superseded by DA<minor>-<seq>)
```

**Immutable once Accepted.** Never edit the substance of an accepted ADR and never delete one — to change
a decision, write a *new* ADR that supersedes it and set the old one's `Superseded by`. One decision per
file; the title is the decision as a short noun phrase. Fill Context → Decision → Options considered →
Consequences — the rejected options are the point. Add a `Sunset & reversal` section only if the decision
is expected to expire, following
[DA00-03](../../project/adr/DA00-03-model-tiering-for-agent-routing.md) exactly.

An ADR is often distilled out of an RFC's *Decisions Closed* section so the decision becomes findable on
its own, but it can also stand alone. If the design is still open it is **not** an ADR — write an RFC.

### RFC (`project/rfcs/`)

Note the folder is `rfcs/`, plural. Numbering is plain zero-padded `NNNN`.

```
Draft → Review → Accepted → Implemented
              ↘ Rejected
              ↘ Superseded
```

| Stage | Meaning | Gate to advance |
|---|---|---|
| Draft | Under discussion, may change without notice | A champion + a complete first draft from the template |
| Review | Open for explicit review | Every `?` cell in the package-impact table resolved |
| Accepted | Ratified, may spawn tasks | Maintainer sign-off, recorded in the header |
| Implemented | Shipped | Code merged; canonical docs now live in `dsl/` or `packages/*/docs/` |

After `Implemented`: **frozen**, move to `rfcs/implemented/`, do not edit further. After `Rejected`: move
to `rfcs/rejected/`.

Nothing in `rfcs/` is a source of truth for implementation — code and schemas there are illustrative. The
truth for the **language** is `dsl/`; for **implementation**, `packages/*/` and `packages/*/docs/`.

Every RFC carries a **package-impact table** in its header — the symbol legend, the layer map and when to
update it are in [`../../project/rfcs/AGENTS.md`](../../project/rfcs/AGENTS.md), which is the authoring
detail this rule deliberately does not duplicate.

### Plan (`project/plans/`)

```
Backlog → In Progress → Shipped   (the file is never deleted)
```

**Permanent.** A plan answers "how do we build X?" and stays as the design record after the work ships —
the opposite of a task. Numbering is `NNN`, monotonic, never renumbered. Use a plan, not a task, when the
work spans several phases that land at different times: a task that still has open roadmap items months
after its first item shipped is a plan wearing the wrong template.

Four sections are **living** and are maintained while the work happens, not written at the end:
`Progress` (dated checkboxes), `Surprises & Discoveries` (`Observation:` / `Evidence:`), `Decision Log`
(`Decision:` / `Rationale:` / `Date / Author:`), and `Outcomes & Retrospective`. Reconstructed from memory
afterwards they are worthless — the value is entirely in writing the entry when it happens.

If a plan carries a GitHub issue, the **issue owns status and the executive summary; the file owns the
design and the working record**. The issue closes when the last track lands; the plan file does not.

At closure use `/vibe-ops:close-plan` — retrospective against the plan's own goals, every `Surprises &
Discoveries` entry routed to a durable surface, the demotion check run, living docs propagated, issue
closed and **the file kept**.

### Task (`project/tasks/`)

Ephemeral work orders for something already decided — *what* to build, not whether:

```
Planned → In Progress → Done → (file removed; git history is the archive)
```

Everything in `tasks/` is **pending**. A task file describes intent, not outcome: before assuming one is
complete, check its `Status`, then verify the package code — grep for the types, functions or exports it
names.

Naming carries the provenance: `<topic>.md` for standalone technical debt, `<ID>-<topic>.md` when an RFC
or a DA decision owns the *why* (`0018-transpiler-core.md`, `DA01-01-grammar-unfreeze.md`). With an ID
prefix the task only needs to say *what* and *in what order* — always link the source document in the
header's `Sources` row.

At closure use `/vibe-ops:close-task` — it writes back to the source doc, propagates to living docs,
spawns an ADR if a hard-to-reverse decision emerged, **routes each learning** to a durable surface, then
distills and deletes the dossier. Never skip the write-back or the routing: those are what keep the docs
from drifting and keep a learning from being deleted along with the file.

### Pre-release log (`project/pre-release/v<minor>/`)

This repo's long-form narrative companion — the equivalent of a `log/` folder, named for the milestone it
belongs to. Optional appendices to a DA decision: rich context for agents, dead ends, what was tried and
abandoned, the reasoning an ADR is too terse to carry. No community review, and **gaps are expected** —
most decisions need no log, so the numbering here is sparse by design.

Never retro-edit a log to match a later decision; a superseding decision gets its own ADR and optionally
its own log.
