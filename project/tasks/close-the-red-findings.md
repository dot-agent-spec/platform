---
vibe-ops-template: task@3
---

# Task: Close the findings the gate would otherwise be handed over red with

| Field | Value |
|---|---|
| Status | Done — all five items closed 2026-08-14 |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | — (no tracking issue; the design record is Plan-001 Track 5) |
| Plan | [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 5 |
| Sources | [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 5 |

---

## Context

A gate handed over red is the one people switch off within the week, and the first thing anyone does with
a red gate they did not cause is `--no-verify` — which switches off every other check at the same time.
So the findings that would be live on the day the CLI gate lands are closed here, in a dossier of their
own, because this work is editing documents and
the CLI gate dossier (closed —
`git show 42ec13d03dd083f40b3e83916bdca51daef298c6:project/tasks/vibe-ops-cli-gate.md`) is wiring. Mixing
the two is how a wiring change gets reviewed as a document change.

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
  This dossier fixes the five instances only. **The template fix is no longer hand work** — `harness sync`
  writes the canonical `task.md`, which carries the row, and that is Track 7. Doing the instances here
  and the template there is the right split, but the two are not independent: fixing the instances while
  the template still lacks the row means the sixth task regenerates the failure, so **Track 7 should not
  be left indefinitely after this dossier closes**.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | In-scope `links`, by location, largest first | project/, packages/, plugins/ | M |
| 2 | P0 | Five `record-header-task` headers missing `Issue` | project/tasks | XS |
| 3 | P0 | One malformed `breadcrumb` | project/plans | XS |
| 4 | P1 | `project/pre-release/AGENTS.md`, an always-on guide for a retired folder | project/ | XS |
| 5 | P1 | `project/rfcs/rejected/` and the `GOVERNANCE.md` contradiction | project/ | S |

---

## Work items

### 1. In-scope `links` — P0 — **done 2026-08-14, and not one of them was closed here**

Every in-scope row was carried off by the work that owned it. `plugins/claude/AGENTS.md` (2) and
`packages/kernel-dsl/AGENTS.md` (1) went with the per-package dossier, as this table said they should;
`project/tasks/*` (4) went with `pre-public-consolidation.md`'s deletion and the two closures; the nine in
`project/plans/002` and the two in `implementation-status.md` went with the repointing those passes owed.

Verified rather than assumed, because "someone else fixed it" is exactly the claim that should not be
taken on trust: `governance --audit --json` reports `markdown-link` as **132 files examined, 48 ignored,
zero findings**, and a run scoped to `project/plans/002-dot-agent-as-claude-plugin.md` alone reports it as
examined — not ignored — and clean. The 48 ignored are the declared `dsl/`, `docs/` and `dogfood/`
exclusions, which is what makes the remaining zero honest.

**The same audit turned up a finding this item did not go looking for**, and it is the reason to read a
structured report rather than a summary line. All six `template-version` gates SKIP, each saying *no
`templates/<type>.md`*, over a repository holding five stamped templates in `project/templates/` and
naming all five in `vibeops.config.ts`. One literal in the ops composition, `<plugin>/templates/adr.md`,
resolves to the root in a repository that is not a plugin. Recorded in Plan-001's open questions; it is
upstream's, not this dossier's.

**What it was:** the `markdown-link` findings under paths the gate covers.

**Why:** the ones that stay are declared as an excluded population in `vibeops.config.ts`, and an
exclusion is only honest if what remains is actually clean.

**Change:** current distribution, in-scope rows first:

| Location | Count | Note |
|---|---|---|
| `project/plans/002-dot-agent-as-claude-plugin.md` | 9 | largest single source; a plan file, inside `project/` |
| `project/tasks/*` | 4 | `DA01-01-dsl-spec-versioning` (2), `pre-public-consolidation` (1), `DA01-01-compiler-work` (1) |
| `project/implementation-status.md` | 2 | generated from `sync-implementation-status`; check whether the generator emits the bad link before editing the output |
| `plugins/claude/AGENTS.md` | 2 | also item 2 of the per-package AGENTS.md dossier (closed — `git show 42ec13d03dd083f40b3e83916bdca51daef298c6:project/tasks/per-package-agents-md.md`) — close it there, not twice |
| `packages/kernel-dsl/AGENTS.md` | 1 | also that dossier's item 1 — same |

Out of scope, and declared as such in the config rather than fixed: `dsl/README.md` + `dsl/reference/types.md`
(8), `docs/explanation/*` (4), `dogfood/new-adr/…` (2, write-once by rule).

### 2. Five task headers missing `Issue` — P0

**Done 2026-08-13, and one of the five was not a header fix.** Four received the row, using the
`— (no tracking issue; the design record is …)` form the dossiers created that day already used, so there
is one convention rather than two.

**The fifth was `pre-public-consolidation.md`, and it was deleted instead.** Status `Done ✅`, `Closed
2026-06-27`, every one of its fourteen items ticked with the DA decision that settled it — a dossier whose
lifecycle says `Done → file removed` and which had simply never been removed. Stamping an `Issue` row onto
it would have been maintenance on a file that should not exist. Recoverable:
`git show a708a8b6308598cd36e0863ae7cb8309932d7a9f:project/tasks/pre-public-consolidation.md`

That deletion closed three findings at once — its own `record-header-task`, its broken link to the
retired compliance report, and the stale dossier — and **opened three more**, which is the part worth
recording: `ROADMAP.md` and `project/adr/DA00-02` linked to it, and those links died with it. They now
carry the breadcrumb instead. Deleting a record is never only a deletion; whatever pointed at it has to
be paid for in the same pass, or the next run reports the debt as if it were new.

### 3. One malformed `breadcrumb` — P0

**Done 2026-08-13.** `project/plans/002-dot-agent-as-claude-plugin.md` carried an abbreviated sha, which
the gate cannot verify — a breadcrumb nobody can check is the failure mode the shape exists to prevent.
`68ac4db` resolved to `68ac4db4270fa9fb31f21cbe2c1b71b28c0edef3` and `git cat-file -e` confirmed the path
existed at that commit, so it was only ever an abbreviation, never a dead reference. Expanded in place.

**A trap this exposed, worth knowing before writing about breadcrumbs.** The paragraph you are reading was
itself reported as a finding while it quoted the malformed form, inside backticks. `breadcrumb` reads raw
text where `memory-slug` reads the masked document model, so an inline code span does not protect a quoted
example. It is the same false-positive class already fixed once, in the other gate. Until it is fixed
here, a document cannot describe a broken breadcrumb without becoming one.

### 4. `project/pre-release/AGENTS.md`, left behind — P1 — **done 2026-08-14: the whole folder is gone**

**What it was:** `project/pre-release/` was emptied on 2026-08-13, but its `AGENTS.md` survived and `v0.1/`
still held `DA01-02-compiler-behavior-consolidation.md`. `harness audit` listed that `AGENTS.md` as an
always-on guide, 34 lines, describing the authoring conventions of a folder being retired — worse than no
guide, because it loads.

**DA01-02 was not made into an ADR, and that was the decision blocking this item.** Read against the
current tree, almost all of it is already documented, in a *more* current form: `pipeline.md` carries the
description discovery, the behavior resolution, the consolidation algorithm and the bundle structure with
eight pack steps and `E018`/`W015`/`W016`, none of which existed when the log was written; `lint-codes.md`
carries `E012`–`E017` and `W014`, correctly marking `E012`–`E014` as thrown rather than emitted, which the
log got wrong. Ten decisions in one document is not one ADR's shape, and nine of them had become simply how
the compiler works.

What was genuinely missing was its **§3.5 security model** — verified by search: `symlink` appeared nowhere
under `docs/`, `dsl/` or `packages/*/docs`, and neither did the threat table. `E014` was documented in
three places as a rule with no reason attached. That, the reason `init` resolves by name rather than by
position, and why the kernel still carries `flatten_merges`, moved into `pipeline.md`,
`dsl/reference/behavior.md` and `dsl/reference/description.md`. The rest is implementation history the code
now answers, so the log was deleted with the folder.

The original is recoverable:
`git show 2f18d916758c6a56d2401a12684550ec241438bc:project/pre-release/v0.1/DA01-02-compiler-behavior-consolidation.md`

### 5. `project/rfcs/rejected/` and the `GOVERNANCE.md` contradiction — P1

**Done 2026-08-13.** `project/rfcs/rejected/` exists, with a `.gitkeep` — it needed `git add -f`, since
this repository's `.gitignore` would otherwise swallow it. `GOVERNANCE.md` said a Rejected RFC moves to
`rfcs/implemented/`, the opposite folder, which destroys the one distinction the two exist to make. The
rule won because it is the operational surface that loads when someone works inside `project/`.

Fixing the line improved the diagram past what was asked. It read:

```text
Draft → Review → Accepted → Implemented
              ↘ Rejected      (→ moved to project/rfcs/implemented/, frozen)
```

The destination annotation hung off `Rejected` and named `implemented/` — so the *only* terminal state
carrying a destination was the one carrying the wrong one, and `Implemented` had none at all. Both now
state their own. The three sources agree: `GOVERNANCE.md`, `.agents/rules/governance.md`, and the tree
diagram in `AGENTS.md`, which promised both folders and is now true on disk.

---

## Implementation order

- [x] P0 — item 2, the five `record-header-task` headers (2026-08-13)
- [x] P0 — item 3, the malformed `breadcrumb` (2026-08-13)
- [x] P1 — item 5, `project/rfcs/rejected/` and the `GOVERNANCE.md` contradiction (2026-08-13)
- [x] P1 — item 4, `project/pre-release/` retired entirely (2026-08-14)
- [x] P0 — item 1, the in-scope `links`, verified at zero (2026-08-14)

Item 1 was last among the P0s because each link needed its intended target established, and two of its
rows were closed in another dossier rather than here. Item 4 was last of all, being the only one waiting
on a decision that was not this dossier's to make.

## Surprises & Discoveries

- Observation: not one of item 1's links was closed by this dossier, and the item still needed a
  verification pass rather than a tick.
  Evidence: every in-scope row was carried off by the work that owned it — the per-package dossier, the
  `pre-public-consolidation.md` deletion, the two closures and their repointing. "Someone else fixed it"
  is the claim least safe to take on trust, so it was measured: `markdown-link` reports 132 examined, 48
  ignored, zero findings, and `project/plans/002` reports as examined rather than ignored.

- Observation: a summary line cannot distinguish a gate that examined its population from one addressed at
  a path the repository does not use, and this repository has now paid for that twice.
  Evidence: `governance --audit --json` shows all six `template-version` gates skipping with *no
  `templates/<type>.md`*, over five stamped templates in `project/templates/` that `vibeops.config.ts`
  names explicitly. The cause is the literal `<plugin>/templates/adr.md` in the ops composition, which in
  a non-plugin repository resolves to the root. The first instance was `skill-frontmatter` reporting *no
  `skills/` directory* while two skills sat in `.agents/skills/`.
  **Carried to Plan-001's open questions**, which is where the upstream half of this already lives.

- Observation: deleting a record is never only a deletion, and the cost lands on documents that never
  mentioned the record by name.
  Evidence: removing `project/pre-release/` broke a link in an accepted ADR, left a stale row in the root
  `AGENTS.md` layout tree, and left `ROADMAP.md` pointing readers at the folder **inside a code span** —
  invisible to the `markdown-link` gate, which reads links. Only the ADR was caught mechanically.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.

Brought from this repository's pre-promulgation `task.md` to `task@3` by hand on 2026-08-14, not by
`/vibe-ops:migrate`: the local template was a divergence rather than an older version, so no note in the
chain renames `## Closing` to `## Closure` or adds `## Surprises & Discoveries`.
