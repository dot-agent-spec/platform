<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Review `apps/dot-agent-cli/AGENTS.md` After the Fossil Removals

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track E · closes the `apps/dot-agent-cli/` item of [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 |
| Depends on | [license-header-ci-enforcement.md](license-header-ci-enforcement.md) · [fossil-lockfiles-and-runtime-deps.md](fossil-lockfiles-and-runtime-deps.md) · [npm-publish-allowlists.md](npm-publish-allowlists.md) |

---

## Context

This folder is the exception among the four Track 3 folders: **two of the three steps are already done.**
`apps/dot-agent-cli/CLAUDE.md` exists and contains `@AGENTS.md`, and the file carries no links to archived
repositories. [Plan-002](../plans/002-dot-agent-as-claude-plugin.md) did that work when it passed through
here, and also removed the empty `templates/AGENTS.md` that Plan-001 Track 3 still lists as outstanding.
The file is now 83 lines, not the 115 that checklist records.

What remains is the **content review** — and here the review is not optional housekeeping, because three
other Plan-003 tasks are about to falsify what this file currently says. `apps/dot-agent-cli/AGENTS.md`
documents the hook defect accurately today:

```
line 15 | `.githooks/` | Present but never invoked — see below |
line 51 | **The license-header hook does not run, despite appearances.** …
line 54 | Apply headers by running `scripts/ensure-license-headers.sh` yourself…
```

Every one of those statements becomes false when
[license-header-ci-enforcement.md](license-header-ci-enforcement.md) lands: the `.githooks/` directory is
deleted, the `prepare` line goes, the script moves to the repository root, and enforcement becomes a CI
job. The file even anticipates this — line 77 lists *"the hook gets wired correctly"* as a trigger for
updating itself.

This is therefore a **documentation invariant that the other tasks break**, not a stale file that drifted
on its own. It must be updated in the same round, or the repository trades one accurate description of a
broken thing for an inaccurate description of a fixed one.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Rewrite the hook / license-header section to match the CI mechanism | apps/dot-agent-cli | S |
| 2 | P0 | Update the layout table row for the deleted `.githooks/` | apps/dot-agent-cli | XS |
| 3 | P1 | Review the remaining lines against the current package | apps/dot-agent-cli | S |
| 4 | P1 | Check whether packaging changes need documenting | apps/dot-agent-cli | XS |

---

## Work items

### 1. Rewrite the hook / license-header section — P0

**What:** Replace the paragraph at lines 51–54 describing the non-functioning hook with a description of
the CI check that replaces it.

**Why:** After [license-header-ci-enforcement.md](license-header-ci-enforcement.md), the paragraph
describes a mechanism that no longer exists, and instructs the reader to run a script at a path it no
longer occupies (`scripts/ensure-license-headers.sh` moves from `apps/dot-agent-cli/scripts/` to the
repository root).

**Change:** State the new mechanism: headers are enforced by a `pull_request` workflow, and a contributor
fixes a failure by running the root script locally. Keep it short and **link** the canonical detail rather
than restating it — the repo-wide license policy already lives in the root [`AGENTS.md`](../../AGENTS.md),
and duplicating it here is how the two drift.

Also revisit line 77's self-maintenance trigger list: *"the hook gets wired correctly"* is about to be
resolved, so that entry either goes or is replaced by whatever invariant is now load-bearing.

### 2. Update the layout table row for `.githooks/` — P0

**What:** Line 15 reads ``| `.githooks/` | Present but never invoked — see below |``. The directory is
deleted by the license task.

**Why:** A layout table listing a directory that does not exist sends a reader looking for it.

**Change:** Delete the row.

### 3. Review the remaining lines against the current package — P1

**What:** Read the other ~75 lines and verify each factual claim against the current source.

**Why:** The file predates the flatten. Per the root `AGENTS.md`, *"a fact hardcoded in an instruction
file rots silently, and a rotted file is worse than a missing one — it reads as authority."* Items 1 and 2
fix the parts this plan is knowingly breaking; this item catches what rotted on its own.

**Change:** Confirm or correct each claim. Worth checking specifically:

- The two `SKILL.md` copies mentioned in line 77's trigger list — are they still two, and still divergent?
- Build, test and run commands, from the monorepo root and from the package directory.
- Anything describing the MCP server surface, which
  [fossil-lockfiles-and-runtime-deps.md](fossil-lockfiles-and-runtime-deps.md) touches by raising
  `@modelcontextprotocol/sdk` to 1.30.0.
- Redundancy against the root `AGENTS.md` — delete rather than reformat.

### 4. Check whether packaging changes need documenting — P1

**What:** Determine whether `AGENTS.md` describes how this package is published, and update it if
[npm-publish-allowlists.md](npm-publish-allowlists.md) changed that.

**Why:** That task deletes `apps/dot-agent-cli/.npmignore` and replaces it with a `files` allowlist. A
grep of the current file finds no mention of either, so this may be a no-op — but confirm rather than
assume, because "what ships in the tarball" is exactly the kind of thing a contributor consults this file
for.

**Change:** If nothing documents packaging, add nothing. Do not invent a section to have one — the root
`AGENTS.md` budget rule applies here too.

---

## Implementation order

```
P0:  1 and 2 — must land in the same pull request as license-header-ci-enforcement,
     or immediately after it; they describe that change.
P1:  3 (general review) → 4 (packaging check)
```

This task is the **last** of the Plan-003 set to close. Items 1, 2 and 4 all document changes the other
tasks make, so running it first would document a state that does not yet exist.

## Acceptance

- No statement in `apps/dot-agent-cli/AGENTS.md` describes the git hook as the license mechanism.
- The `.githooks/` row is gone from the layout table, and no path in the file points at
  `apps/dot-agent-cli/scripts/ensure-license-headers.sh`.
- Line 77's self-maintenance trigger list contains no entry that has already been resolved.
- `apps/dot-agent-cli/CLAUDE.md` still exists and is unchanged — no action was needed there.
- The `apps/dot-agent-cli/` checkbox in [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 is
  ticked, and its line is corrected: the folder is 83 lines, not 115, and its `templates/AGENTS.md` was
  already removed.
