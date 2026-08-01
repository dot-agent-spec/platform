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
serves every agent framework; and a validator, `scripts/check-agents-md.sh`, that reports mechanical drift
against that shape. This plan brings `dot-agent-spec` onto that baseline **without flattening the
conventions this repository chose deliberately** — the DA decision-numbering scheme, the plural `rfcs/`
folder, and `project/pre-release/v<minor>/` as the long-form log all stay exactly as they are. The work is
split so that each phase leaves the repository consistent on its own, because the last phase is
opportunistic and may never finish as one piece of work.

## Goals

1. Every governance lifecycle in this repository is stated once, on a surface that actually loads when
   someone is working inside `project/` — not in a nested `AGENTS.md` that no agent reads.
2. Governance records are scaffolded by tooling that reads *this* repository's templates and numbering,
   with no forked copy of that tooling living inside this repository.
3. `project/plans/` exists as a home for multi-phase work whose design record must outlive the work — the
   gap that made this plan itself impossible to file before today.
4. The root `AGENTS.md` is at or under the 150-line budget the validator enforces, with everything cut
   from it relocated to a surface that loads, not deleted.
5. Running `scripts/check-agents-md.sh` from an installed `vibe-ops` against this repository reports no
   failure that is not a deliberate, recorded divergence.

## Scope

### In scope

The governance surfaces (`project/`, `GOVERNANCE.md`, `.agents/rules/`, `.claude/` bridge), the root
`AGENTS.md`, and the per-package `AGENTS.md` files under `packages/` and `apps/`. Fixing document links
that broke when this repository moved its governance folders under `project/`, since that migration is
the direct cause of the drift this plan reconciles.

### Out of scope

- **Renaming anything to match the vibe-ops default.** `rfcs/` does not become `rfc/`; `pre-release/` does
  not become `log/`; DA numbering does not become plain `NNNN`. These are `adopt` decisions, recorded in
  the Decision Log below.
- **Installing the validator into CI.** `vibe-ops` offers a snapshot copy of `check-agents-md.sh` into
  `scripts/` plus a GitHub Actions workflow. That copy is a snapshot that never receives upstream fixes,
  so it is a separate decision — this plan only runs the check from the installed plugin.
- **The content of the `project/pre-release/v0.1/` logs.** They are immutable by rule, including the links
  inside them that broke in the `project/` move.
- **`docs/` and `dsl/` link rot.** Roughly 25 broken links live there. They are real but unrelated to
  governance; they belong to whoever next edits those trees.

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

## Success criteria

Run the validator from an installed `vibe-ops` against this repository — the script is
`scripts/check-agents-md.sh` inside the plugin's own directory, which Claude Code exposes to a skill as a
plugin-root-relative path:

```bash
<vibe-ops-plugin-dir>/scripts/check-agents-md.sh /path/to/dot-agent-spec
```

`budget`, `bridge`, `frontmatter` and `plugin-root-paths` must all report `ok`. `private-names` and
`template-attribution` report `SKIP` and that is the correct result for this repository — the first
because its deny-list of names lives outside every repository by design, the second because this
repository ships no `skills/` directory of its own templates. The remaining `links` failures must all sit
under `project/pre-release/`, `docs/` or `dsl/`, which this plan puts out of scope; any `links` failure
under `project/` other than `pre-release/` is a regression.

Independently, the plan scaffolding must work end to end without arguments explaining the repository's
layout:

```bash
for d in project/plans plans docs/plans; do [ -d "$d" ] && echo "PLAN_DIR=$d" && break; done
for t in project/templates/plan.md templates/plan.md; do [ -f "$t" ] && echo "PLAN_TPL=$t" && break; done
```

---

## Progress

- [x] **2026-07-30 — Track 1 complete.**
  - [x] `.agents/rules/governance.md` written with `paths: ["project/**"]`, carrying the DA scheme, the
        ADR/RFC/plan/task lifecycles and `project/pre-release/v<minor>/` as this repository's log; symlinked
        from `.claude/rules/governance.md`.
  - [x] `project/adr/AGENTS.md` and `project/tasks/AGENTS.md` deleted, their content absorbed into that rule.
  - [x] `project/rfcs/AGENTS.md` reduced to the package-impact table, pointing at the rule for lifecycle.
  - [x] `project/plans/` created; `project/templates/plan.md` copied from the plugin and given this
        repository's Apache header plus a note that plans use `NNN`, not the DA scheme.
  - [x] `GOVERNANCE.md` extended to four document types with an explicit plan-vs-task criterion;
        `project/templates/README.md` updated to match.
  - [x] `dogfood/AGENTS.md` converted to `.agents/rules/dogfood.md` with `paths: ["dogfood/**"]`.
  - [x] Local `/new-adr` and `/new-rfc` skills deleted from `.agents/skills/` and `.claude/skills/`.
  - [x] `ROADMAP.md`: 20 links rewritten from pre-`project/` paths.
  - [x] The 5 remaining pre-`project/` links inside `project/` itself repointed —
        `project/adr/DA00-03-model-tiering-for-agent-routing.md` (2) and
        `project/rfcs/0019-memory-binding.md` (3, one of which also named a file that never existed at
        that path).
  - [x] Root `AGENTS.md`: layout tree, source-of-truth table and agent-config section updated.
- [x] **2026-07-30 — Track 2 complete.** `AGENTS.md` 233 → 150 lines, at budget, by relocation only.
  - [x] `.agents/rules/doc-sync.md` created, scoped to
        `packages|dsl|docs|examples/**` + `project/implementation-status.md`; received the whole
        `## Keeping docs in sync` table, `## Evolving the language`, and what `examples/` is.
  - [x] `## After structural changes` deleted — it restated the fourth row of that table, which moved into
        the rule with the "stale layout causes hallucination" rationale attached.
  - [x] `## Agent config layout` reduced from 36 lines to the repository-specific part: what rules and
        skills exist here, the nested-`AGENTS.md` guardrail, and the rule against forking the plugin's
        skills. Bridge mechanics now link to the upstream reference instead of restating it.
  - [x] `## Working with subagents and skills` collapsed to one paragraph pointing at
        [DA00-03](../adr/DA00-03-model-tiering-for-agent-routing.md).
  - [x] Layout tree collapsed: `packages/`, `apps/`, `plugins/`, `dsl/` and `docs/` subtrees replaced by
        one line each, since the package table and each folder's own README already own that detail.
        `project/` gained the detail it was missing instead.
  - [x] Two stale facts corrected: `org-spec/` removed from the package table (no such directory exists),
        and `## What this repo is` no longer places `rfcs/` and `tasks/` at the repository root.
  - [x] Duplicate license-header line removed from the old `## Example files` section — it already existed
        under `## License rules`, which now covers `.description`/`.behavior` anywhere, not just in
        `examples/`.
- [ ] **Track 3 — per-package `AGENTS.md`.** Opportunistic by design: tick a folder when work next
      touches it, after doing the three steps in the track description (review content → fix dead links →
      add the sibling `CLAUDE.md`). Surveyed 2026-07-30; line counts are from that date.

  - [x] 2026-08-01 `packages/tree-sitter/` — done in Plan-003 Track E. The link rot was the smaller half:
        it also carried a versioning scheme this repo has never used and two grammar nodes that do not
        exist.
  - [x] 2026-08-01 `packages/language-server/` — done in Plan-003 Track E. Ten false claims, including a
        dependency that never existed and an invariant the code violates in three places.
  - [x] 2026-08-01 `apps/vscode-extension/` — done in Plan-003 Track E. Confirmed the worst of the four,
        and its `agent/behaviorGraph` section was additionally written in Portuguese.
  - [x] 2026-08-01 `apps/dot-agent-cli/` — done in Plan-003 Track E; audited clean, `CLAUDE.md` already
        present from Plan-002. The survey line count (115) was stale — the file is 82 lines.
  - [ ] `packages/parser-dsl/` (157 lines) — the `README.md` → `LICENSE` link **now resolves**: that file
        was created by the license-text sweep (workspace Plan-002). Still needs the content review and the
        `CLAUDE.md`.
  - [ ] `packages/kernel-dsl/` (124 lines) — `AGENTS.md` link to `API.md` does not resolve.
  - [ ] `packages/compiler/` (86 lines) — `README.md` link to `../../architecture_map.md` does not
        resolve; the architecture map is at `docs/explanation/architecture/map.md`.
  - [ ] `plugins/claude/` (48 lines) — no known link rot; needs only the review and the `CLAUDE.md`.
  - [ ] One zero-byte `AGENTS.md` left to delete or fill: `dogfood/mentor-agent/AGENTS.md`. An empty
        instruction file is a promise of guidance that is not there; deleting is the default unless the
        folder genuinely needs one. (`apps/dot-agent-cli/templates/AGENTS.md` is already gone — Plan-002
        removed it.)

## Surprises & Discoveries

- **Observation:** The repository's own `/new-adr` and `/new-rfc` skills had been broken for some time and
  nothing surfaced it, because a scaffolding skill that finds no existing records simply starts numbering
  at 1 rather than failing.
  **Evidence:** `.agents/skills/new-adr/SKILL.md` instructed `find adr -maxdepth 1 -name
  "[0-9][0-9][0-9][0-9]-*.md"`. The folder has been `project/adr/` since the governance reorganisation, and
  its files are named `DA00-01-…` through `DA00-07-…` — so the command was wrong about the path *and*
  about the numbering scheme, and returned nothing on both counts. `new-rfc` additionally promised to
  update `rfcs/INDEX.md`, a file that does not exist in this repository.

- **Observation:** The same `project/` move rotted links far outside the skills, and the rot was invisible
  because no check ever ran over document links.
  **Evidence:** `ROADMAP.md` alone carried 20 links of the form `](rfcs/0005-type-system.md)` and
  `](tasks/pre-public-consolidation.md)`. The validator's `links` check found them on its first run; the
  repository has no CI that would have.

- **Observation:** Deleting a symlink with `rm` leaves it staged in git as a symlink that no longer exists
  on disk, and the resulting state is reported as the *opposite* problem — a checkout failure.
  **Evidence:** after `rm -f .claude/skills/new-adr`, the validator reported `.claude/skills/new-adr is a
  symlink in git but not on disk — checked out as text (core.symlinks=false)`, pointing at a Windows
  checkout issue that had nothing to do with the actual cause. `git rm --cached` was the fix. Worth knowing
  because the message actively misdirects.

- **Observation:** Two `vibe-ops` checks match on prose that *describes* a construct rather than uses it,
  because neither skips fenced code blocks. The failure is self-reproducing: a document explaining the bug
  trips the bug.
  **Evidence:** `memory-slugs` flags `packages/language-server/README.md` lines 99 and 103, where a
  double-bracketed `[…]` TOML array-of-tables header for `language` sits inside a ```` ```toml ```` fence
  documenting Helix editor configuration. Separately, `plugin-root-paths` flagged this plan for quoting a
  `CLAUDE_PLUGIN_ROOT`-relative path to the validator inside a shell fence — the plugin's script, correctly
  absent from this repository. Both filed upstream as
  <https://github.com/entelekheia-ai/vibe-ops/issues/6>. The two README lines are expected failures and
  must not be "fixed" by editing the README; this plan's own two instances were reworded to keep the run
  otherwise green, which is itself the argument for fixing the checks — a validator people learn to
  read past is off.

- **Observation:** Reviewing the root `AGENTS.md` for what should be *routed elsewhere* rather than
  shortened found that most of its excess is duplication or non-repository knowledge, not verbosity. The
  budget can be met by relocation alone. Recorded here so Track 2 does not have to re-derive it:
  **Evidence:**
  - The `## Agent config layout` section, 36 lines, restates the `.agents/` ↔ `.claude/` bridge mechanics
    that are identical in every repository using this convention and are documented once in the plugin's
    `references/instruction-surfaces.md`. Only the repository-specific part — which rules and skills exist
    here, and the rule against forking the plugin's skills — is local knowledge.
  - `## After structural changes` (10 lines) states the same obligation as the fourth row of the
    `## Keeping docs in sync` table 15 lines below it. The same fact on two surfaces in one file.
  - `## Keeping docs in sync` and `## Evolving the language` are both entirely scoped to `packages/**` and
    `dsl/**`, which makes them path-scoped rules that would load exactly when someone is about to cause the
    drift they prevent — a move up the enforcement ladder, not sideways.
  - `## Working with subagents and skills` (11 lines) is model-tier routing advice that is true in any
    repository; its rationale is already recorded in
    [DA00-03](../adr/DA00-03-model-tiering-for-agent-routing.md), which makes the section a summary of a
    record rather than repository knowledge.
  - The `packages/`, `apps/` and `plugins/` subtrees appear both in the layout tree and in the
    `## Package, app & plugin table` — roughly 20 duplicated lines.
  - `## Example files` (5 lines) is scoped to `examples/**`.

- **Observation:** Two facts in the root `AGENTS.md` are already false, which is the failure mode that file
  warns about in its own text ("stale layout information here is a primary source of hallucination").
  **Evidence:** the `## Package, app & plugin table` lists `org-spec/` as `✅ Active`, but no `org-spec`
  directory exists in the working tree. The `## What this repo is` list still refers to `rfcs/` and
  `tasks/` at the repository root rather than under `project/`, and does not mention `plans/`.

- **Observation:** The undeliverable-instruction problem is four times larger outside `project/` than
  inside it, and it is invisible because the files look fine — they are well-written, current-looking, and
  nothing reads them.
  **Evidence:** surveyed 2026-07-30, eight `AGENTS.md` files under `packages/`, `apps/` and `plugins/`
  total roughly 980 lines, and **none of the eight has a sibling `CLAUDE.md`**. Claude Code loads
  `CLAUDE.md`; a subdirectory `AGENTS.md` with no sibling and no `@`-import never enters context on its
  own. The root `AGENTS.md` has said "each package has its own `AGENTS.md` — read it before making changes
  there" the whole time, which is an instruction to a reader who was never given the file.

- **Observation:** There is no continuous integration in this repository other than package publishing, so
  every documentation invariant currently stated as prose is unenforced.
  **Evidence:** `.github/workflows/` contains only `publish-*.yml`; `.githooks/` contains only
  `post-commit`. In particular the `## License rules` section describes an Apache-header convention for
  Rust and TypeScript sources with nothing checking it, and `project/implementation-status.md` has a
  `/sync-implementation-status` skill that can detect its drift but is never run automatically.

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

## Outcomes & Retrospective

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

- Should `scripts/check-agents-md.sh` be copied into this repository and wired into CI? It is the only way
  the checks run on a pull request, but the copy is a snapshot that silently ages out of sync with the
  plugin, and this repository has no non-publishing CI to add it to today. Deferred, not rejected.
- Is `project/implementation-status.md` drift better served by running `/sync-implementation-status` in CI
  than by the prose obligation in `AGENTS.md`? That would move it to the top of the enforcement ladder and
  make part of the `## Keeping docs in sync` table deletable — but it needs the previous question answered
  first.

## Related

- [DA00-01](../adr/DA00-01-traceability-scheme.md) — the DA numbering scheme, preserved by this plan.
- [DA00-03](../adr/DA00-03-model-tiering-for-agent-routing.md) — model tiering; Track 2 proposes reducing
  the `AGENTS.md` section that summarises it to a pointer.
- [DA00-05](../adr/DA00-05-monorepo-flatten.md) — the monorepo flatten that archived the standalone package
  repositories whose stale links Track 3 cleans up.
- <https://github.com/entelekheia-ai/vibe-ops> — the plugin defining the baseline.
- <https://github.com/entelekheia-ai/vibe-ops/issues/6> — the `memory-slugs` false positive.
