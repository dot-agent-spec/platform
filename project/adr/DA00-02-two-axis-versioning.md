<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DA00-02: Two-axis versioning — DSL version vs package versions

> Migrated from legacy ADR-0001 under [DA00-01](DA00-01-traceability-scheme.md).

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-23 |
| Deciders | Danilo Borges |

<!-- Born Accepted: the decision was already made (resolving B2). `Proposed` would be used only
     if this record were circulated for ratification before deciding. -->

---

## Context

The repository ships several packages whose versions had drifted apart — `tree-sitter` `0.4.1`,
`kernel-dsl` `0.1.3`, and `parser-dsl` / `compiler` / `sdk` at `0.1.0` (the B2 item in
[`tasks/pre-public-consolidation.md`](../tasks/pre-public-consolidation.md)). Before the first public
release we needed an explicit, written version policy.

Two things move at different rates and serve different audiences:

- the **language's user-facing capability** — what an agent author can express; and
- each **package's implementation** — which changes for internal reasons unrelated to language scope.

Conflating them forces a bad trade: either lockstep churn (bumping packages that did not change just to
keep numbers aligned), or an opaque set of package versions that gives users no single "language
version" to cite.

## Decision

Track **two independent version axes**:

1. **DSL version** — the public capability tier (`v0.1`, `v0.2`, … `v1.0`). This is what docs and agent
   authors cite.
2. **Package versions** — per-package semver, evolving independently.

At each public release the **package tens digit mirrors the DSL milestone**: `0.10.x` = DSL `v0.1`,
`0.20.x` = DSL `v0.2`, … converging at `1.0`. Within a tens band, each package keeps its own
minor/patch freedom. All packages make a one-time jump to `0.10.x` at the first public publish. The
grammar is *preview* while `0.x`; the public stability commitment is `v1.0`.

## Options considered

- **A — Lockstep all packages to one version.** Simple mental model, but forces version churn on
  packages that did not change and couples unrelated release cadences.
- **B — Fully independent per-package semver, no relationship.** Honest per package, but users get no
  single "language version" to cite and no signal of which package set ships together.
- **C — Two axes with tens-digit mirroring (chosen).** Users cite one DSL version; packages keep
  independent semver; the tens digit gives an at-a-glance "which milestone" signal without lockstep
  churn. Best of A's legibility and B's independence.

## Consequences

- **Easier:** docs and authors reference one DSL version; a glance at a package's tens digit reveals
  which DSL milestone it targets; packages still release on their own cadence.
- **Accepted costs:** the tens-digit mapping is a manual discipline (remember to bump by tens at
  milestone boundaries); a one-time coordinated jump to `0.10.x` is required at first publish.
- **Follow-up:** add a release-time check (CI) that the package tens digit matches the current DSL
  milestone; revisit this ADR at `v1.0`, when both axes converge.

## Related

- [`tasks/pre-public-consolidation.md`](../tasks/pre-public-consolidation.md) — B2, where this decision was recorded inline
- [`ROADMAP.md`](../ROADMAP.md) — § Two version axes (the policy in the roadmap)
- [`GOVERNANCE.md`](../GOVERNANCE.md) — § Versioning & stability
