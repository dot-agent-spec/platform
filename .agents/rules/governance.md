---
description: Lifecycles for project/ governance artifacts (ADR / RFC / plan / task / log) — the DA numbering scheme, when each is immutable, frozen, permanent or ephemeral, and which skill closes which.
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

Two sections are **living** and are maintained while the work happens, not written at the end:
`Decision Log` (`Decision:` / `Rationale:` / `Date / Author:`) and `Outcomes & Retrospective`.
Reconstructed from memory afterwards they are worthless — the value is entirely in writing the entry when
it happens.

`## Tracks` carries **one checkbox per track and no finer**, plus the `close-plan` box last. Per-step
progress and the discoveries made along the way belong to the task dossier a track spawns, which is
deleted at closure — the doing goes to the dossier, the design stays in the plan.

If a plan carries a GitHub issue, the **issue owns status and the executive summary; the file owns the
design and the working record**. The issue closes when the last track lands; the plan file does not.

At closure use `/vibe-ops:close-plan` — retrospective against the plan's own goals, the demotion check
run, living docs propagated, issue closed and **the file kept**. It routes nothing: what the work taught
was written into the task dossier each track spawned and was discharged when that dossier closed.

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

A dossier carries `## Surprises & Discoveries`, and it is the **only** record that does — the doing is
written here, while it happens, because this file is deleted at closure and so its notes are discharged by
construction. A note written into the permanent plan instead stays pending forever.

At closure use `/vibe-ops:close-task` — it writes back to the source doc, propagates to living docs,
spawns an ADR if a hard-to-reverse decision emerged, **routes every `Surprises & Discoveries` entry** to a
durable surface, then distills and deletes the dossier. Never skip the write-back or the routing: those
are what keep the docs from drifting and keep a learning from being deleted along with the file.

### Log (`project/log/`)

Write-once narrative context, for either of two reasons: what an ADR is too terse to carry (dead ends, the
reasoning behind a decision — pairs with that ADR and links to it both ways), or the rich context of one
unit of work, decision or not. **Gaps are expected**: most work needs no log.

A log entry **MUST** name, in its `path:`, the file, folder or package where someone meets the trap again.
That field is the admission test and the retirement detector at once — a fact with no locatable place to
recur is a decision (an ADR) or nothing, and an entry whose `path:` no longer exists on disk is deleted.
Entries are written with `/vibe-ops:new-log`, never by hand, and indexed in
[`../../project/log/README.md`](../../project/log/README.md).

A log **MUST NOT** be retro-edited to agree with a later decision; a superseding decision gets its own ADR
and optionally its own log.

> **`project/pre-release/v<minor>/` is gone.** It held this repo's long-form logs before the record type
> existed here, and was retired on 2026-08-13 because it is the one location the tooling cannot be told
> about — every closure ceremony routed to a destination that did not exist. Its ten documents were routed
> out one at a time rather than moved wholesale, and the folder was removed on 2026-08-14 with the last of
> them. A log **MUST** go to `project/log/` above. The reasoning per document is in
> [Plan-001](../../project/plans/shipped/001-adopt-vibe-ops-baseline.md)'s Decision Log.
