---
description: How a skill or subagent file under .agents/ is kept alive — the self-improvement loop each one carries, and what a pass may and may not change.
paths: [".agents/**"]
---

## Keeping a skill or subagent alive

Every file under `.agents/skills/` and `.agents/agents/` **MUST** end with a
`## Self-improvement loop — keep this file alive` section, and running it is part of the task rather than
an optional epilogue. Copy the shape from
[`../agents/cli-helper-agent-sync.md`](../agents/cli-helper-agent-sync.md) or
[`../skills/sync-implementation-status/SKILL.md`](../skills/sync-implementation-status/SKILL.md).

**A fact hardcoded in an instruction file rots silently, and a rotted file is worse than a missing one —
it reads as authority.** `sync-implementation-status` carried a node-name discrepancy map whose five
entries were *all* stale, so it would have mis-mapped grammar nodes on every run. **Deleting a stale local
copy and pointing at the live source is the highest-value edit a pass can make**, and it **SHOULD** be
looked for first.

- A pass **SHOULD** correct a stale assumption rather than append a paragraph. These files stay the same
  length after ten runs and get more accurate; growth is the signal that corrections are being avoided.
- Session-specific detail — line numbers, versions, today's diff — **MUST NOT** be written into the file.
  It belongs in the report and the commit message.
- Frontmatter **MUST NOT** be touched in a self-improvement pass, on the same principle that an existing
  subagent's `model` is never changed: the caller sized the run against what was declared.
- The report **MUST** say whether the file changed, so the edit shows up in `git diff`. A silent
  self-rewrite is not permitted.

## Choosing the model tier

Match the tier to the task — strongest for judgment-heavy work, mid for structured execution, cheap for
mechanical. Use `inherit` when unsure, which is also the default when the field is absent. The `model` of
an **existing** subagent **MUST NOT** be changed. Rationale and reversal plan:
[DA00-03](../../project/adr/DA00-03-model-tiering-for-agent-routing.md).

## Do not fork the governance skills

Records are opened and closed with the [`vibe-ops`](https://github.com/entelekheia-ai/vibe-ops) plugin,
which reads *this* repository's `project/templates/` and numbering. Those skills **MUST NOT** be copied
into `.agents/skills/`. A local copy is what rotted the previous `/new-adr`: it searched a pre-`project/`
path for a numbering scheme this repository had abandoned, and failed silently, because a scaffold that
finds nothing starts at 1. `.agents/skills/` is for what exists nowhere else.
