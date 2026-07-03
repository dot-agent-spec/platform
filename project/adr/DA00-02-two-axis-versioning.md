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

A third pressure sits underneath both: a built `.agent` bundle has to record, mechanically, which
language it was authored against and which package built it — not just as a documentation convention,
but as data stamped into `aboutme.json` at pack time. Any versioning policy that only talks about git
tags and registry numbers, without saying what gets written into the bundle itself, leaves that
provenance question unanswered.

## Decision

Track **two independent version axes**:

1. **DSL version** — the public capability tier (`v0.1`, `v0.2`, … `v1.0`). This is what docs and agent
   authors cite.
2. **Package versions** — per-package semver, evolving independently.

At each public release the **package tens digit mirrors the DSL milestone**: `0.10.x` = DSL `v0.1`,
`0.20.x` = DSL `v0.2`, … converging at `1.0`. Within a tens band, each package keeps its own
minor/patch freedom. All packages make a one-time jump to `0.10.x` at the first public publish. The
grammar is *preview* while `0.x`; the public stability commitment is `v1.0`.

### Provenance stamping

Each axis has exactly one concrete carrier, and each bundle stamps both:

- **DSL axis** — `dsl/VERSION`, a single-line file living alongside the spec itself
  (`dsl/explanation`, `dsl/reference`, `dsl/tutorials`), the language's own manifest in the same sense
  that a `Cargo.toml`/`package.json` is a package's. Stamped into every built bundle as
  `aboutme.json`'s `dslVersion` field.
- **Package axis** — the real, installed version of whatever package produced the bundle (e.g.
  `@dot-agent/compiler`). Stamped as `aboutme.json`'s `compiler` field.

`dslVersion` is not split into a separate "schema version" field for the envelope format. The DSL exists
solely to serve this one bundle format — there is no consumer of `aboutme.json`'s structure independent
of the language it serializes. The relationship is the same as an HTML document's DOCTYPE: one version
number coordinates syntax *and* tooling at once, not two numbers that could drift apart. A bundle that
says `dslVersion: 0.1` is making exactly one claim — "parse and run me under v0.1 rules" — and that claim
covers both the grammar and the envelope shape together.

This is small but load-bearing: [`ROADMAP.md` § Evolution after v1.0 — editions](../../ROADMAP.md)
depends on every bundle honestly recording which language version it speaks, from v0.1 onward. The
editions escape hatch only works if that provenance was never optional.

## Options considered

- **A — Lockstep all packages to one version.** Simple mental model, but forces version churn on
  packages that did not change and couples unrelated release cadences.
- **B — Fully independent per-package semver, no relationship.** Honest per package, but users get no
  single "language version" to cite and no signal of which package set ships together.
- **C — Two axes with tens-digit mirroring (chosen).** Users cite one DSL version; packages keep
  independent semver; the tens digit gives an at-a-glance "which milestone" signal without lockstep
  churn. Best of A's legibility and B's independence.

For the provenance carrier specifically, the alternative considered was **splitting `dslVersion` from a
separate `schemaVersion`** (envelope format vs. language capability, versioned independently).
Rejected: this project has no envelope consumer that isn't also a language consumer, so the split adds a
number with no independent audience — it only recreates the same conflation problem this ADR exists to
resolve, one layer down.

## Consequences

- **Easier:** docs and authors reference one DSL version; a glance at a package's tens digit reveals
  which DSL milestone it targets; packages still release on their own cadence; every bundle is
  self-describing about which language rules it was authored under.
- **Accepted costs:** the tens-digit mapping is a manual discipline (remember to bump by tens at
  milestone boundaries); a one-time coordinated jump to `0.10.x` is required at first publish;
  `dsl/VERSION` must be bumped deliberately at each DSL milestone, in lockstep with the tens-digit jump
  it triggers on the package axis.
- **Follow-up:** add a release-time check (CI) that the package tens digit matches the current DSL
  milestone; revisit this ADR at `v1.0`, when both axes converge.

## Related

- [`tasks/pre-public-consolidation.md`](../tasks/pre-public-consolidation.md) — B2, where this decision was recorded inline
- [`tasks/DA01-01-dsl-spec-versioning.md`](../tasks/DA01-01-dsl-spec-versioning.md) — implements the DSL-axis provenance stamping described here
- [`tasks/DA01-01-update-version-and-packages.md`](../tasks/DA01-01-update-version-and-packages.md) — implements the package-axis rehearsal and publish mechanism
- [`pre-release/v0.1/DA00-02-pre-alpha-rehearsal.md`](../pre-release/v0.1/DA00-02-pre-alpha-rehearsal.md) — long-form log of the `0.5.0-alpha.1` rehearsal that validated this ADR's publish mechanism end-to-end
- [`ROADMAP.md`](../../ROADMAP.md) — § Two version axes (the policy in the roadmap)
- [`GOVERNANCE.md`](../../GOVERNANCE.md) — § Versioning & stability