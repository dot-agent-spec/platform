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

### 4. `project/pre-release/AGENTS.md`, left behind — P1

**What:** `project/pre-release/` was emptied on 2026-08-13, but its `AGENTS.md` was not removed and
`v0.1/` still holds `DA01-02-compiler-behavior-consolidation.md`.

**Why:** `harness audit` lists that file as an **always-on guide**, 34 lines, describing the authoring
conventions of a folder that is being retired. A guide that loads and describes a folder nobody should
write into any more is worse than no guide.

**Change:** delete `project/pre-release/AGENTS.md` once `DA01-02` has its own destination — its decision
is pending (it carries ten architectural decisions with rationale and no ADR records them, so it is a
candidate for becoming one). Do not delete the folder while that file is still in it.

### 5. `project/rfcs/rejected/` and the `GOVERNANCE.md` contradiction — P1

**What:** create the folder, and fix the sentence that contradicts the rule.

**Why:** `.agents/rules/governance.md` and `AGENTS.md` both promise `rfcs/rejected/` and it does not
exist, so the repository's own rule dangles. Separately `GOVERNANCE.md` states a Rejected RFC moves to
`rfcs/implemented/`, which is the opposite folder and destroys the one distinction the two exist to make.

**Change:** create `project/rfcs/rejected/` with a `.gitkeep`; correct `GOVERNANCE.md` to `rfcs/rejected/`.
The rule wins over `GOVERNANCE.md` here because it is the operational surface that actually loads when
someone is working inside `project/`.

---

## Implementation order

```text
P0:  2, 3   — mechanical, no judgement, do first
P0:  1      — needs a decision per link
P1:  5      — independent
P1:  4      — blocked on DA01-02's destination
```

Item 1 last among the P0s because each link needs its intended target established, and two of its rows
are closed in another dossier rather than here. Item 4 last of all: it is the only one waiting on a
decision that is not this dossier's to make.

## Closing

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
