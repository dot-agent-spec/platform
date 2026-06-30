<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DA00-03: Model tiering for subagent and skill routing

> Migrated from legacy ADR-0002 under [DA00-01](DA00-01-traceability-scheme.md).

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-23 |
| Deciders | Danilo Borges |

---

## Context

Work in this repository is increasingly delegated to AI subagents and skills. Tasks vary widely in
their cost/quality needs: architecture and design demand the strongest available model, while mechanical
boilerplate (reformatting, filling templates with known values) is wasteful on a strong model.

The tooling already exposes model selection declaratively — subagent definitions carry a `model:` field,
and skill frontmatter accepts `model`, `effort`, `context: fork`, and `agent` (see
https://code.claude.com/docs/en/skills). What it does **not** yet do is choose the model per task
automatically. The choice is manual and easy to get wrong by habit — either everything runs on the
default/strongest model (needless cost) or everything runs cheap (quality loss on hard tasks). Several
subagents and skills already exist with deliberate model settings, and more are being created; without a
shared principle, routing drifts and becomes inconsistent.

## Decision

Adopt a **tier-based routing principle** for new subagents and skills:

- judgment-heavy (architecture, design, ambiguous trade-offs) → **strongest** tier;
- structured execution (drafting from a template/brief, multi-file edits) → **mid** tier;
- mechanical (boilerplate, reformatting, known-value fills) → **cheap** tier, raising `effort` only when
  the task genuinely needs it.

Default to **`inherit`** when unsure. **Do not override the model already declared on an existing
subagent** — those settings were chosen deliberately; this principle applies to *new* creations and to
authors deciding from scratch. The operational heuristic lives in the root `AGENTS.md`; this ADR holds
the rationale.

## Options considered

- **A — No guidance.** Rely on per-author / per-harness judgment. Simple, but inconsistent and tends
  toward "everything on the default model."
- **B — Rigid mandatory task→model mapping.** Maximally consistent, but fights good harness defaults,
  goes stale as model names change, and overrides deliberate configs. Too much control.
- **C — Principle-based heuristic by tier, `inherit` default, respect existing configs (chosen).**
  Orients the choice without dictating it; stable because it names *tiers*, not model IDs.

## Consequences

- **Easier:** consistent, cost-aware routing; cheap tasks stop burning the strongest model; the
  principle survives model renames because it is expressed in tiers.
- **Accepted costs:** it is guidance, not enforcement — it relies on agents and authors following it;
  tier boundaries are fuzzy at the edges. No retroactive change is made to existing subagents.

## Sunset & reversal

This decision is **expected to become obsolete** as the surrounding systems mature — it is a stopgap for
the current state where per-task model selection is manual.

- **When to revisit:** when per-task model selection is automated — e.g. a runtime/router that scores
  task difficulty and selects the tier automatically (a fast router model dispatching to heavier models
  on demand) — or when model tiers collapse such that one model spans the range cost-effectively and the
  distinctions no longer map to real cost/quality differences.
- **How to unwind (the map):**
  1. Supersede this ADR with a new one describing the automated routing (set this ADR `Superseded by`).
  2. Remove the "Working with subagents and skills" heuristic block from the root `AGENTS.md`.
  3. Audit skills/subagents that set `model`/`effort` by hand and decide, per item, whether to hand them
     to the router or keep an explicit override.
- Nothing else in the repository depends on this decision, so reversal is local and low-risk.

## Related

- Root [`AGENTS.md`](../AGENTS.md) — the operational heuristic this ADR justifies
- [`GOVERNANCE.md`](../GOVERNANCE.md) — process
- [DA00-02](DA00-02-two-axis-versioning.md) — sibling decision record
