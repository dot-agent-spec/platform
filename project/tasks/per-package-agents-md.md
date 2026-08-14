---
vibe-ops-template: task@3
---

# Task: Make the per-package `AGENTS.md` files actually load

| Field | Value |
|---|---|
| Status | Done — all six items closed 2026-08-13; the dossier survives only because `vibe-ops task close` is blocked on the template, see vibe-ops-cli-gate.md |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | — (no tracking issue; the design record is Plan-001 Track 3) |
| Sources | [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 |

---

## Context

Claude Code loads `CLAUDE.md`, not an `AGENTS.md` buried in a subfolder. A nested `AGENTS.md` with no
sibling and no `@`-import **never enters context on its own** — so its content is not merely unread, it is
silently unread, while the root `AGENTS.md` has been telling readers "each package has its own
`AGENTS.md` — read it before making changes there" the whole time.

Four folders were fixed in Plan-003. Six remain. They were left to be picked up opportunistically, by
whoever next worked in each; that changed on 2026-08-13 when `no-sibling-claude-md` became a gate finding.
Six known-failing folders would have to be declared disabled to hand the gate over green, and a
disablement whose reason is "nobody got round to a one-line file" is the kind nobody ever lifts.

**The three-step order below is load-bearing and is not relaxed by the deadline.** Step 3 alone is a
one-line file per folder, and doing it first would start *delivering* stale guidance into context that is
currently only sitting inert on disk. A wrong instruction nothing reads is a smaller problem than a wrong
instruction that loads.

Every folder gets, in this order:

1. **Review the content** against what the package actually does today. The stale parts are invisible
   until someone already in that code reads them — Plan-003 found ten false claims in one file, including
   a dependency that never existed and an invariant the code violates in three places.
2. **Repoint or delete the dead links**, in both `AGENTS.md` and the package `README.md`. Several point at
   standalone GitHub repositories archived when this monorepo was flattened
   ([DA00-05](../adr/DA00-05-monorepo-flatten.md)); the canonical code is under `packages/` now.
3. **Add a one-line `CLAUDE.md` containing `@AGENTS.md`.**

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | `packages/kernel-dsl` — has a live broken link | kernel-dsl | S |
| 2 | P0 | `plugins/claude` — has two live broken links | plugins/claude | S |
| 3 | P1 | `packages/parser-dsl` | parser-dsl | S |
| 4 | P1 | `packages/compiler` | compiler | S |
| 5 | P1 | `packages/sdk` — no `AGENTS.md` at all | sdk | M |
| 6 | P2 | `dogfood/mentor-agent` — zero-byte `AGENTS.md` | — | XS |

---

## Work items

### 1. `packages/kernel-dsl` — P0

**What:** review, fix the link, add the sibling.

**Why:** it is one of two folders whose step 2 is already specified by a live gate finding, so it is the
cheapest to start on and proves the loop.

**Change:** `packages/kernel-dsl/AGENTS.md` carries one `markdown-link` finding — a link to `API.md` that
does not resolve. Establish whether that document was renamed, moved into `packages/kernel-dsl/docs/`, or
never existed, and repoint or delete accordingly. Do not create an `API.md` to satisfy the link.

### 2. `plugins/claude` — P0

**What:** review, fix two links, add the sibling.

**Change:** two live `markdown-link` findings. Same rule as above: repoint at what exists, or delete the
reference. This folder is the Claude Code plugin surface, so its `AGENTS.md` is also the most likely to
have drifted against `plugin.json`.

### 3. `packages/parser-dsl` — P1 — **AGENTS.md done 2026-08-13, two files left**

157 lines to 62, and the review found a terminology drift larger than this dossier's scope.

**`intent_trigger` is a node name the grammar no longer has.** The DA01-01 rename replaced it with
`intent_handler`, and the code moved: seventeen files use the new name. The old one survives in exactly
four, of which **three are this package's own documentation** — `AGENTS.md`, `README.md`, and
`docs/reference/api.md`. A reader following any of them looks for a node that is not there.

`AGENTS.md` is corrected. **`README.md` and `docs/reference/api.md` are not**, and they are the open half
of this item. They belong to the same defect but not to the same fix: `.agents/rules/doc-sync.md` already
says a grammar change obliges the package docs, so this is that rule going unenforced rather than a
missing instruction. Whoever closes it should ask whether the obligation deserves a guard instead of a
third repair.

Also fixed while here: the build command named `scripts/build-wasm.sh` when the script is shared at the
repository root and reached as `../../scripts/build-wasm.sh`; a `src/analysis.rs:66` reference that had
drifted to line 52; and the same impossible instruction kernel-dsl carried — "upgrade the
`dot-agent-tree-sitter` version in `Cargo.toml`" against a `path` dependency that has no version.

The `WASM API Reference` table was deleted rather than corrected: `docs/reference/api.md` already holds
it, and of two copies the hand-written one goes stale first — which is exactly what had happened.

### 4. `packages/compiler` — P1 — **AGENTS.md done 2026-08-13, a wider drift named**

The README link was already repaired while closing `close-the-red-findings`. The AGENTS.md review found
something larger, and of the same shape as item 3's.

**Four of its five "Grammar rules to remember" described a grammar RFC-0022 replaced**, and stated them as
hard requirements — a reader would have hunted parse failures that can no longer occur. `state_body` is
now `repeat1(choice(...))`, `oriented_state_body` **has zero occurrences in the grammar**, and `agent_decl`
is `repeat(choice(...))`, so `.description` blocks parse in any order. Every one of those rules moved into
`src/linter.ts`, which is what RFC-0022 said would happen.

`oriented_state_body` survives in five files. Two are AGENTS.md — this one, corrected, and
**`packages/tree-sitter/AGENTS.md`, which is not**. The other three are
`project/implementation-status.md`, its generated `.html`, and
**`.agents/skills/sync-implementation-status/SKILL.md`**.

**The skill is the one that matters and the one outside this dossier's scope.** An AGENTS.md with no
sibling never loads, which is why these drifted unnoticed; a skill loads and runs. A skill carrying a node
name the grammar dropped will mis-map on its next run — which is the failure the root `AGENTS.md` already
describes happening once to this same skill, over a stale node-name table. It happened again, the same
way, and that is the argument for a guard rather than a fourth repair.

Also fixed: two grammar paths under `dsl/tree-sitter/`, a pre-flatten location, cited by a sentence telling
readers to verify node names against them. Same class as kernel-dsl's "do not delete this script".

### 5. `packages/sdk` — P1 — **decided 2026-08-13: it does not get one**

The only workspace package with no `AGENTS.md`, found by the audit rather than by the 2026-07-30 survey,
which counted the eight that existed. The item asked whether it needs one. It does not, and the check was
to look for a fact that would earn a line and find that each already has a better home:

| Candidate | Already lives in |
|---|---|
| The public surface — three exports | `README.md` § Public API, and the exported types |
| Build, typecheck, test | `README.md` § Development; the scripts are stock `tsdown` / `tsc` / `node --test` |
| **The call-order contract** — handlers before `start()`, resolver before `start()` | `README.md` § Quick start, numbered, with **before** in bold both times, plus comments at the call sites in `src/session.ts` |
| A kernel effect obliging a handler here | [`.agents/rules/doc-sync.md`](../../.agents/rules/doc-sync.md), which loads on its own |

The call-order contract is the one that could have justified a file — it is a real invariant and getting
it wrong fails at runtime. It is also already stated more clearly than a new file would state it.

**Writing one anyway would have produced the exact defect this dossier exists to remove**: a seventh
nested `AGENTS.md` restating a README, never loading, drifting from it on the first change. Five source
files and three exports do not need an entry map.

Recorded rather than left silent, so the next audit finds a decision instead of a gap and does not
re-open it.

### 6. `dogfood/mentor-agent` — P2 — **done 2026-08-13: deleted**

Zero bytes, and the only `AGENTS.md` anywhere under `dogfood/`. An empty instruction file promises
guidance that is not there, and this one had a surface already doing the job properly:
`.agents/rules/dogfood.md` is path-scoped to `dogfood/**`, carries the guardrail against citing a snapshot
as current behavior, and — unlike a nested file with no sibling — actually loads. Nothing was relocated
because there was nothing in it.

---

## Implementation order

```
P0:  1, 2   — the two with links already specified; either order, independent
P1:  3, 4, 5 — independent of each other
P2:  6      — delete; do last so it is not mistaken for the pattern
```

No batching constraint: each folder is independent, and each leaves the tree consistent on its own. A
plan or task that touches one of these folders for another reason **should pull its item in and close it
there** rather than leaving it for a sweep.

## Surprises & Discoveries

**Already routed on 2026-08-13, before this section existed.** The dossier was written against this
repository's pre-promulgation `task.md`, which had no such section, so the entries below were harvested by
`/route-learnings` from the closure summary instead and are recorded here for the ceremony to find
discharged rather than re-route.

- Observation: three of the six folders carried an instruction that could not be followed, and none of
  them had a sibling `CLAUDE.md`.
  Evidence: a "do not delete this script" guarding a file long since absorbed into the shared build
  script; two grammar paths under a pre-flatten directory, cited by the sentence telling readers to verify
  node names against them; the identical impossible instruction in two packages, to bump the version of a
  `path` dependency that has none. Nothing read the files, so nothing corrected them — the drift is a
  consequence of the defect this dossier existed to fix.
  **Discharged:** stated in Plan-001 Track 3's write-back, which is permanent.

- Observation: the three-step recipe's final step was wrong for two of six folders, and only reviewing
  first caught it.
  Evidence: `plugins/claude` would have shipped a `CLAUDE.md` into every user's plugin cache;
  `packages/sdk` would have gained a nested file restating its own README.
  **Discharged:** both decisions are recorded in Plan-001 Track 3 and in `vibeops.config.ts`'s `pairing`
  exclusion, which is where the next writer meets them.

- Observation: two node names the grammar dropped survive in package documentation and, more seriously,
  in a skill that loads and runs.
  Evidence: `intent_trigger` (DA01-01) and `oriented_state_body` (RFC-0022); the latter in
  `.agents/skills/sync-implementation-status/SKILL.md`, a skill already on record having mis-mapped once
  on a stale node-name table.
  **Carried forward:** Plan-001 Track 8, deliberately not closed with this dossier.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.

Section renamed from `## Closing` and `## Surprises & Discoveries` added by hand on 2026-08-14, not by
`/vibe-ops:migrate`: this repository's `task.md` was a local divergence rather than an older version, and
the `task 0.1 → 0.2` note's skip rule says a dossier already at `Done` is skipped, never migrated.

> Promoted to learning on 2026-08-13
