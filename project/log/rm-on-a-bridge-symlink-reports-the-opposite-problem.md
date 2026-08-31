---
vibe-ops-template: log@2
name: rm-on-a-bridge-symlink-reports-the-opposite-problem
description: Deleting a .claude/ bridge symlink with rm leaves it staged in git, and the gate then reports
             a Windows core.symlinks=false checkout failure — the opposite of what happened.
kind: trap
path:
  - ".claude/**"
attempted: 2026-07-30
source: Plan-001 Track 1, `git show 71cbf9f0755b60278eaf0dae3efaa640b25a815a:project/plans/001-adopt-vibe-ops-baseline.md`
---

<!--
 Copyright (c) 2026 dot-agent Authors
 Licensed under the Apache-2.0 license — see LICENSE.
-->

# Removing a `.claude/` bridge symlink with `rm`

> **Not current truth.** This records what was attempted on 2026-07-30 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Retiring a skill from the `.agents/` ↔ `.claude/` bridge by deleting its symlink the obvious way:

```sh
rm -f .claude/skills/new-adr
```

## What happened

The gate reported a **different problem than the one that existed**:

```
.claude/skills/new-adr is a symlink in git but not on disk
  — checked out as text (core.symlinks=false)
```

That message names a Windows checkout problem: a machine where git cannot create symlinks and writes
them as text files instead. Nothing of the sort had occurred — the work was on macOS, and the symlink
had been deleted deliberately seconds earlier.

## The mechanism

`rm` removes the file from the working tree and nothing else. The symlink stays in git's index, so the
repository is in the state "tracked as a symlink, absent from disk". The bridge check tests exactly that
pair, and the only cause it names is the common one — a `core.symlinks=false` checkout. A deliberate
deletion produces the identical pair and therefore the identical message.

The message is not wrong about the state. It is wrong about the cause, and it is confident.

## What to do instead

```sh
git rm --cached .claude/skills/<name>    # drop it from the index too
```

Or `git rm` in one step, which removes it from both. After either, `git status` shows the deletion
staged rather than a phantom symlink.

**The general shape, which is the part worth carrying:** when the gate reports a bridge entry as
"checked out as text", check whether someone just deleted it before believing the platform diagnosis.
The two states are indistinguishable to the check, so the message can only ever name one of them.
