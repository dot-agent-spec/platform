<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!--
 VERSIONING TASK TEMPLATE — copy to tasks/<ID>-<slug>.md and fill in.
 Use this for work that bumps or restructures a version number under DA00-02's two-axis
 policy (project/adr/DA00-02-two-axis-versioning.md) — whether that's the DSL/spec axis
 (dsl/VERSION, provenance stamped into aboutme.json) or the package axis (npm/crate semver,
 scripts/release.mjs, publish-*.yml), or both at once when a DSL milestone forces a
 coordinated package bump.
 Delete these comments before committing.
-->

# Task: <Versioning Task Title>

| Field | Value |
|---|---|
| Status | Planned |
| Created | YYYY-MM-DD |
| Author | Your Name |
| Version axis | DSL \| Package(s) \| Both |
| Sources | <!-- RFC/ADR/ROADMAP section that motivates this — usually DA00-02 --> |
| Depends on | <!-- prerequisite tasks/decisions --> |
| Sibling task(s) | <!-- the task(s) on the other axis this one must stay coordinated with, so each keeps single ownership of its own axis instead of duplicating checklist items --> |

---

## Context

<!-- What triggered this: a DSL milestone close-out, a drift discovered in provenance stamping,
     a package publish rehearsal, etc. Name the specific hardcoded values or manual steps this
     replaces, with file:line references verified against current source — not copied from a
     prior version of this doc. -->

## Version target(s)

<!-- One row per thing that gets a new version number. For a DSL-axis task this is usually one
     row (dsl/VERSION). For a package-axis task this is one row per package. Cite the actual
     current value read from source, not memory. -->

| What | Current | Target | Source of truth |
|---|---|---|---|
| … | … | … | e.g. `dsl/VERSION`, `packages/<pkg>/package.json`, `packages/<pkg>/Cargo.toml` |

## Pre-Release Checklist (Manual Housekeeping)

Before executing any automated release step, ensure:

- [ ] **Documentation & Examples:** `docs/` and `dsl/` reflect the target version; canonical
      `examples/` still validate.
- [ ] **RFC/DA & ADR Status:** any RFC this closes moves to `Implemented`; extract a permanent
      ADR from the Design Log if a naming/schema decision was made along the way (e.g. renaming
      a provenance field).
- [ ] **Provenance stamping:** if this touches `aboutme.json` fields (`compiler`, the
      DSL-version field), confirm the value is sourced from a real constant/file, not a literal
      — grep the target file for the old hardcoded string to confirm every call site was updated.
- [ ] **`/sync-implementation-status`:** run it and confirm the drift report shows only the
      changes this task intended — no incidental drift slipped in.
- [ ] **Task Cleanup:** delete completed implementation task files for this macro-task; this
      release task should be the only file remaining for it.
- [ ] **Workspace & Submodules:** `git status` clean; `Cargo.lock`/`package-lock.json` synced.

---

## Release Execution (Automated)

<!-- Package-axis tasks: point at `scripts/release.mjs` and the tag convention it must produce
     (`<pkg>@<version>`, matching each `publish-*.yml` trigger — verify the pattern, don't assume
     it still matches). DSL-axis-only tasks (no package publish) can skip this section or note
     "no package publish triggered by this task." -->

**Steps:**

1. From the repository root, run:
   ```bash
   node scripts/release.mjs
   ```
2. Follow the interactive prompts (target packages, new version, path to this task file so it
   gets deleted before the release commit).
3. **Manual follow-up:** update `project/implementation-status.md`'s freeze status table with
   the new version(s); mark packages `🧊 Frozen` if this closes an unfreeze window.

---

## Division of responsibility

<!-- Explicit statement of what THIS task owns vs what the sibling task(s) own, so the two don't
     duplicate or silently diverge. Example: "This task owns how pack.ts reads the compiler
     version; the sibling package-versioning task owns what that version number actually is and
     how it gets published." -->