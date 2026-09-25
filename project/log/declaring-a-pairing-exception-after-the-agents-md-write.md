---
vibe-ops-template: log@2
name: declaring-a-pairing-exception-after-the-agents-md-write
description: A nested AGENTS.md that must stay unpaired was written before its pairing exception was
             declared, and the authoring hook created the sibling CLAUDE.md the repository had ruled out.
kind: trap
path:
  - "plugins/claude/AGENTS.md"
  - "project/rfcs/AGENTS.md"
  - "vibeops.config.ts"
attempted: 2026-08-13
source: Plan-001 Track 1, `project/plans/shipped/001-adopt-vibe-ops-baseline.md`
---

<!--
 Copyright (c) 2026 dot-agent Authors
 Licensed under the Apache-2.0 license — see LICENSE.
-->

# Writing an `AGENTS.md` that must stay unpaired before declaring its pairing exception

> **Not current truth.** This records what was attempted on 2026-08-13 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Editing `plugins/claude/AGENTS.md` — a file the repository had already ruled must never get a sibling
`CLAUDE.md` — and adding the exception to `vibeops.config.ts` afterwards.

`/vibe-ops:authoring-agents-md` (vibe-ops@0.0.1, plugin, unreleased) carries a `hooks:` block that
creates the sibling `CLAUDE.md` after every `AGENTS.md` write.

## What happened

The write produced one line of hook output:

```
fixed plugins/claude/CLAUDE.md — created, containing @AGENTS.md
```

That file must not exist there. A Claude Code plugin has no build and no `files` allowlist, so
`plugins/claude/` is copied byte for byte into every user's `~/.claude/plugins/cache/`: a `CLAUDE.md` at
a plugin root ships to every install while never loading as project context, and
`claude plugin validate` warns about it. `plugins/claude/AGENTS.md` says exactly that in its own second
paragraph, and `.agents/rules/plugin-claude.md` repeats it as a `paths`-scoped rule.

Adding the path to `settings["agents-md"].ignore.pairing` in `vibeops.config.ts` and re-writing the same
file produced no repair.

The hook is silent on success, so the only signal that a file shipped to every user had been created was
that one `fixed` line.

## The mechanism

The hook reads the config and does not read prose. Both halves are established: the second write, with
the declaration in place, repaired nothing; the first write, with the same prose already in the file it
was writing, repaired anyway.

The order is the whole trap. A declaration added after the write does not undo the file the write
created.

## What to do instead

Put the path in `settings["agents-md"].ignore.pairing` in `vibeops.config.ts`, with the reason, **before**
the first write to an `AGENTS.md` meant to stay unpaired. Two are declared there today —
`plugins/claude/AGENTS.md` and `project/rfcs/AGENTS.md`; a third nested file left unloaded on purpose,
because a `paths`-scoped rule covers it instead, has the same exposure.

After any run of `/vibe-ops:authoring-agents-md`, read `git status` for a `CLAUDE.md` nobody intended.
