# Task: Make the per-package `AGENTS.md` files actually load

| Field | Value |
|---|---|
| Status | Planned |
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

### 4. `packages/compiler` — P1

**Change:** 86 lines. `README.md` links to `../../architecture_map.md`, which does not resolve; the
architecture map is at `docs/explanation/architecture/map.md`.

### 5. `packages/sdk` — P1

**What:** the only workspace package with **no `AGENTS.md` at all**.

**Why:** it was never on the 2026-07-30 survey, which counted the eight that existed. Found by the
2026-08-13 audit.

**Change:** decide first whether it needs one. A package whose surface is fully described by its README
and types may not — and writing a file that restates them is the drift this task exists to clean up. If it
does need one, write it from what the code does today rather than from a sibling package's file.

### 6. `dogfood/mentor-agent` — P2

**What:** a zero-byte `AGENTS.md`.

**Why:** an empty instruction file is a promise of guidance that is not there.

**Change:** delete it. `dogfood/` is already governed by `.agents/rules/dogfood.md`, path-scoped to
`dogfood/**`, which is the surface that actually loads — that rule is why a nested file here has no job.
Only fill it instead if this specific agent folder needs something the rule cannot say.

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

## Closing

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
