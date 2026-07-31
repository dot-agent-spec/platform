<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Migrate License Headers to the One-Line SPDX Form

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | Standalone — not part of [Plan-003](../plans/003-pre-monorepo-fossil-cleanup.md), which covers pre-monorepo fossils and the dependency security baseline. Follows the `license-rules-simple` convention shipped by [`vibe-ops`](https://github.com/entelekheia-ai/vibe-ops) `/license-setup` ≥ 0.5.2 |

---

## Context

Every source file in this repository carries a 13-line Apache 2.0 prose block. Across 109 files that is
**1,417 lines of boilerplate** restating what [`LICENSE`](../../LICENSE) already says. The one-line SPDX
identifier is the current standard — machine-readable, and what `vibe-ops` `/license-setup` writes for a
non-fork repository:

```
// SPDX-License-Identifier: Apache-2.0
```

Per [ASF's own guidance](https://www.apache.org/legal/src-headers.html) the form carries **no per-file
copyright line**: it goes stale the moment anyone else touches the file. Copyright stays in `LICENSE`.

This repository already speaks SPDX in its manifests — every `Cargo.toml` declares
`license = "Apache-2.0"` — so only the file headers are out of step.

**Sequencing:** deliberately kept out of [PR #31](https://github.com/dot-agent-spec/platform/pull/31),
which had just stamped 18 files with the long form. Folding a 109-file rewrite into a PR whose story is
"broken hook → CI" would have buried `Closes #19` in mechanical noise.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Migrate 109 files to the one-line SPDX header | repo-wide | M |
| 2 | P0 | Replace the hand-rolled checker with the `vibe-ops` 0.5.2 template | scripts/ | S |
| 3 | P0 | Correct the exclusion list against what is actually tracked | scripts/ | S |
| 4 | P1 | Update the `## License rules` section | AGENTS.md | XS |
| 5 | P1 | Add the missing `license` field to the root manifest | package.json | XS |

---

## Work items

### 1. Migrate 109 files to the one-line SPDX header — P0

**What:** Replace the leading Apache prose block with `// SPDX-License-Identifier: Apache-2.0`.

**Why:** −1,192 lines of restated licence text, and the headers stop drifting from the manifests.

**Change:** A **one-time** migration, not a job for the maintained checker. The `vibe-ops` template only
ever *adds* a missing header — in the non-fork path it does `cat "$f"` after the SPDX line, so running it
here would have **stacked** the new line on top of the existing 13-line block. The old-block replacement
logic in that template is inside a `FORK_ONLY` region and is stripped for a non-fork repo.

Two header styles exist in this tree and the old checker accepted both, so neither was ever noticed:

| Style | Files |
|---|---|
| `//` line-comment run | 92 |
| `/* … */` block | 17 |

The migration must consume either form, preserve a shebang on line 1, and skip the exclusions in item 3.

### 2. Replace the hand-rolled checker with the 0.5.2 template — P0

**What:** Regenerate `scripts/ensure-license-headers.sh` from
`vibe-ops` `skills/license-setup/templates/ensure-license-headers.sh`, substituting the source globs, the
licence id and the exclusion cases, and stripping the `FORK_ONLY` blocks.

**Why:** The hand-rolled version written for [#19](https://github.com/dot-agent-spec/platform/issues/19)
converged on the same two key decisions the template already makes — `git ls-files` for discovery and a
`--check` mode — so keeping a local fork of it only invites drift. Converging on the shared source is the
point of the plugin.

**Note:** the template's check accepts `SPDX-License-Identifier|Copyright`, deliberately grandfathering
old blocks. After item 1 nothing in this repo relies on that, but it does mean a *new* file carrying only
a copyright line would pass. Accepted as the cost of using the shared template rather than a local fork.

### 3. Correct the exclusion list against what is actually tracked — P0

**What:** Reduce the exclusions from four to the two that are real:

| Exclusion | Verdict |
|---|---|
| `tools/wasi-stub/` | **Keep** — third-party (Arnaud Golfouse, `typst-community/wasm-minimal-protocol`); stamping it misattributes copyright |
| `generated-*` | **Keep** — `packages/compiler/src/generated-version.ts`, rewritten by its generator |
| `*/pkg/*` | **Drop** — wasm-bindgen output is gitignored, so `git ls-files` never yields it. Dead config |
| `*/bindings/*` | **Drop** — intended for ts-rs output, but the only tracked match is `packages/tree-sitter/bindings/rust/src/lib.rs`, a first-party hand-maintained file that **should** carry the header |

**Why:** The original four were written from assumption rather than a survey, and one of them actively
protected a file that should be migrated — it would have been left as the single long-boilerplate file in
an otherwise SPDX tree. `/license-setup` 0.5.2 Step 1 Q6 asks for exactly this survey; the hand-rolled
predecessor skipped it.

### 4. Update the `## License rules` section — P1

**What:** State the SPDX form, that there is **no per-file copyright line**, and the two exclusions.

**Change:** Keep the repo-specific facts the shared template has no way to know: the hook prohibition from
[#19](https://github.com/dot-agent-spec/platform/issues/19) and the `tools/wasi-stub/` warning. `AGENTS.md`
is over its 150-line budget, so this replaces rather than grows.

### 5. Add the missing `license` field — P1

**What:** Add `"license": "Apache-2.0"` to the root `package.json`.

**Why:** Every publishable sub-package declares it; the workspace root does not.

---

## Do not do

**Do not overwrite `LICENSE` from the template.** Its 160 lines of licence text are already byte-identical;
only the appendix differs. The template attributes collectively to *"The `<project>` Authors"*, while this
repo names the actual holder — and since item 1 removes the per-file copyright line, `LICENSE` becomes the
**only** place a copyright holder is named. Replacing it would erase attribution from a solo-authored
repository. This is an `adopt`, not a `migrate`.

---

## Implementation order

```
P0:  1 (migrate) → 3 (exclusions, which changes what 1 covers) → 2 (install template)
P1:  4 (AGENTS.md) → 5 (root license field)
```

Items 1 and 3 interleave: the first run of the migration used the wrong exclusions and left one file
behind, which is how the `bindings/` false positive surfaced.

## Acceptance

- Every tracked source file outside the two exclusions carries `// SPDX-License-Identifier: Apache-2.0`
  and no per-file copyright line; zero files retain the long block.
- `./scripts/ensure-license-headers.sh --check` exits `0`, and exits `1` on a headerless file — **both
  directions exercised**, since a gate that never fails is indistinguishable from no gate.
- Touching a file under `tools/wasi-stub/` does not make the check fail.
- `grep -n '{{' scripts/ensure-license-headers.sh` is empty and no `FORK_ONLY` marker survives.
- `npm run build` green and the full suite passes.
- `LICENSE` is unchanged.

## Closing

- [ ] Run `/vibe-ops:close-task` — write back to the source doc, propagate to living docs, route what the
      work taught, then distill and delete this dossier.
