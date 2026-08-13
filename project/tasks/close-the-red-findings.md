# Task: Close the findings the gate would otherwise be handed over red with

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | — (no tracking issue; the design record is Plan-001 Track 5) |
| Sources | [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 5 |

---

## Context

A gate handed over red is the one people switch off within the week, and the first thing anyone does with
a red gate they did not cause is `--no-verify` — which switches off every other check at the same time.
So the findings that would be live on the day the CLI gate lands are closed here, in a dossier of their
own, because this work is editing documents and
[`vibe-ops-cli-gate.md`](vibe-ops-cli-gate.md) is wiring. Mixing the two is how a wiring change gets
reviewed as a document change.

**The numbers in Plan-001 Track 5 are stale and are corrected here.** They were taken before
`project/pre-release/` was retired on 2026-08-13, and re-running the audit afterwards gives a different
picture in three ways:

- **`links` reports 37, not 35 — and it is a different detector.** The `35` came from the shell `links`
  fragment; `37` is the `markdown-link` gate. Two implementations over possibly different populations, so
  these are not the same set that drifted by two. Do not reconcile them; measure with the gate.
- **The in-scope share is far larger than the "two links" Track 5 names.** The single largest source is
  `project/plans/002-dot-agent-as-claude-plugin.md`, with nine.
- **`record-header-task` is 5, not 2.** Every dossier fails it, and the cause is upstream of all five:
  **`project/templates/task.md` has no `Issue` row**, so every task written from it is born failing.
  Fixing the five without fixing the template regenerates the failure on the next task — the template is
  Track 7's, and this dossier only fixes the instances.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | In-scope `links`, by location, largest first | project/, packages/, plugins/ | M |
| 2 | P0 | Five `record-header-task` headers missing `Issue` | project/tasks | XS |
| 3 | P0 | One malformed `breadcrumb` | project/plans | XS |
| 4 | P1 | `project/rfcs/rejected/` and the `GOVERNANCE.md` contradiction | project/ | S |

---

## Work items

### 1. In-scope `links` — P0

**What:** the `markdown-link` findings under paths the gate covers.

**Why:** the ones that stay are declared as an excluded population in `vibeops.config.ts`, and an
exclusion is only honest if what remains is actually clean.

**Change:** current distribution, in-scope rows first:

| Location | Count | Note |
|---|---|---|
| `project/plans/002-dot-agent-as-claude-plugin.md` | 9 | largest single source; a plan file, inside `project/` |
| `project/tasks/*` | 4 | `DA01-01-dsl-spec-versioning` (2), `pre-public-consolidation` (1), `DA01-01-compiler-work` (1) |
| `project/implementation-status.md` | 2 | generated from `sync-implementation-status`; check whether the generator emits the bad link before editing the output |
| `plugins/claude/AGENTS.md` | 2 | also [`per-package-agents-md.md`](per-package-agents-md.md) item 2 — close it there, not twice |
| `packages/kernel-dsl/AGENTS.md` | 1 | also that dossier's item 1 — same |

Out of scope, and declared as such in the config rather than fixed: `dsl/README.md` + `dsl/reference/types.md`
(8), `docs/explanation/*` (4), `dogfood/new-adr/…` (2, write-once by rule).

### 2. Five task headers missing `Issue` — P0

**What:** add the `Issue` row to `DA01-01-compiler-work.md`, `DA01-01-dsl-spec-versioning.md`,
`antigravity-cli-plugin.md`, `compiler-api.md`, `pre-public-consolidation.md`.

**Change:** the schema requires `Status`, `Created`, `Author`, `Issue`. Where a dossier has no tracking
issue, say so explicitly rather than leaving the row out — the three dossiers created on 2026-08-13 use
`— (no tracking issue; the design record is …)`, and matching them keeps one convention.

### 3. One malformed `breadcrumb` — P0

**What:** `project/plans/002-dot-agent-as-claude-plugin.md:467` carries
`git show 68ac4db:project/tasks/DA00-07-dot-agent-claude-skill.md`.

**Why:** the gate requires a **full 40-character sha** so it can verify the object still exists. An
abbreviated one cannot be checked, and a breadcrumb nobody can verify is the failure mode the shape
exists to prevent.

**Change:** resolve `68ac4db` to its full sha and confirm the path existed at that commit. If the object
is gone — a rewritten history — say so in the line rather than pointing at nothing.

### 4. `project/rfcs/rejected/` and the `GOVERNANCE.md` contradiction — P1

**What:** create the folder, and fix the sentence that contradicts the rule.

**Why:** `.agents/rules/governance.md` and `AGENTS.md` both promise `rfcs/rejected/` and it does not
exist, so the repository's own rule dangles. Separately `GOVERNANCE.md` states a Rejected RFC moves to
`rfcs/implemented/`, which is the opposite folder and destroys the one distinction the two exist to make.

**Change:** create `project/rfcs/rejected/` with a `.gitkeep`; correct `GOVERNANCE.md` to `rfcs/rejected/`.
The rule wins over `GOVERNANCE.md` here because it is the operational surface that actually loads when
someone is working inside `project/`.

---

## Implementation order

```
P0:  2, 3   — mechanical, no judgement, do first
P0:  1      — needs a decision per link
P1:  4      — independent
```

Item 1 last among the P0s because each link needs its intended target established, and two of its rows
are closed in another dossier rather than here.

## Closing

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
