<!--
 PLAN TEMPLATE — copy to plans/<NNN>-<slug>.md. Numbering is plain NNN, NOT the DA scheme
 (that is for ADRs and pre-release logs only) — see .agents/rules/governance.md.
 A plan answers "how do we build X?". An RFC asks "should we, and how?"; a task is ephemeral.
 A plan is PERMANENT: it stays as the design record after the work ships.

 A plan is a LIVING DOCUMENT. The four sections below the divider are not written at the end — they are
 maintained while the work happens, and a plan whose Progress does not match reality is a bug.

 Write PROSE. Prefer sentences over bullet lists in the narrative sections; checklists belong in Progress
 and nowhere else. (This is the deliberate inverse of AGENTS.md, which is a map and not a narrative.)

 Write SELF-CONTAINED. Assume a reader who has only the current working tree and this one file: no memory
 of prior plans, no other context. Name files by full path. Define any non-obvious term where you first
 use it. Never write "as decided previously" or "see the architecture doc" — say the thing here.

 Delete these comments before committing.
-->

# Plan-NNN: Title

| Field | Value |
|---|---|
| Status | Backlog |
| Created | YYYY-MM-DD |
| Author | Your Name |
| Depends on | <!-- Plan-MMM / RFC-MMMM, or remove this row --> |
| Tracking issue | <!-- #NNN — owns status and the executive summary; this file owns the design and the working record. Remove this row if the plan has no issue. --> |
| Related | <!-- ADRs, RFCs, issues, or remove this row --> |

<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted; it is the record. -->

---

## Summary

<!-- One paragraph, plain terms: what this plan delivers and why now. No technical detail yet. -->

## Goals

<!-- 3–5 concrete outcomes. What does "done" look like, stated so someone else could check it? -->

## Scope

### In scope

### Out of scope

<!-- Name what a reader would reasonably assume is included but isn't, and where it lives instead. -->

## Design

<!-- How it works, in prose. Name the files and modules by full path. If a decision here is hard to
     reverse, it belongs in an ADR — record it in the Decision Log below and link the ADR. -->

## Tracks

<!-- The work, broken into independently verifiable units. Introduce each with a short paragraph: its
     scope, what will exist at the end that did not exist before, and the acceptance you expect to
     observe. A track is a story — goal, work, result, proof — not a bureaucratic heading. -->

## Success criteria

<!-- How anyone verifies the plan delivered. Commands to run and what their output should show. -->

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Progress

<!-- The only section where checklists are mandatory. Record EVERY stopping point, even if that means
     splitting a partially finished item into what is done and what remains. This must always reflect
     the actual current state of the work. Timestamps make the rate of progress visible. -->

- [ ] Example step.
- [ ] Example partially completed step (done: X; remaining: Y).
- [ ] Run `/vibe-ops:close-plan` — retrospective, route every Surprises & Discoveries entry, demotion
      check, close the tracking issue. The plan file itself is kept. Stays unchecked until the plan is
      actually closed; a Progress list that is otherwise complete but has this box open is not finished.

## Surprises & Discoveries

<!-- Unexpected behavior, bugs, wrong assumptions, or insights found while implementing — with concise
     evidence. This is the section that feeds the repo's durable knowledge at closure; an empty one on a
     finished plan almost always means it was not kept up, not that nothing surprised anyone. -->

- Observation: …
  Evidence: …

## Decision Log

<!-- Every decision made while working the plan, including the ones that seemed small. If a decision is
     hard to reverse, also write an ADR and link it here. -->

- Decision: …
  Rationale: …
  Date / Author: …

## Outcomes & Retrospective

<!-- Filled at each major track completion and at the end: what shipped, what was cut, what is still
     open, and how the result compares to the original purpose above. -->

---

## Open questions

<!-- Genuinely unresolved. Remove the section if there are none — do not pad it. -->

## Related

<!-- RFCs, ADRs, issues, other plans. -->
