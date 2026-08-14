---
vibe-ops-template: plan@3
---

# Plan-001: Adopt the vibe-ops Governance Baseline

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-30 |
| Author | Danilo Borges |
| Related | [DA00-01](../adr/DA00-01-traceability-scheme.md) (the DA numbering scheme this plan preserves) |

---

## Summary

`vibe-ops` is a public Claude Code plugin (<https://github.com/entelekheia-ai/vibe-ops>) that defines a
standard shape for a repository's governance: a `project/` folder holding ADRs, RFCs, plans and tasks; a
path-scoped rule carrying their lifecycles; a `.agents/` ↔ `.claude/` symlink bridge so one canonical file
serves every agent framework; and a validator that reports mechanical drift against that shape. This plan
brings `dot-agent-spec` onto that baseline **without flattening the conventions this repository chose
deliberately** — the DA decision-numbering scheme and the plural `rfcs/` folder stay exactly as they are.
The work is split so that each phase leaves the repository consistent on its own, because some phases are
opportunistic and may never finish as one piece of work.

**One `adopt` decision was reversed on 2026-08-13: `project/pre-release/v<minor>/`.** It was kept as this
repository's long-form log, and the cost of that turned out to be unpayable — the log location is the one
record type `vibe-ops` cannot be told about. `RecordType` has four members and `log` is not one, so
`records.dirs` cannot name it; `CANDIDATE_LOG_DIRS` is a separate hardcoded list (`project/log`, `log`)
with no config override; and `/vibe-ops:new-log` writes to `project/log/` in its frontmatter, its
description and its body. That left every closure ceremony here — `close-plan`, `close-task`,
`/route-learnings` — routing to a destination that did not exist. `project/log/` now does exist, and the
nine documents under `pre-release/` were routed out of it rather than moved wholesale; the reasoning per
document is in the Decision Log.

**The validator is no longer a shell script.** Tracks 1–3 were executed against
`scripts/check-agents-md.sh`, a shell runner reached through a three-branch resolution in
`scripts/checks/_run.sh`. That runner has since moved inside `vibe-ops` and the resolution now finds
nothing, so the commit gate here has been dead — loudly, exiting 2 on every attempt — since it moved.
Track 4 replaces the whole mechanism with the `vibe-ops` CLI and a `vibeops.config.ts`, invoked from
`PATH`. That is the repair and the removal of the resolution problem at once: what broke was a *path* that
moved, and a binary found on `PATH` has no path here to break, nor a snapshot to age.

## Goals

1. Every governance lifecycle in this repository is stated once, on a surface that actually loads when
   someone is working inside `project/` — not in a nested `AGENTS.md` that no agent reads.
2. Governance records are scaffolded by tooling that reads *this* repository's templates and numbering,
   with no forked copy of that tooling living inside this repository.
3. `project/plans/` exists as a home for multi-phase work whose design record must outlive the work — the
   gap that made this plan itself impossible to file before today.
4. The root `AGENTS.md` is at or under the 150-line budget the validator enforces, with everything cut
   from it relocated to a surface that loads, not deleted.
5. Running the `vibe-ops` gate against this repository reports no failure, and no skip, that is not a
   deliberate divergence recorded in `vibeops.config.ts` with its reason. Restated 2026-08-13: the goal
   originally named `scripts/check-agents-md.sh`, which no longer exists, and said nothing about skips —
   and a silent skip is how this repository went for months with `skill-frontmatter` never examining the
   two skills it has.

## Scope

### In scope

The governance surfaces (`project/`, `GOVERNANCE.md`, `.agents/rules/`, `.claude/` bridge), the root
`AGENTS.md`, and the per-package `AGENTS.md` files under `packages/` and `apps/`. Fixing document links
that broke when this repository moved its governance folders under `project/`, since that migration is
the direct cause of the drift this plan reconciles.

Added 2026-08-13, with Track 4: the **mechanism** by which the validator runs here — the commit gate, its
runner resolution, and the declaration file that replaces both. In scope because the gate this plan
installed no longer runs at all, which makes every prose invariant Tracks 1–3 established unenforced
again. Also in scope from that date: the pre-existing findings the gate had to declare disabled in order
to be handed over green, since a declared disablement is a debt this plan opened and therefore owes.

### Out of scope

- **Renaming anything to match the vibe-ops default.** `rfcs/` does not become `rfc/` and DA numbering
  does not become plain `NNNN`. These are `adopt` decisions, recorded in the Decision Log below.
  `pre-release/` was on this list until 2026-08-13 and is not any more — see the Summary.
- **Installing the validator into CI.** Still out of scope, but the *reason* changed on 2026-08-13. It was
  "the snapshot copy ages out of sync with the plugin" — an argument Track 4 dissolves, since a
  devDependency has no snapshot to age. What remains is only that this repository has no non-publishing CI
  workflow to add a job to, which is a smaller and separate decision.
- **`docs/` and `dsl/` link rot.** Roughly 25 broken links live there. They are real but unrelated to
  governance; they belong to whoever next edits those trees.

`docs/` and `dsl/`, together with the now-retired `project/pre-release/v0.1/`, are what forced the `links`
check to be declared off wholesale when the gate was installed. Track 5 does **not** change that judgement
for the two that remain — it changes how the exclusion is expressed, from one blanket disablement covering
35 findings to a declared population exclusion naming those trees and their reasons. The distinction
matters: a disabled check reports nothing about anything, so a *new* broken link under `project/` would
have been invisible; an excluded population still reads everything else.

Retiring `pre-release/` shrank that debt without anyone aiming at it. Fourteen of the 35 lived in
documents that have now left the tree, and twelve more were in `DA01-01`, which moved into
`project/rfcs/` — a folder the gate *does* cover, so they had to be repointed rather than inherited. They
were, and their targets verified.

## Design

The baseline is applied through four mechanisms, in the order of the enforcement ladder that `vibe-ops`
documents in its `references/instruction-surfaces.md`: a hook or CI check beats a path-scoped rule, which
beats an always-on instruction, which beats a skill. Moving a fact *up* that ladder is the only thing that
raises compliance; moving it sideways changes nothing.

**One path-scoped governance rule.** `.agents/rules/governance.md` carries `paths: ["project/**"]` in its
frontmatter, so it enters context exactly when a file under `project/` is being worked on and costs
nothing otherwise. It holds the DA scheme, the four lifecycles, and which command closes which record. It
replaces `project/adr/AGENTS.md` and `project/tasks/AGENTS.md`, both deleted: a nested `AGENTS.md` with no
sibling `CLAUDE.md` and no `@`-import never enters context on its own, so the lifecycle rules they held
were unreachable in practice. `project/rfcs/AGENTS.md` survives, reduced to the package-impact table —
authoring detail a writer looks up on purpose, which is the one job a nested file still does honestly.

**The same move for `dogfood/`.** `dogfood/` holds dated, write-once snapshots of how the dot-agent DSL
felt to author at one moment; its governing instruction is a guardrail — *never cite a `dogfood/*` file as
current behavior* — and it lived in `dogfood/AGENTS.md`, which nothing loaded. A guardrail read only by
someone who already opened the folder arrives after the mistake. It is now
`.agents/rules/dogfood.md` with `paths: ["dogfood/**"]`.

**No forked tooling.** Records are opened and closed with the plugin's own commands
(`/vibe-ops:new-adr`, `new-rfc`, `new-plan`, `new-task`, `close-plan`, `close-task`). Those commands
discover the target repository's own template folder and numbering authority rather than hardcoding
either, so this repository keeps owning its conventions while the procedure lives in one place and is
maintained once. `.agents/skills/` is reserved for what exists nowhere else: `/publish` (the npm release
runbook for `@dot-agent/*`) and `/sync-implementation-status`.

**A budget treated as correctness, not tidiness.** The root `AGENTS.md` is delivered to the model as a
single block behind a relevance gate that applies to the block as a whole, so every non-universal line in
it raises the chance the universal ones are discounted along with it. That is why 150 lines is a
correctness target and why Track 2 relocates rather than deletes.

## Tracks

- [x] **Track 1 — Governance surfaces.** The rule-based governance layer, and the retirement of what it
      replaced. Completed 2026-07-30.
- [x] **Track 2 — The root `AGENTS.md` budget.** 233 → 150 lines by relocation only. Completed
      2026-07-30, and **since regressed to 174** — see Track 6.
- [x] **Track 3 — Per-package `AGENTS.md`.** Completed 2026-08-13. Three rebuilt against the disk,
      `plugins/claude` declared a pairing exception rather than given a sibling, `packages/sdk` decided
      against, `dogfood/mentor-agent` deleted.
- [x] **Track 4 — The gate becomes the `vibe-ops` CLI.** Completed 2026-08-13.
- [ ] **Track 8 — The rename that never reached the docs.** Opened 2026-08-13 by Track 3's review, and
      the only work it uncovered that it did not also close. `intent_trigger` and `oriented_state_body`
      are node names the grammar dropped — the first in the DA01-01 rename, the second when RFC-0022
      flattened `state_body`. The code moved; the documents did not. `intent_trigger` survives in
      `packages/parser-dsl`'s `README.md` and `docs/reference/api.md`; `oriented_state_body` in
      `packages/tree-sitter/AGENTS.md`, `project/implementation-status.md` and its generated `.html`, and
      **`.agents/skills/sync-implementation-status/SKILL.md`**. The skill is the one that matters: an
      `AGENTS.md` with no sibling never loads, which is why the rest went unnoticed, but a skill loads and
      runs. Decide first whether this wants a guard rather than a repair — the root `AGENTS.md` already
      records this same skill mis-mapping on a stale node-name table once, and a second occurrence of one
      failure is the argument the third repair will not settle it.
- [x] **Track 5 — Close the findings the gate was handed over red with.** Opened 2026-08-13, closed
      2026-08-14. Five items, and the last one to fall was the only one waiting on a decision that was not
      the dossier's to make: `DA01-02` does not become an ADR, so `project/pre-release/` is gone entirely.
      Item 1 closed without this track touching a single link — every one was carried off by the work that
      owned it — which made verification the whole job rather than a formality.
- [ ] **Track 6 — The `AGENTS.md` budget, again.** Added 2026-08-13. Track 2's own retrospective predicted
      this: it landed at exactly 150 of 150 and named the next addition as the risk. Run
      `/vibe-ops:authoring-agents-md` rather than repeating the relocation by hand — the 2026-08-13 audit
      declared the file's authoring quality unchecked, and that is the gap a hand pass leaves open again.
- [ ] **Track 7 — Records and templates carry a version.** Added 2026-08-13, reshaped the same day once
      `vibe-ops harness` shipped, and **half executed 2026-08-14**: the five templates are promulgated
      with this repository's four `adopt` customisations re-applied on top, and thirty-two of the forty
      records are stamped. Eight remain and none is a stamping job — plans 002 and 003 are genuinely
      `plan@0.1` and their migration routes each `Surprises & Discoveries` entry through the promotion
      test, plan 004 is an RFC wearing a plan filename, and the five live task dossiers are local
      divergences no migration note can reach. Step 4 stays untaken until they are done.
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, living docs
      propagated. The plan file itself is kept.

### Track 1 — Governance surfaces

Establish the rule-based governance layer and retire what it replaces, so that the lifecycles, the
numbering scheme and the closing procedure each have exactly one home. At the end of this track
`project/plans/` exists with a template, `GOVERNANCE.md` describes four document types instead of three,
two nested `AGENTS.md` files are gone, and the two rotted local scaffolding skills are gone. Acceptance is
the validator's `bridge` check green and the `/vibe-ops:new-plan` discovery sequence resolving
`project/plans` and `project/templates/plan.md` without being told where they are.

### Track 2 — The root `AGENTS.md` budget

Bring `AGENTS.md` from 233 lines to at most 150 by routing each over-budget section to the surface its
content actually belongs on, per the routing table in the plugin's `references/instruction-surfaces.md`.
This is not a compression pass: nothing is summarised away, everything moves. The review that identified
the targets is recorded under *Surprises & Discoveries* below so the track can be executed without
re-deriving it. Acceptance is the validator's `budget` check green with no fact lost — each relocated
section reachable from where it now lives.

### Track 3 — Per-package `AGENTS.md`, opportunistically

Eight packages, apps and plugins carry an `AGENTS.md`, together about 980 lines, and **not one of them has
a sibling `CLAUDE.md`** — so none of that guidance ever enters context. That is the same defect Track 1
fixed inside `project/`, at four times the volume. Several also link to standalone GitHub repositories
that were archived when this monorepo was flattened ([DA00-05](../adr/DA00-05-monorepo-flatten.md)); the
canonical code is under `packages/` now, so those links send a reader to a dead tree.

The fix per folder is three steps, in this order:

1. **Review the content** against what the package actually does today — the stale parts are invisible
   until someone who is already in that code reads them.
2. **Repoint or delete the dead links**, in both `AGENTS.md` and the package `README.md`.
3. **Add a one-line `CLAUDE.md` containing `@AGENTS.md`** so the file finally loads when work happens in
   that directory.

The order is load-bearing and the reason this track is not a single mechanical sweep: step 3 alone is a
one-line change per folder, but doing it first would start *delivering* stale guidance into context that
is currently only sitting inert on disk. A wrong instruction nothing reads is a smaller problem than a
wrong instruction that loads. So each folder is completed the next time work touches it, by whoever is
already in that code. This track has no completion date and closes incrementally.

**A plan that touches one of these folders should pull its checklist item in and close it there** rather
than leaving it for a later sweep that never comes.

**Pulled forward 2026-08-13.** The remaining six folders are finished alongside Track 4 rather than
waiting for work to arrive in each. What changed is the cost of leaving them: Track 4 makes
`no-sibling-claude-md` a gate finding, so six known-failing folders would have to be declared disabled to
hand the gate over green — and a disablement that exists because nobody got round to a one-line file is
the kind that never gets lifted. The three-step order above is **not** relaxed by that: step 3 alone would
start delivering stale guidance into context, which is the whole reason this track was written as
review-first.

**Closed 2026-08-13.** Six folders, and the review-first order earned itself twice — the recipe's third
step would have been wrong in both cases, and only reading first caught it.

`plugins/claude` **must not have a `CLAUDE.md`**: the folder is a Claude Code plugin, copied byte for byte
into every user's cache, so the file would have shipped to every install while never loading. Declared as a
`pairing` exclusion in `vibeops.config.ts` instead — which also had to be done *before* the next write,
because the authoring skill's hook created the file automatically and a hook repairing a finding cannot
know which findings a repository has declared out of scope.

`packages/sdk` gets no file at all. Every fact that could have earned one already had a better home, the
call-order contract included — the README states it in a numbered quick start with **before** bolded
twice. Writing one would have produced this track's own defect: a nested file restating a README, never
loading, drifting on the first change.

The three that were rebuilt shrank by more than half, and what came out was not mostly links. Each carried
an instruction that could not be followed: a "do not delete this script" guarding a file absorbed into the
shared build script; two grammar paths under a pre-flatten directory, cited by a sentence telling readers
to verify node names against them; and, in **two** packages with the identical wording, an instruction to
bump the version of a `path` dependency that has none. `packages/compiler` was worse — four of its five
"grammar rules to remember" were stated as parse requirements that RFC-0022 had moved into the linter.

What none of them had was a sibling `CLAUDE.md`. Nothing read them, so nothing corrected them; the drift
is a consequence of the defect this track existed to fix, not an unrelated finding.

### Track 4 — The gate becomes the `vibe-ops` CLI

Replace the shell runner and its three-branch resolution with the `vibe-ops` CLI driven by a
`vibeops.config.ts`, and get a green gate back. At the end of this track `scripts/checks/_run.sh` and its
`VIBE_OPS_DISABLED_CHECKS` block are gone, `scripts/check.sh` and `.githooks/pre-commit` invoke the CLI,
and the declarations they carried live in a reviewed config file instead of an environment variable.

Four things this track must carry across, because each is load-bearing and none is obvious from the files
being deleted: **the debt ledger** `_run.sh` held in an environment variable; **the `adopt` declarations**
(`records.dirs.rfc`, `records.templates.*`) for the plural folder and this repository's own templates;
**`artifactDir`**, replacing the hook's `GATE_ARTIFACT_DIR` export; and **that nothing gets copied in** —
no runner snapshot, no fragment directory.

**Closed 2026-08-13.** `scripts/checks/_run.sh` is gone, `vibeops.config.ts` holds the declarations, and
`harness resolve` shows the swap as a state change: `RUNNER=(none)`, `CONFIG=vibeops.config.ts`.

**One of the four did not carry across the way this track predicted.** The ledger was to become `settings`
entries — but `vibe-ops check` runs the seventeen shell fragments through their own runner, which at the
time read only `VIBE_OPS_DISABLED_CHECKS`. Deleting `_run.sh` therefore removed the only mechanism that
could declare a fragment off, and the shell half went from green to 38 failures. The stopgap put the
export in both entry points, which a session hook exposed within the minute by running `vibe-ops check`
directly and seeing all 38: a declaration that lives in two shell scripts is invisible to every other
caller. Fixed upstream the same day — `module-check` now translates `settings.check.disabled` into that
variable, an env-set value still winning, and both exports are gone.

Nothing is `disabled` on the gate side. Everything real is `warn` with its owner named, because a disabled
check reports nothing about anything and a *new* instance of the same defect would be invisible.

**What resolves the runner, corrected 2026-08-13.** This track was written claiming an npm dependency
makes the gate resolve whether the repository is cloned alone or sits beside a `vibe-ops` checkout. There
is no such dependency — `@entelekheia/vibe-ops-cli` is not published, and its own README prescribes
`npm link`. The mechanism is `vibe-ops` on `PATH`, which the plugin already declares as a co-dependency
whose absence must fail loudly rather than pass silently. The argument for the change is unharmed, because
it never rested on packaging: what breaks today is a *path* that moved, and a binary resolved by `PATH`
has no path here to break.

Acceptance: `scripts/check.sh` exits 0, with no declared disablement and **no skip** whose reason is not
written down in `vibeops.config.ts`. The original clause — "and the same run from a fresh clone with no
sibling `vibe-ops` present" — is dropped as unachievable rather than quietly failed: an outside clone has
no gate until `vibe-ops` is installed. That costs less than it appears, because `core.hooksPath` is local
config no clone inherits, so an outside clone never runs the hook until someone wires it deliberately.

### Track 7 — Records and templates carry a version

`vibe-ops harness` (2026-08-13) turns most of this track mechanical, and its documented order is the
opposite of what the work looks like from here — `docs/how-to/upgrade-a-repository.md` §2 says **migrate
the records first, then promulgate**, so that a reader never meets a repository whose template declares
one shape and whose records declare another.

**That order does not start here, and the reason is worth stating rather than discovering.** `migrate`
reads each record's own `vibe-ops-template:` stamp and applies the recorded note per jump, stopping on a
jump it has no note for. Three of 46 records carry a stamp. The documented flow assumes *stamped at an old
version*; this repository is *never stamped*, which §1 of the same page names as a genuinely different
state. So the sequence gains a step at the front:

1. **Classify by shape and stamp.** A record's version is readable from its structure — a plan carrying
   `## Progress` is `0.1`, the same identification this plan's own migration used. Mechanical per record,
   a judgement per record type.
2. **`/vibe-ops:migrate .`** — now that there is a stamp to read.
3. **`vibe-ops harness sync .`** — the templates, onto a branch and a tag.
4. **Raise the warning to a failure** once the migration is finished:
   `settings.governance.level["template-version-behind"] = "fail"`, which §3 prescribes for exactly this
   moment — the warning is correct mid-migration and wrong for a repository that has completed one.

~~Step 3 is verified safe: the four templates shared with the norm carry no local customisation, so
overwriting loses nothing.~~ **Wrong for three of the four, corrected 2026-08-14.** That sentence was
written from the file names, not from a diff, and it is the second prediction in this plan to fail that
way. What the norm would have deleted:

| Template | What was local, and why it is not decoration |
|---|---|
| `rfc.md` | **The package-impact table.** `.agents/rules/governance.md` makes resolving every `?` cell the gate for Draft → Review, and `project/rfcs/AGENTS.md` owns its legend. The norm has no such table, so overwriting would have removed a ratification gate |
| `rfc.md` | `rfcs/`, plural, in both the copy target and the pointer — an `adopt` decision from Track 1 |
| `plan.md` | The disclaimer that plan numbering is plain `NNN` and **not** the DA scheme, which exists precisely because DA numbering is an `adopt` decision |
| `task.md` | The `Sources` row the governance rule requires by name, the `Package(s)` column, the frozen-boundary note, and the naming convention — a dossier here is `<topic>.md` or `<ID>-<topic>.md` carrying RFC/DA provenance, **never a GitHub issue number**, which is what the norm's template prescribes |

Only `adr.md` was additive. All four were re-applied on top of the norm, and the diff against
`vibe-ops/norm-1` is now exactly those deltas and nothing else.

**What made this recoverable is that `harness sync` stops at a branch.** It writes into a temporary
worktree on `vibe-ops/norm-<version>`, never merges and never pushes, which turns promulgation into an
ordinary reviewable diff. Had it written in place, three `adopt` decisions would have been deleted in a
commit that read as tooling maintenance.

The rest of step 3 held: `release-freeze-task.md` and `versioning-task.md` have no upstream equivalent
and were untouched, and the sync *adds* `log.md`, which this repository lacked — the gap that sent every
closure ceremony to a destination that did not exist.

**The order inverted, and the reason generalises.** §2 of the how-to prescribes migrate-then-promulgate so
that no reader meets a repository whose template declares one shape and whose records declare another.
That assumes the local template is an **older version** of the norm. Here it was a **divergence** —
authored before promulgation, never a `task@0.1` — so no migration note could reach it and the refusal
surfaced at the template end first: `vibe-ops task close` exited 2 with *the template declares no version,
so no record under it can be compared*. Promulgating moved the same refusal to the record end. Templates
therefore came first here, and the two states are worth keeping apart: **behind is migrable, divergent is
not.**

**Executed 2026-08-14.** Templates promulgated (`adr@2 rfc@2 plan@3 task@3 log@2`, boundary 1, recorded in
the gitignored `vibeops.config.local.json`). Thirty-two records stamped: nine ADRs and twenty-three RFCs,
both jumps being section-preserving by their own notes, verified as thirty-two diffs of exactly `+4/-0`.
The two finished dossiers were repaired by hand and closed.

**Eight records remain, and none of them is a stamping job.** Plans 002 and 003 carry `## Progress` and
`## Surprises & Discoveries`, so they are genuinely `plan@0.1` and their migration routes every Surprises
entry through the promotion test — judgement per entry, not a marker insert. Plan 004 is an RFC wearing a
plan filename (`1. Summary`, `2. Motivation`, `3. Specification`), which is a shape question rather than a
version one. The five live task dossiers are all local divergences, three of them predating these
conventions entirely; none is `Done`, so the migration note's skip rule does not retire them.

**Step 4 is deliberately not taken yet, and would be theatre if it were.** Raising
`template-version-behind` to `fail` is prescribed for a repository that has *finished* migrating, and
eight records say this one has not. It would also change nothing measurable: `vibe-ops governance` reported
`13 gates, 0 failed` while forty-three records carried no stamp, because the gate flags a record that is
*behind*, not one that is *unstamped* — and `template-version-rfc` runs over `project/rfc/**/*.md`, a
folder this repository does not have. That is the third instance of the open question below about literal
paths in the upstream ops, now with a measurement attached.

### Track 5 — Close the findings the gate had to be handed over red with

The declared and pre-existing failures that Track 4's acceptance depends on, fixed rather than carried.
This track exists separately because its work is editing documents, not wiring, and mixing the two is how
a wiring change gets reviewed as a document change. A gate handed over red is the one people switch off
within the week.

The work is [`project/tasks/close-the-red-findings.md`](../tasks/close-the-red-findings.md). Its counts
are the authority, not the ones this track was written with: re-measuring after `project/pre-release/`
was retired moved every figure, and the dossier records why each moved rather than restating a total.

The `budget` failure is **not** in this track. `AGENTS.md` sits at exactly 150 of 150 lines by Track 2's
own measurement and is now 174; bringing it back is another relocation exercise, which is Track 6.

## Success criteria

**Superseded 2026-08-13 for Tracks 4–5; kept as written for Tracks 1–3, which were accepted against it.**
The original criterion invoked the shell runner at a plugin-root-relative path:

```bash
<vibe-ops-plugin-dir>/scripts/check-agents-md.sh /path/to/dot-agent-spec
```

That path no longer exists. It required `budget`, `bridge`, `frontmatter` and `plugin-root-paths` to
report `ok`, treated `private-names` and `template-attribution` as correctly `SKIP`, and required every
remaining `links` failure to sit under `project/pre-release/`, `docs/` or `dsl/` — any `links` failure
elsewhere under `project/` being a regression. That last clause survives verbatim into what follows.

The criterion from Track 4 onward is the CLI, run from inside the repository:

```bash
vibe-ops agents-md && vibe-ops governance     # or scripts/check.sh, which runs both
```

Every gate reports `ok` or a `SKIP` whose reason is written down in `vibeops.config.ts`. A `SKIP` with no
declared reason fails this criterion even though it exits 0, because an undeclared skip and a passing
check are indistinguishable in the summary line — which is the failure mode this plan met twice.

**One `SKIP` must be read as a finding, not a result.** `skill-frontmatter` reported `SKIP  no skills/
directory` under the shell runner while this repository had two skills with frontmatter to check. The
fragment guards on `$PLUGIN_DIR/skills` and this repository's skills are in `.agents/skills/`. The ported
gate declares both paths and examines them, so the same repository goes from 0 to 2 files examined with no
change to the repository at all. Any future `SKIP` gets the same question asked of it: is this check
declining, or is it addressed at the wrong place?

Independently, the plan scaffolding must work end to end without arguments explaining the repository's
layout:

```bash
for d in project/plans plans docs/plans; do [ -d "$d" ] && echo "PLAN_DIR=$d" && break; done
for t in project/templates/plan.md templates/plan.md; do [ -f "$t" ] && echo "PLAN_TPL=$t" && break; done
```

---

## Decision Log

- **Decision:** Keep `project/rfcs/` plural, `project/pre-release/v<minor>/` as the long-form log, and the
  DA `DA<minor>-<seq>` numbering for ADRs — do not rename any of them to the vibe-ops defaults (`rfc/`,
  `log/`, `NNNN`).
  **Rationale:** All three are referenced by name across the repository's own documents and, in the case of
  DA numbering, by an accepted decision record ([DA00-01](../adr/DA00-01-traceability-scheme.md)) that
  argues for it explicitly. The baseline's own convergence policy treats a consistent, deliberately-chosen
  name as something to adopt rather than migrate. Renaming would break inbound links to buy nothing.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Put the DA scheme inside `.agents/rules/governance.md` rather than leaving it only in
  `GOVERNANCE.md`.
  **Rationale:** The plugin's scaffolding skills resolve their numbering authority in a fixed order —
  the record folder's own `AGENTS.md` first, then `.agents/rules/governance.md`, then their built-in
  default. Deleting `project/adr/AGENTS.md` without putting the scheme in the rule would have silently
  demoted this repository to plain `NNNN` numbering on the next ADR.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Delete the local `/new-adr` and `/new-rfc` skills rather than repair them.
  **Rationale:** They were a fork of a procedure maintained elsewhere, and forking is what let them rot
  unnoticed against a folder move in their own repository. Repairing them would restore the identical
  failure mode. The plugin's versions read this repository's templates and numbering, so nothing local is
  lost. The reason is written into `AGENTS.md` rather than only here, because the tempting future action —
  "the plugin is not installed, let me just add a local skill" — is exactly the mistake.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Name `vibe-ops` in `AGENTS.md` and `GOVERNANCE.md`, but not in `README.md`.
  **Rationale:** In `AGENTS.md` it is actionable — it stops an agent hand-rolling a record or forking a
  skill — and the plugin is public, so the reference does not dangle for an outside contributor. `README.md`
  is presentation and usage of dot-agent itself; how the repository governs its own paperwork is process
  leakage there. Both mentions are phrased so the templates and lifecycles in this repository remain the
  contract and the plugin is only how they are applied, which keeps a contributor without it fully able to
  work.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Convert `dogfood/AGENTS.md` into a path-scoped rule and treat the dogfood snapshots that
  reference the now-deleted `/new-adr` and `/new-rfc` skills as correct-as-written.
  **Rationale:** `dogfood/` declares its own contents to be dated and never retro-corrected, so a snapshot
  naming a skill that has since been removed is behaving as designed rather than dangling. The new rule
  states this explicitly so a future reader does not "fix" it. Only `dogfood/new-adr/BRIEF.md` was touched,
  to repoint two references at the rule's new path — a brief is the input to a dogfood, not the immutable
  snapshot that its rules protect.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Fix `ROADMAP.md`'s 20 broken links as part of this plan, but leave the ones in `docs/`,
  `dsl/` and `project/pre-release/`.
  **Rationale:** `ROADMAP.md`'s breakage has the same single cause as the governance drift being
  reconciled here — the move of `rfcs/` and `tasks/` under `project/` — which makes it the same work.
  `docs/` and `dsl/` link rot has unrelated causes, and `project/pre-release/` is immutable by rule.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Repoint the two broken links inside the accepted ADR
  `project/adr/DA00-03-model-tiering-for-agent-routing.md`, despite ADRs being immutable once Accepted.
  **Rationale:** Immutability protects an accepted decision's *substance* — its context, the choice, the
  options rejected and the consequences accepted. A relative path that stopped resolving when a folder
  moved is not substance; leaving it broken preserves nothing and costs the reader the two documents the
  ADR points at. The same reasoning permitted editing `dogfood/new-adr/BRIEF.md`, whose folder is
  otherwise write-once. Both edits changed only path text.
  **Date / Author:** 2026-07-30 / Danilo Borges

- **Decision:** Replace the shell gate with the `vibe-ops` CLI and a `vibeops.config.ts`, rather than
  repairing the runner path.
  **Rationale:** The repair has no good form. This repository is public and is cloned on its own, which the
  upstream harness contract says calls for a runner snapshot; it also sits beside a `vibe-ops` checkout,
  which the workspace's own onboarding rule says forbids one, because a snapshot there becomes a stale
  duplicate that *wins* the resolution order. Both are right about their own case, and today the
  repository has the worst of both — a tracked gate that an outside clone inherits and can never resolve.
  A devDependency is correct in both situations simultaneously, which is not a compromise between the two
  positions but the removal of the question. The three-branch resolution, the composition assertion and
  the snapshot-refresh caveat all cease to exist rather than being fixed.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** Express the `links` exclusion as a declared population exclusion naming three trees, not as
  a disabled check.
  **Rationale:** The judgement underneath is unchanged and still correct — `project/pre-release/` is
  immutable by rule, and `docs/`/`dsl/` rot has unrelated causes. What was wrong is the granularity. A
  disabled check reports nothing about anything, so a newly broken link under `project/` — precisely the
  regression this plan's own success criteria call out by name — would have been invisible for as long as
  the disablement stood. The exclusion keeps the same files out of the population and keeps reading
  everything else.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** Finish Track 3's remaining folders as part of Track 4 instead of leaving them
  opportunistic, but keep the review-first order.
  **Rationale:** The original argument for opportunism was that a `CLAUDE.md` added ahead of a content
  review starts *delivering* stale guidance that was previously inert — that argument is untouched and the
  three-step order stands. What changed is the cost of the other side: under Track 4 the missing siblings
  are gate findings, so leaving five of them means declaring them disabled to hand the gate over green,
  and a disablement whose reason is "nobody got round to it" is the kind nobody ever lifts. Doing the
  reviews now is cheaper than opening a debt entry that outlives them.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** Correct `GOVERNANCE.md` to say a Rejected RFC moves to `rfcs/rejected/`, and create that
  folder.
  **Rationale:** `GOVERNANCE.md` says `implemented/` and `.agents/rules/governance.md` says `rejected/`;
  they cannot both be right, and the rule is the operational surface that actually loads when someone is
  working inside `project/`. Filing a rejected proposal among the implemented ones also destroys the one
  distinction the two folders exist to make. The folder itself was promised by two documents and existed
  in neither the tree nor anyone's expectations.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** The gate reaches `vibe-ops` through `PATH`, not through an npm dependency — and Track 4's
  acceptance drops the fresh-clone clause instead of pretending to meet it.
  **Rationale:** the dependency framing was written without checking, and it is wrong:
  `npm view @entelekheia/vibe-ops-cli` returns 404 and `cli/README.md` says "Not published to a registry
  yet", prescribing `npm link`. `PATH` is not a fallback but the sanctioned pattern — the plugin declares
  itself co-dependent with the CLI and states that a machine without the binary must get a loud hook
  failure rather than a silent no-op. The argument for the migration never rested on packaging: what broke
  was `../vibe-ops/scripts/`, a path, and `PATH` resolution has no path here to break. The clause that
  does die is "works from a fresh clone with no sibling `vibe-ops`", and it is recorded as dropped rather
  than quietly failed, because `core.hooksPath` is local config no clone inherits — an outside clone never
  runs the hook until someone wires it, at which point they install `vibe-ops` too.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** Spawn three task dossiers for Tracks 3, 4 and 5 rather than keeping their work lists in
  this file.
  **Rationale:** `plan@3` allows one checkbox per track and no finer, on the rule that the doing goes to
  the dossier — deleted at closure — and the design stays in the plan, which is permanent. The three are
  split by *kind of work*, not by size: wiring, content review, and document repair review differently,
  and a wiring change bundled with document edits gets reviewed as a document change. Splitting also made
  the stale counts visible, which a single combined list would have carried forward unexamined.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** Take `harness sync` for the templates and keep a hand-written stamping step in front of
  it; do not compose `disabled-declared` or `runner-provenance` here.
  **Rationale:** the module makes the template half mechanical and safe — the four shared templates carry
  no local customisation, and the two local-only ones are outside what the norm owns — so hand-migrating
  them would be work with no product. The record half is the opposite: `migrate` reads a stamp, and 43 of
  46 records have none, so the documented migrate-then-promulgate order starts one step later than the
  page assumes. On the two gates: `VibeOpsConfig` cannot compose a gate at all, so "configure it per
  repository" is not an available shape, and the only local alternative is inventing an ops — which would
  answer a question both gates' own source declares deferred upstream. They are regression guards here
  rather than live findings, so waiting is free.
  **Date / Author:** 2026-08-13 / Danilo Borges

- **Decision:** Promulgate the norm templates **before** migrating the records, inverting the documented
  order, and re-apply this repository's four `adopt` customisations on top of the result.
  **Rationale:** the documented order exists so that no reader meets a repository whose template declares
  one shape and whose records declare another, and it assumes the local template is an older *version* of
  the norm. Ours was a *divergence* — authored before promulgation, matching no released shape — so no
  migration note could reach it, and the tooling refused at the template end first. Re-applying rather
  than accepting the overwrite is not a compromise: three of the four shared templates carried decisions
  this plan itself made, including the RFC package-impact table that `.agents/rules/governance.md` uses as
  the Draft → Review gate. The general form is worth keeping: **behind is migrable, divergent is not**, and
  the two produce the same symptom.
  **Date / Author:** 2026-08-14 / Danilo Borges

- **Decision:** Stamp the nine accepted ADRs, despite this repository reading ADR immutability strictly.
  **Rationale:** the `adr 0.1 → 2` note raises this as a decision the consuming repository owes rather
  than assuming it away, and says the correct outcome where immutability is read strictly is to leave the
  ADR unstamped and report it. Answered the same way this plan already answered the analogous case when it
  repointed two broken links inside an accepted ADR: immutability protects a decision's **substance** — its
  context, the choice, the options rejected, the consequences accepted — and a marker read by machines is
  not substance. Verified mechanically rather than asserted: all thirty-two stamp diffs are exactly
  `+4/-0`, so no status, no decision and no prose moved.
  **Date / Author:** 2026-08-14 / Danilo Borges

- **Decision:** Repair the two finished dossiers by hand instead of running `/vibe-ops:migrate` over them.
  **Rationale:** the `task 0.1 → 0.2` note carries its own skip rule — *"Skip any dossier already at `Done`
  and report it as skipped for that reason — never as migrated"* — and both were `Done`. Their two
  divergences were also not version jumps: no note in the chain renames `## Closing` to `## Closure` or
  adds `## Surprises & Discoveries`, because the norm has had both since `0.1`. Migrating would have
  produced a file whose stamp said `task@3` while its shape did not, which is the exact inconsistency the
  ordering rule exists to prevent.
  **Date / Author:** 2026-08-14 / Danilo Borges

## Outcomes & Retrospective

**Template migration, 2026-08-13: `plan@0.1` → `plan@3`.** The `0.1 → 0.2` jump drops `## Progress` and
`## Surprises & Discoveries`, and forbids deleting a Surprises entry in place — a plan whose section is
not empty stays at `0.1`. Eleven entries were routed. **One survived promotion**, which is the expected
ratio and not a sign the harvest was thin:

| Entry | Destination |
|---|---|
| `rm` on a `.claude/` symlink reports a Windows checkout failure | **`project/log/rm-on-a-bridge-symlink-reports-the-opposite-problem.md`** — the only one that could name a path where someone meets it again |
| The forked `/new-adr` and `/new-rfc` rotted silently | already stated in `AGENTS.md` under the anti-forking rule — **discharged**, not filed twice |
| Nothing checked document links | **demoted**: the `markdown-link` gate does now |
| Eight `AGENTS.md` with no sibling `CLAUDE.md` | **demoted**: `no-sibling-claude-md` is a gate finding |
| Two `vibe-ops` checks false-positive inside code fences | **demoted, verified**: the `[[language]]` TOML headers are still at `packages/language-server/README.md:97-104` and the ported `memory-slug` gate does not flag them. The upstream bug is fixed in the port |
| The `AGENTS.md` excess is duplication, not verbosity | scaffolding for Track 2, which shipped — **dropped** |
| Two facts in `AGENTS.md` were already false | fixed in Track 2 — **dropped** |
| No CI beyond publishing | repository state, already an Open question — **dropped** |
| The gate is dead in seven repositories | **kept in Open questions**: it is a finding about `vibe-ops`, not about this repository, and a repo's own plan may not be its permanent home |
| A `SKIP` was an address error, not a declined check | **kept in Open questions**, same reason |
| A success criterion can stop being runnable while its tracks stay correct | **discharged into Goal 5**, which now requires no unexplained skip, and into the superseded-criteria note |

Four demotions in eleven entries is the part worth naming. Each was written because nothing enforced the
thing it described; each is now enforced. That is the promotion test's third question working in reverse,
and it is the only mechanism in this system that makes a knowledge base get *smaller*.

**Track 1, 2026-07-30.** Complete. Measured against the validator, total failures went from 64 to 39
across 8 checks; the `links` check went from 61 failures to 36, and `bridge` stayed green throughout apart
from one self-inflicted regression that was caught and fixed within the track. Every remaining `links`
failure is now outside `project/` or inside the immutable `project/pre-release/`, which is what this
plan's success criteria require. Both remaining non-`links` failures are known: the `budget` failure is
Track 2's entire purpose, and the two `memory-slugs` failures are an upstream false positive already
filed.

The track made one goal worse before making it better: the root `AGENTS.md` grew from 220 to 233 lines
while gaining the governance and anti-forking guidance, pushing it further over the 150-line budget. That
is accepted deliberately — the content is correct and belongs somewhere, and Track 2 is the step that
decides where. It is recorded here rather than quietly absorbed because a plan that only reports
improvement is not a working record.

The clearest signal from this track is that **every problem it found was a fork or a copy that drifted**:
the skills forked a procedure, `## After structural changes` duplicated a table row, the layout tree
duplicated the package table, and the nested `AGENTS.md` files duplicated lifecycles nothing loaded. None
of them were wrong when written. That is the argument for Track 2 being a relocation exercise rather than
a rewrite.

**Track 2, 2026-07-30.** Complete, and the prediction held: 83 lines came off `AGENTS.md` without a single
fact being summarised away. Everything cut either moved into `.agents/rules/doc-sync.md`, moved to a link
where it is maintained once upstream, or was a duplicate of something else already in the file. The file
now sits at exactly 150 of 150 lines, which is worth naming as a risk rather than a win — the next
addition breaks the budget, and the honest response to that is another relocation, not raising the
ceiling.

Two facts in the file turned out to be already false: `org-spec/` was listed as an active directory that
does not exist, and the opening section still placed `rfcs/` and `tasks/` at the repository root. Both are
exactly the failure the file warns about in its own text. Neither was found by reading the file for
correctness — they surfaced only because the budget forced every line to be re-examined for whether it
still earned its place. A size budget catches staleness as a side effect, which is an argument for the
budget that the enforcement-ladder framing does not make on its own.

---

## Open questions

- ~~Should `scripts/check-agents-md.sh` be copied into this repository and wired into CI?~~ **Half
  answered, 2026-08-13.** The copy question is closed by Track 4's decision — there is no copy, so nothing
  ages. Whether to add a CI job that runs `vibe-ops` on a pull request is still open, and is now an
  ordinary question about adding a workflow rather than a question about snapshots.
- Is `project/implementation-status.md` drift better served by running `/sync-implementation-status` in CI
  than by the prose obligation in `AGENTS.md`? That would move it to the top of the enforcement ladder and
  make part of the `## Keeping docs in sync` table deletable — but it needs the previous question answered
  first.
- **Should the gates read `records.dirs` / `records.templates`, or should this repository declare gate
  paths a second time?** Opened 2026-08-13 by Track 4. `vibe-ops` already resolves a record type's folder
  and template through a search order that *includes* this repository's plural `project/rfcs/` and its own
  `project/templates/`, with a config key to override — the exact `adopt` decisions Track 1 made. But that
  resolver serves the records module only; the governance ops names `project/rfc/**/*.md` and
  `<plugin>/templates/adr.md` as literals. The consequence here is silent: those entries examine zero
  files, which produces no findings and reads as clean. This is an upstream question and this plan should
  not work around it — a local override would be a third copy of an answer that already exists twice.

  **Measured 2026-08-14, and it is wider than "the RFC entry reads nothing".** `governance --audit --json`
  reports **all six** `template-version` gates as skipped, each saying *no `templates/<type>.md` — nothing
  to compare these records against*, while `project/templates/` holds five stamped templates and
  `vibeops.config.ts` names every one of them under `records.templates`. The cause is one literal in the
  ops composition — `options: { template: "<plugin>/templates/adr.md" }` — and in a repository that is not
  a plugin, `<plugin>` resolves to the root, where no `templates/` exists. So the whole `template-version`
  enforcement is inert here. That is why `vibe-ops governance` reported `13 gates, 0 failed` over
  forty-three unstamped records, and why Track 7's step 4 would have measured nothing had it been taken.
  Upstream already knows the symptom without having fixed the cause: the gate's own source says its skip
  reason was rewritten *because* the old wording claimed a repository kept no records of that type while
  holding "9 ADRs, 25 RFCs and 4 plans" — this repository's exact counts.

  > Promoted to learning on 2026-08-13
- ~~**`module-check` does not read `settings.check.disabled`.**~~ **Closed 2026-08-13, the day it was
  opened.** It spawned the seventeen fragments with `GATE_VERBOSE` and nothing else, so a fragment could
  only be declared off through the `VIBE_OPS_DISABLED_CHECKS` environment variable — which only a caller
  can export, putting the declaration in `scripts/check.sh` and `.githooks/pre-commit` and **nowhere a
  different caller could see it**. Measured by a session hook running `vibe-ops check` directly and
  reporting 38 failures this repository had already decided about. Fixed upstream: `module-check` now
  translates `settings.check.disabled` into that variable, with an env-set value still winning, which is
  the right precedence — a declaration made at the point of invocation is narrower than a committed one.
  Both exports were removed here and the config is the single ledger; verified by unsetting the variable
  and watching the two `SKIP` lines come back carrying this repository's own reason strings.
- **Where do `disabled-declared` and `runner-provenance` get composed?** Opened 2026-08-13.
  `harness catalog` reports both as available and composed into no ops, and each lands exactly on a Track
  4 concern — the first enforces that a `disabled` entry carries a reason string rather than a boolean,
  which is what makes the debt ledger a ledger; the second detects a runner snapshot that wins the
  resolution order and shadows a live sibling, which is the trap this repository is deliberately avoiding.
  **This repository is not the place to answer it.** `VibeOpsConfig` has no key that composes a gate —
  `settings.<ops>` only tunes an ops that already does — so the only local option is inventing an ops,
  and both gates state in their own source that which population they belong to is a deferred upstream
  decision. Answering it here would be the second answer to an open question, which is the failure mode
  the other two entries in this list already describe. Both are regression guards rather than live
  findings here, so waiting costs nothing.
- **`harness audit` reports `0 behind` over a population it cannot read.** Opened 2026-08-13. Its
  governance overlay gives `adr: 9, 0 behind` / `rfc: 25, 0` / `plan: 4, 0` / `task: 8, 0` against 46
  records of which three carry a stamp — so it could compare at most one. A repository never promulgated
  to and a repository fully current produce the same line. This is the principle the ops layer enforces
  as *zero examined is not a reading*, not applied to this overlay. Upstream, and worth carrying into the
  consolidated `vibe-ops` learning rather than filing here.

  > Promoted to learning on 2026-08-13
- **What do the other nine `SKIP`s mean?** Ten of seventeen shell fragments skip in this repository, and
  the first one examined turned out to be addressed at the wrong directory rather than inapplicable. The
  remaining nine have not been checked with that question asked. Track 4 makes this cheaper to answer than
  to keep deferring, since the ported gates declare their populations explicitly.
- **Nothing drains `GATE_ARTIFACT_DIR` in this repository.** The workspace's `drain-gate-artifacts.sh`
  translates a spooled artifact into `eita`'s registry, and the spool directory here is already the right
  shape and location for it, but neither this repository's `post-commit` nor the workspace's calls the
  drain. Moot while nothing emits; it stops being moot the moment a gate here declares `emits`.

## Related

- [DA00-01](../adr/DA00-01-traceability-scheme.md) — the DA numbering scheme, preserved by this plan.
- [DA00-03](../adr/DA00-03-model-tiering-for-agent-routing.md) — model tiering; Track 2 proposes reducing
  the `AGENTS.md` section that summarises it to a pointer.
- [DA00-05](../adr/DA00-05-monorepo-flatten.md) — the monorepo flatten that archived the standalone package
  repositories whose stale links Track 3 cleans up.
- <https://github.com/entelekheia-ai/vibe-ops> — the plugin defining the baseline.
- <https://github.com/entelekheia-ai/vibe-ops/issues/6> — the `memory-slugs` false positive.

- Task dossiers closed and removed per the task lifecycle (`Planned → In Progress → Done → file removed, git history is the archive`):
  - `git show 42ec13d03dd083f40b3e83916bdca51daef298c6:project/tasks/vibe-ops-cli-gate.md`
  - `git show 42ec13d03dd083f40b3e83916bdca51daef298c6:project/tasks/per-package-agents-md.md`
