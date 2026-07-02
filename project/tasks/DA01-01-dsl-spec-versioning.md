<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Stamp DSL/spec version provenance into aboutme.json — DA01-01

| Field | Value |
|---|---|
| Status | In Progress — code landed, doc-sync checklist pending |
| Created | 2026-07-02 |
| Author | Danilo Borges |
| Version axis | DSL |
| Sources | [ROADMAP.md § Work to close v0.1](../../ROADMAP.md) (the "Stamp provenance into `aboutme.json`" bullet), [DA00-02: two-axis versioning](../adr/DA00-02-two-axis-versioning.md) |
| Depends on | none — can start independently |
| Sibling task(s) | [DA01-01-update-version-and-packages.md](DA01-01-update-version-and-packages.md) — that task owns package version numbers and the publish mechanism; this task owns how bundle provenance is *derived and stamped*, not what any package's number is |

---

## Context

The DSL/spec has never had a version of its own — only packages do, and inconsistently
(`implementation-status.md`'s freeze table). [DA00-02](../adr/DA00-02-two-axis-versioning.md) already
declares a **DSL version axis** independent of package semver (`v0.1`, `v0.2`, … `v1.0`), but nothing in
the repo actually holds that value as data, and nothing stamps it into a built bundle.

`ROADMAP.md` already names this exact gap as v0.1 close-out work: *"Stamp provenance into `aboutme.json`
— the real compiler version (today hardcoded `'dot-agent/1.0.0'`) and the DSL version the bundle
targets... Also source `schemaVersion` from a constant instead of a literal."*

Reading that literally suggested three separate `aboutme.json` fields (`compiler`, `schemaVersion`, a new
`dslVersion`). Discussed and rejected, now recorded in
[DA00-02](../adr/DA00-02-two-axis-versioning.md) § Provenance stamping: the DSL only exists to serve this
one bundle format — there is no consumer of `aboutme.json`'s structure independent of the language it
serializes. **`schemaVersion` is renamed to `dslVersion` and carries the DSL version**, the same way an
HTML document's DOCTYPE version coordinates both syntax and tooling at once — not two numbers that can
drift apart. So this task stamps exactly **two** provenance fields, not three:

- `aboutme.compiler` — the real version of whatever package built the bundle (today hardcoded
  `'dot-agent/1.0.0'`, duplicated in `packages/compiler/src/bundle.ts:79` and
  `packages/compiler/src/pack.ts:271` — two independent literals that already had room to drift).
- `aboutme.dslVersion` (renamed from `schemaVersion`) — the DSL version the bundle was authored against
  (today hardcoded `'dot-agent/1.0'` in `packages/compiler/src/manifest.ts:44`, under the old field
  name).

This is small now but load-bearing: `ROADMAP.md` § *Evolution after v1.0 — editions* depends on every
bundle honestly recording which language version it speaks, from v0.1 onward, or the editions escape
hatch has no foundation to stand on later.

## Version target(s)

| What | Current | Target | Source of truth |
|---|---|---|---|
| DSL/spec version | none (never recorded) | `0.1-alpha` (rehearsal) → `0.1` at real v0.1 publish | new file `dsl/VERSION` |
| `aboutme.dslVersion` (renamed from `schemaVersion`) | hardcoded literal `'dot-agent/1.0'` | `dot-agent/0.1-alpha`, read from `dsl/VERSION` | `packages/compiler/src/manifest.ts` |
| `aboutme.compiler` | hardcoded literal `'dot-agent/1.0.0'` (×2 call sites) | `dot-agent/<real @dot-agent/compiler version>` | `packages/compiler/package.json`, embedded at build time |

`dsl/VERSION` deliberately lives in `dsl/` (the spec-facing directory — `explanation/`, `reference/`,
`tutorials/`) rather than `project/` or the root `package.json`: it's the DSL's own manifest, the
language-axis counterpart to a package's `Cargo.toml`/`package.json`. Mirrors the rehearsal-then-real
relationship used for packages in the sibling task: `0.1-alpha` now, plain `0.1` once this is a real
public v0.1 release — same pairing as packages going `0.5.0-alpha.1` → `0.10.x`.

## Pre-Release Checklist (Manual Housekeeping)

- [x] **Documentation & Examples:** `dsl/README.md` mentions where the canonical DSL version lives
      (`dsl/VERSION`) so it's not a silent, undocumented file.
- [x] **RFC/DA & ADR Status:** the `dslVersion` naming call is recorded in
      [DA00-02](../adr/DA00-02-two-axis-versioning.md) § Provenance stamping.
- [x] **Provenance stamping:** grepped `packages/compiler/src` for the literals `'dot-agent/1.0'` and
      `'dot-agent/1.0.0'` after the fix landed — zero hits remain outside `generated-version.ts` and the
      pre-existing example `.agent/aboutme.json` fixtures under `examples/`/`dogfood/` (built artifacts,
      not source — regenerate by re-running `pack` if they need to match, out of scope here).
- [ ] **`/sync-implementation-status`:** run it; confirm the "Hardcoded values in `compiler/pack.ts`"
      table (currently `implementation-status.md` lines ~176–186) drops the `aboutme.compiler` and
      `aboutme.schemaVersion` rows (or updates them from 📌 to ✅).
- [ ] **Task Cleanup:** once `/sync-implementation-status` confirms the doc is current, delete this task
      file.
- [x] **Workspace & Submodules:** n/a — lands independently of the sibling package rehearsal.

---

## Work items

### 1. Create `dsl/VERSION` — P0

**What:** New file `dsl/VERSION` containing the bare string `0.1-alpha` (no `dot-agent/` prefix, no
trailing newline concerns — a single-line version string, same shape as reading a `Cargo.toml` `version`
field).

**Why:** Gives the DSL axis in DA00-02 an actual, single, machine-readable source of truth. Everything
else in this task reads from this file instead of embedding a new literal.

**Change:** New file, `dsl/VERSION`.

### 2. Rename `schemaVersion` to `dslVersion` — P0

**What:** Rename the field in `aboutme.json` per [DA00-02](../adr/DA00-02-two-axis-versioning.md) §
Provenance stamping. The old name read as "version of the JSON envelope format," which is exactly the
three-field confusion this task started from; `dslVersion` is self-documenting and forecloses the split
from recurring later. Cost is a one-line breaking change to the (not yet public) bundle schema — free
now, not free after v1.0.

**Why:** Every downstream reader (`sdk`, docs, future editions mechanism) needs to agree on the field
name once, before any bundle carrying the old name ships publicly.

**Change:** `packages/compiler/src/types.ts` (the `AboutMe` type's field name), `packages/compiler/src/manifest.ts`
(read/write), any sdk type re-exports of `AboutMe`.

### 3. Consolidate and fix `aboutme.compiler` — P0

**What:** Remove the two independent `'dot-agent/1.0.0'` literals (`bundle.ts:79`, `pack.ts:271`) and
replace both with one import from a generated constant (Work item 4) that resolves to the real
`@dot-agent/compiler` package version at build time.

**Why:** Two hand-maintained copies of the same literal is how they drifted from "matches reality" in
the first place; a single generated source removes the duplication entirely, not just the hardcoding.

**Change:** `packages/compiler/src/bundle.ts`, `packages/compiler/src/pack.ts`.

### 4. Build-time constant embedding (not runtime file reads) — P0

**What:** A small prebuild step (npm `prebuild`/`pretsup` script) in `packages/compiler` that reads
`dsl/VERSION` and `packages/compiler/package.json`'s own `version`, and writes a generated
`packages/compiler/src/generated-version.ts` exporting both as string constants. `manifest.ts`,
`bundle.ts`, and `pack.ts` import from there instead of touching the filesystem at runtime.

**Why:** `dsl/VERSION` lives two directories above `packages/compiler` in the monorepo. That relative
path does not exist inside the published npm tarball — a runtime `fs.readFileSync('../../dsl/VERSION')`
would work in the monorepo and silently break (or throw) once `@dot-agent/compiler` is actually
installed as a dependency elsewhere. Baking the value in at build time avoids shipping a package that
only works from inside its own source tree. This mirrors the pattern `tree-sitter`/`parser-dsl` already
use for `NODE_TYPES_BEHAVIOR` (embedded via `build.rs` at compile time, not read at runtime) —
same problem, TS-side equivalent.

**Change:** New script `packages/compiler/scripts/embed-version.mjs`, `prebuild`/`pretypecheck`/`pretest`
entries in `packages/compiler/package.json`, new generated file `packages/compiler/src/generated-version.ts`
(checked into git like a lockfile — not git-ignored, since wiring every npm lifecycle script that could
touch this file, in every consumer, is more fragile than just committing the small derived value and
regenerating it on demand).

---

## Implementation order

```
P0:  1 (create dsl/VERSION)
     2 (naming decision) — blocks 3, since the field name must be settled before writing to it
     4 (build-time embedding script) — can run in parallel with 1, 2
     3 (fix aboutme.compiler + apply naming decision) — needs 1, 2, and 4 done first
```

This task has no P1/P2 — it's small and self-contained by design. It can land independently of the
sibling package-rehearsal task, but for the rehearsal bundle (`0.5.0-alpha.1`) to actually carry correct
provenance, this task should land **before** or **alongside** that rehearsal run — otherwise the
rehearsal `.agent` bundles still stamp the old hardcoded `1.0.0`/`1.0` literals, defeating the point of
rehearsing "does provenance stamping work end to end."

## Division of responsibility

This task owns **how** `pack.ts`/`bundle.ts`/`manifest.ts` derive and stamp provenance values, and where
the DSL version's source of truth lives (`dsl/VERSION`). It does **not** own what any package's version
number is or how packages get published — that's
[DA01-01-update-version-and-packages.md](DA01-01-update-version-and-packages.md) in full. The only
coupling point: that sibling task's rehearsal bump (item 8 there) determines the real
`@dot-agent/compiler` version this task's build-time script will embed — so re-run the embedding step
(item 4 here) after any package version bump, not just once.