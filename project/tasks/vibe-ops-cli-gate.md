# Task: Replace the shell governance gate with the `vibe-ops` CLI

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | — (no tracking issue; the design record is Plan-001 Track 4) |
| Sources | [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 4 |

---

## Context

The commit gate this repository installed in July is dead. `scripts/check.sh` exits 2 with
`no governance runner found`: all three branches of `resolve_runner()` in `scripts/checks/_run.sh` look
for a shell runner that has since moved inside `vibe-ops`, and none of them resolves. The same dead path
is in six sibling repositories, none of which has a snapshot to fall back on.

This dossier replaces the mechanism rather than repairing the path. **Why that is the right move, and
what the four carried-across concerns are, is Plan-001 Track 4** — read it before starting; this file is
the doing, not the design.

**One thing the design record gets wrong, corrected here.** Plan-001 says an npm dependency makes the gate
resolve whether the repository is cloned alone or sits beside a `vibe-ops` checkout. There is no such
dependency: `npm view @entelekheia/vibe-ops-cli` returns 404, and `cli/README.md` says "Not published to a
registry yet". The mechanism is **`vibe-ops` on `PATH`**, installed locally and globally — the sanctioned
pattern, since the plugin declares itself co-dependent with the CLI and a missing binary is meant to fail
loudly rather than pass silently. What this costs: an outside clone has no gate until someone installs
`vibe-ops`. What makes that acceptable: `core.hooksPath` is local config no clone inherits, so an outside
clone never runs the hook until it is deliberately wired anyway.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | `vibeops.config.ts` — the declarations `_run.sh` carried in an env var | root | M |
| 2 | P0 | Rewire `scripts/check.sh` and `.githooks/pre-commit` onto the CLI | root | S |
| 3 | P0 | Delete `scripts/checks/_run.sh` and the empty `scripts/checks/` | root | XS |
| 4 | P1 | Declared population exclusions replacing the blanket `links` disablement | root | S |
| 5 | P1 | Verification, including that no skip is undeclared | root | S |

---

## Work items

### 1. `vibeops.config.ts` — P0

**What:** a root `vibeops.config.ts` carrying what `scripts/checks/_run.sh` held in
`VIBE_OPS_DISABLED_CHECKS` plus what this repository's `adopt` decisions require.

**Why:** an environment variable in a shell script is not reviewable. The ledger it holds — two checks
declared off with dates and reasons — is this repository's whole governance debt record, and
`git grep VIBE_OPS_DISABLED_CHECKS` across the workspace is how that debt is found.

**Change:** model it on `vibe-ops/vibeops.config.ts`, the only worked example, which carries its reasoning
inline as comments. Keys needed here:

- `modules` — the ops this repository runs.
- `artifactDir: ".git/gate-artifacts"` — replaces the `GATE_ARTIFACT_DIR` export in `.githooks/pre-commit`.
  Per-clone and untracked, and already the shape the workspace's `drain-gate-artifacts.sh` ingests into
  `eita`. Nothing writes there today; this repository owns zero check fragments.
- `records.dirs.rfc = "project/rfcs"` and `records.templates.*` → `project/templates/*.md` — the plural
  folder and the repository's own templates, both `adopt` decisions from Track 1.
- `settings.<ops>.ignore` and `settings.<ops>.level` — item 4.

**Known limit, do not work around it.** `records.dirs` / `records.templates` are read by the records
resolver, **not** by the gates, whose paths are literals in the upstream ops (`project/rfc/**/*.md`,
`<plugin>/templates/adr.md`). So the RFC `record-header` and `template-version` entries examine zero files
here, which produces no findings and reads exactly like a clean run. This is Plan-001's open question and
belongs upstream; a local override would be a third copy of an answer that already exists twice.

### 2. Rewire `scripts/check.sh` and `.githooks/pre-commit` — P0

**What:** both invoke `vibe-ops` from `PATH` instead of sourcing `_run.sh` and calling a resolved runner.

**Why:** they are the two entry points, and the whole point of `_run.sh` existing as a shared file was
that a bare runner invocation silently omitted this repository's fragments. With the CLI there is no
composition to get wrong — the ops declares its own gates.

**Change:** keep both files' **output discipline**, which is the part worth preserving and easy to drop:
silent on success, actionable lines only on failure, `GATE_VERBOSE=1` for the full run. The reason is
written in their headers and still holds — a commit made through a tool call puts every printed line into
a conversation that carries it for the rest of the session. `scripts/check.sh` keeps printing the summary
line on a clean run, because it was *asked for*; the hook stays silent.

### 3. Delete `scripts/checks/_run.sh` — P0

**What:** remove the file and the directory, which holds nothing else.

**Why:** it exists to solve a composition problem the CLI does not have, and its three-branch resolution
is the thing that broke.

**Change:** nothing is copied in to replace it — no runner snapshot, no fragment directory. Confirm
`.githooks/pre-commit` no longer sources it before deleting.

### 4. Declared population exclusions — P1

**What:** express the `links` exclusion as `settings.<ops>.ignore` naming the trees and their reasons,
rather than one blanket disablement.

**Why:** a disabled check reports nothing about anything, so a **newly** broken link under `project/` —
the exact regression Plan-001's success criteria call out by name — would be invisible for as long as the
disablement stood. An excluded population still reads everything else.

**Change:** the trees, with reasons that must survive into the config:

| Glob | Reason |
|---|---|
| `dsl/**` | link rot with causes unrelated to governance; belongs to whoever next edits that tree |
| `docs/**` | same |
| `dogfood/**` | write-once dated snapshots, never retro-corrected — `.agents/rules/dogfood.md` |

`budget` stays declared off, with its reason and date, until Track 6 brings `AGENTS.md` back under 150.

### 5. Verification — P1

**What:** prove the gate runs, is green, and hides nothing.

**Change:**

```bash
bash scripts/check.sh                 # green
vibe-ops governance --audit           # no finding
vibe-ops agents-md --audit            # no finding
```

**Every `SKIP` must have its reason in the config.** A skip and a pass are indistinguishable in the
summary line, and this repository has already paid for that once: `skill-frontmatter` reported
`no skills/ directory` for months while two skills with frontmatter sat in `.agents/skills/`, because the
shell fragment looked in `$ROOT/skills`. Ten of seventeen fragments skip here and only that one has been
re-examined.

Then exercise the hook for real — a scratch commit, not a dry run, because the hook path and the manual
path have diverged before.

---

## Implementation order

```
P0:  1 (config) → 2 (rewire) → 3 (delete _run.sh)
P1:  4 (exclusions) → 5 (verification)
```

1 before 2 because the rewired entry points read the config. 3 after 2 so the gate is never absent
between commits. 4 before 5 or verification reports the exclusions as findings.

## Closing

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
