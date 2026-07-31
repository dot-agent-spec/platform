<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-DA00-09: Orientation Statements Require an Oriented State

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-31 |
| Deciders | Danilo Borges |

---

## Context

The `cli-helper-agent-sync` review that produced [platform#25](https://github.com/dot-agent-spec/platform/pull/25)
found `apps/dot-agent-cli/helper-src/knowledge/gen-patterns.md` and `dsl-states.md` teaching `guide`
inside an `on intent`/`on offtopic` handler body — a shape the grammar does not accept
(`packages/tree-sitter/tree-sitter-behavior/grammar.js:105-133`: a handler body is built from
`_action` alone, which excludes `guide_stmt`/`teach_stmt`; only `state_body` admits them). Filed
separately as [platform#15](https://github.com/dot-agent-spec/platform/issues/15), with the parser's
silent mis-parse of the same shape as [platform#14](https://github.com/dot-agent-spec/platform/issues/14).

Fixing the two examples exposed a question that turned out to already have a canonical answer the review
had not yet consulted. [`dsl/reference/behavior.md` §2](../../dsl/reference/behavior.md#2-state-anatomy)
already names exactly this split — **Oriented State** (`goal`/`guide`/`teach`/`interact`) versus
**Setup State** (orchestration only; those four statements "are **forbidden**") — and states plainly that
"the oriented-state shape [is] enforced by the linter, not the parser." That is the language's settled
answer; nothing here proposes new naming.

What §2 does not settle is how *thoroughly* the linter enforces it. Today only half of the pairing is
checked, and only in the linter, not the grammar or the kernel:

- `packages/compiler/src/linter.ts:263-283` emits **W012** (`goal` without `interact`) and **W013**
  (`interact` without `goal`) — `goal` and `interact` are already a checked pair.
- `guide` and `teach` have no such check. `hasInteract`/`hasGoal` are computed once per state
  (`linter.ts:263-264`) and never referenced by any `guide_stmt`/`teach_stmt` rule.
- The kernel enforces none of it. `Fsm::exec_single` (`packages/kernel-dsl/src/engine/fsm.rs:185-193`)
  emits `Effect::Goal`/`Effect::Guide`/`Effect::Teach`/`Effect::RequestInteract` independently — a
  `guide` with no `interact` in the same state emits its effect and the FSM simply continues to the next
  statement. Nothing pauses, nothing errors.
- Two `interact` in the same state are equally unchecked: `exec_entry_statements`
  (`fsm.rs:69-89`) walks every statement in a state and each `Statement::Interact` produces its own
  `Effect::RequestInteract` (`fsm.rs:191-193`) — a state with two `interact` emits two
  `request_interact` in the same entry batch, with no dedupe and no diagnostic anywhere.

So the review could not simply document current behavior — there is no single current behavior to
document. What decided the matter was checking what the project has actually *built*, not what it has
said: every real `.behavior` file already implements one specific shape.

| Artifact | Orientation vs. `interact`, by state |
|---|---|
| `examples/3. Master Gardener`, `examples/4. Car Renting` | Every state pairs orientation with `interact`. |
| `examples/1. Text Summary`, `examples/2. Fridge Assistant` | Same, except `init`, which carries no orientation at all — a Setup State. |
| `apps/dot-agent-cli/templates/agent.behavior` (the `init` scaffold) | Same pattern: `init` is a Setup State, `responsive` pairs `goal` + `interact`. |
| `apps/dot-agent-cli/helper-src/helper.behavior` (pre-#25) | The one outlier: all 14 states carry `guide` (12 also `teach`), none carries `interact` or `goal`. |

The four example agents and the CLI's own scaffold — everything a new author is pointed at except the
helper itself — already converge on one idiom. The helper drifted from it, and is also the one artifact
that teaches new authors how to write a `.behavior` file. That combination is what turns this from "nice
to name" into "necessary to fix before shipping the fix for #15."

## Decision

We adopt `dsl/reference/behavior.md` §2's existing terms as binding, not just descriptive: an **Oriented
State** declares `interact`, exactly once, and only an Oriented State may carry `goal`, `guide`, or
`teach`. A state without `interact` is a **Setup State** — orchestration only (in the surface this
helper teaches, `on intent`/`on offtopic` handlers doing nothing but `transition to`; the language at
large also allows `set`/`run`/other actions there), no orientation statements of its own.

This is a **definition, not a grammar change** — §2 already says so ("the oriented-state shape [is]
enforced by the linter, not the parser"). The grammar continues to accept the shapes it accepts today —
`state_body` stays a flat, permissive `repeat1(choice(...))` (`tree-sitter-behavior/grammar.js:105-113`),
the same design note there already explains why: "the linter validates the legal shape per state type."
What this ADR adds to §2 is the missing half of that validation's spec — see Consequences — plus a
record that `apps/dot-agent-cli/helper-src/` (the one artifact that teaches this shape to new authors)
now actually complies. It governs every milestone (`DA00-xx`), not one language version, because it is a
property of the FSM model itself, not of any one grammar revision.

Enforcement — a new lint generalizing W012 to `guide`/`teach`, plus a lint for duplicate `interact` in
one state — is **out of scope for this ADR** and tracked as follow-up work (see Consequences). This
record fixes the definition and brings documentation and the helper into line with it; the linter and
kernel keep their current, non-enforcing behavior until that follow-up lands.

## Options considered

- **Option A — Leave it undefined, fix only the two examples #15 names.** Pro: smallest possible diff.
  Con: does not answer the question the #15 fix itself raises — *why* is `guide` state-level-only, and
  what should replace the deleted handler-level `guide`? Every other example and the CLI scaffold already
  encode an answer; declining to write it down just means the next drift goes unnoticed a second time,
  which is the exact failure mode `[platform#20]`(https://github.com/dot-agent-spec/platform/issues/20)
  exists to fix.  (rejected)
- **Option B — Require `interact` in every state, no exceptions.** Pro: simplest possible rule, no
  Setup State carve-out to explain. Con: contradicts §2's own existing spec and what's already shipped —
  `init` in `examples/1`, `examples/2`, and the CLI's own `templates/agent.behavior` scaffold is a Setup
  State with no orientation and no `interact`, and forcing it to pause on entry would be a behavior
  change to code that already works correctly. (rejected)
- **Option C — Couple `guide`/`teach` to `interact` in the grammar, not just the linter.** Pro: makes
  the shape unrepresentable instead of merely discouraged. Con: `state_body`'s flatness is deliberate
  (per the grammar's own comment) so the linter can give the specific, actionable W012/W013-style
  message instead of a generic parse error — the exact problem `[platform#14]`(https://github.com/dot-agent-spec/platform/issues/14)
  describes for the handler-level case. Overturning that design is a bigger change than this ADR is
  about, and the docs/helper fix does not require it. (rejected)
- **Option D (chosen) — Bind §2's Oriented-State/Setup-State split as enforceable, and record it as
  settled rather than re-deriving it.** Pro: zero behavior change to any passing artifact (the four
  examples and the scaffold already comply with §2); makes the existing spec citable as the reason
  `[platform#15]`(https://github.com/dot-agent-spec/platform/issues/15)'s fix is correct, instead of an
  implicit "what the examples do"; the helper's own conversion into Oriented States now has a spec to
  point at. Con: enforcement beyond the existing W012/W013 pair doesn't exist yet, so until the follow-up
  lands, the `guide`/`teach` half and the duplicate-`interact` gap are convention backed by review, not
  by tooling.

## Consequences

`apps/dot-agent-cli/helper-src/helper.behavior`'s 14 states move from "documented drift" to
"convention, unenforced" — they gain `goal` + `interact` in the same PR that adopts this ADR
(platform#25), so the gap closes immediately for the one artifact that had it, rather than staying open
for a later cycle.

`apps/dot-agent-cli/helper-src/knowledge/dsl-states.md` can now teach the same "Oriented State" /
"Setup State" split §2 uses, instead of enumerating what's forbidden — the Setup State shape (`init`
with no orientation, handlers that only `transition to`) becomes an equally-named, equally-legal
alternative rather than an unstated exception.

The linter and kernel are unchanged by this ADR. Two concrete gaps stay open until the follow-up work:
`guide`/`teach` without `interact` produce no diagnostic (only `goal` does, via W012), and a state with
two `interact` silently emits two `request_interact` effects in one entry batch
(`fsm.rs:69-89`, `191-193`) with no dedupe and no lint — undefined behavior at the host layer. Tracked
as a follow-up issue: generalize W012 to cover `guide`/`teach`, and add a new lint for duplicate
`interact`. Both fit the same block in `linter.ts:263-291` that already computes
`hasInteract`/`hasGoal`.

## Related

- [`dsl/reference/behavior.md` §2](../../dsl/reference/behavior.md#2-state-anatomy) — the canonical
  definition of Oriented State / Setup State this ADR binds and extends; not superseded, not restated,
  cited as prior art.
- [platform#15](https://github.com/dot-agent-spec/platform/issues/15) — the doc defect that forced this
  ADR to consult §2 in the first place; fixed in the same PR that adopts it.
- [platform#14](https://github.com/dot-agent-spec/platform/issues/14) — the parser mis-parse that made
  #15's invalid example fail silently instead of loudly; motivates keeping the check in the linter
  (Option C, rejected) rather than the grammar.
- [`packages/compiler/src/linter.ts`](../../packages/compiler/src/linter.ts) — W012/W013, the existing
  half of this rule, and where the follow-up lints belong.
- [`packages/kernel-dsl/src/engine/fsm.rs`](../../packages/kernel-dsl/src/engine/fsm.rs) — confirms the
  kernel enforces none of this; the rule is definition-and-lint, not a runtime guarantee.
- [`apps/dot-agent-cli/helper-src/knowledge/dsl-states.md`](../../apps/dot-agent-cli/helper-src/knowledge/dsl-states.md) —
  where the Oriented State / Setup State split is taught to agent authors.
