<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DA00-01: Pre-1.0 decision traceability (the DA scheme)

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-23 |
| Deciders | Danilo Borges |

> This is the record that governs how all other decisions are recorded — effectively "decision zero".

---

## Context

Pre-v1.0 is a deliberate rapid-iteration phase: the language and its decisions churn, change behavior,
and break on the way to a stable v1.0. Two needs follow:

1. Decisions must be **anchored to the milestone that made them**, so obsolescence, behavioral changes,
   and breaks can be read per minor version as the language evolves.
2. The terse **decision** must be separated from the **rich long-form rationale** (AI collaboration,
   dead-ends, deep brainstorms) that is valuable context for LLM agents but would bloat a decision record.

Standard consecutive `0001` ADR numbering carries no milestone context and conflates these two needs.

## Decision

Adopt the **DA scheme** for decision records during the pre-1.0 epoch.

- **ID format `DA<minor>-<seq>`**, where `DA` marks the pre-v1.0 epoch.
  - `DA00-xx` — decisions that govern **all** milestones (cross-cutting / foundational), e.g. this
    scheme, versioning, model tiering.
  - `DA0N-xx` — decisions **anchored to milestone v0.N** (e.g. `DA01-xx` for v0.1 grammar/behavior).
  - **Boundary test:** *does this govern one milestone or all of them?* One → `DA0N`. All → `DA00`. If
    even that is unclear, file under the current `DA0N` and supersede later.
- **Numeric `seq` only.** No category field and no alpha codes — they would add structure we cannot yet
  justify, and both are non-breaking to introduce later if a real grouping need emerges.
- A decision is **stamped with the milestone open when it is made**.
- **IDs are never renumbered.** Post-1.0 they freeze as historical handles.
- **Records** are ADRs in [`project/adr/`](.) — the terse, consecutive index of "what we decided".
- **Optional long-form logs** live in `project/pre-release/v<minor>/DA0N-xx-<slug>.md`, linked
  bidirectionally with their ADR. Not every decision needs one, so log numbering will have gaps.
- **Obsolescence and breaks** are tracked with `Supersedes` / `Superseded by` **across milestone
  boundaries** (e.g. `DA02-03` supersedes `DA01-11`). That chain is the readable history of what broke
  and when.
- **External community proposals** during incubation use the public RFC lifecycle
  ([`project/rfcs/`](../rfcs/)), not the DA scheme.

## Options considered

- **A — Standard consecutive `0001` ADRs.** Simple, but milestone-agnostic — cannot read "v0.1
  decisions" or track per-minor breaks.
- **B — Encode category in the ID (alpha = meta, numeric = architecture).** Brittle: IDs should be
  opaque handles; embedding semantics causes boundary disputes and lies when a decision is mixed.
  Rejected.
- **C — Milestone-anchored `DA<minor>-<seq>`, numeric-only, `DA00` for cross-cutting (chosen).** Carries
  milestone context, gives a clean supersession chain for documenting breaks, and adds the least
  structure. The `DA00` vs `DA0N` split uses a crisp "one milestone vs all" test rather than a fuzzy
  meta/architecture line.

## Consequences

- **Easier:** read decisions per milestone; document obsolescence/breaks via supersession chains across
  minors; the prefix self-documents "this belongs to the breakable pre-1.0 era".
- **Accepted costs:** a one-time migration of the legacy `ADR-000x` records into `DA00` (below); the
  maintainer must stamp the correct minor; pre-release log numbering looks gappy (intended).

### One-time migration (legacy → DA scheme)

| Legacy | Now | Scope rationale |
|---|---|---|
| ADR-0001 two-axis-versioning | `DA00-02` | versioning policy governs all milestones |
| ADR-0002 model-tiering-for-agent-routing | `DA00-03` | routing policy governs all milestones |
| ADR-0003 parser-optimization-boundaries | `DA00-04` | architectural boundary governs all milestones |

This is a migration *into* the scheme, not a renumbering of DA IDs — going forward DA IDs are frozen.

## Sunset & reversal

The DA scheme is itself a pre-1.0 measure.

- **When to revisit:** at v1.0, the project may switch to clean consecutive numbering for the stable
  era. The DA epoch closes; DA IDs remain frozen as historical handles, never renumbered.
- **How to unwind:** supersede this `DA00-01` with a new `DA00` record describing the post-1.0 scheme;
  leave all existing DA records in place.

## Related

- [`GOVERNANCE.md`](../../GOVERNANCE.md) — § Pre-1.0 Incubation (DA01 Lifecycle)
- [`project/pre-release/`](../pre-release/) — long-form incubation logs
- [`ROADMAP.md`](../../ROADMAP.md) — milestones the minors map to
