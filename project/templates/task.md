<!--
 TASK TEMPLATE — copy to tasks/<topic>.md and fill in.
 A task describes WHAT to build, for work already decided (lifecycle: .agents/rules/governance.md).
 If the design is still open, write an RFC first. Tasks are removed/archived once done.
 Delete these comments before committing.
-->

# Task: Title

| Field | Value |
|---|---|
| Status | Planned |
| Created | YYYY-MM-DD |
| Author | Your Name |
| Sources | <!-- links to the RFC, ADR, or status doc that motivates this work --> |

<!-- Status lifecycle: Planned → In Progress → Done → (file removed or archived) -->

---

## Context

<!-- Why this work exists and how the items below were identified. Note which items cross
     a frozen package boundary (flag them, e.g. 🧊 needs unfreeze decision). -->

## Priority overview

<!-- One row per work item. Priority gates ordering; effort sets expectations (XS/S/M/L). -->

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | … | … | S |

---

## Work items

### 1. Item title — P0

**What:** <!-- the concrete change, verified against source -->

**Why:** <!-- the consequence of not doing it -->

**Change:** <!-- the specific edit / approach -->

<!-- Repeat per item. -->

---

## Implementation order

<!-- The sequence, noting what can be parallel, what must batch (e.g. share one unfreeze
     window), and what gates a release. -->

```
P0:  …
P1:  …
P2:  …
```

## Closing

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.

<!-- close-task writes back to the doc that started this work, propagates to living docs, spawns an ADR
     if a decision emerged, routes each Surprises & Discoveries entry through the promotion test (and
     checks whether a new guard makes an existing instruction line redundant), then distills the summary
     + breadcrumb (git show <sha>:project/tasks/<topic>.md) into the issue before removing this dossier. -->
