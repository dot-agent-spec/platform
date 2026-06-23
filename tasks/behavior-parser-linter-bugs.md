<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Behavior parser & linter bugs (from DSL dogfood)

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-23 |
| Author | Danilo Borges |
| Sources | [`dogfood/EXPRESSIVENESS.md`](../dogfood/EXPRESSIVENESS.md) (gaps G2, G3, G5) · [implementation-status.md](../docs/explanation/architecture/implementation-status.md) freeze status |

---

## Context

Surfaced while modeling the `/new-rfc` skill as a `.behavior` (a DSL dogfood pass). Three of the
reported gaps are **bugs**, not language-design questions — the grammar/reference accept a form that the
parser or linter then rejects or crashes on. They cluster in the same fragile area (`_newline` handling
in `run_stmt`, AST deserialization, linter state-name completeness) as the known trailing-newline issue.

Each item below was checked against the DSL reference. Items crossing a **frozen** package boundary are
flagged `🧊` — batch them with the parser-dsl unfreeze already planned in
[`pre-public-consolidation.md`](pre-public-consolidation.md) (C1 + C6).

---

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| L1 | **P0** — quick win, no unfreeze | `transition to ended` rejected as E005 despite being a documented native state | compiler | XS |
| L2 | **P1** — crash on valid-looking input 🧊 | `set` inside an `on intent` block crashes the AST mapper | parser-dsl | S |
| L3 | **P1** — docs contradict parser 🧊 | `on failure` on the next line after `run` is rejected (E004) | tree-sitter, parser-dsl | S |

---

## Work items

### L1. Linter rejects native states (`ended`/`online`/`offline`) — P0

**What:** `transition to ended` raises E005 ("undefined state"). But `dsl/reference/behavior.md:31`
documents `online`, `offline`, `ended` as **native lifecycle states managed by the Runtime**, and
`dsl/reference/behavior.md:210` uses `transition to ended` as a valid example.

**Why:** The linter contradicts the reference — documented, correct behavior is flagged as an error.
This forced a semantically wrong workaround in the dogfood (`transition to done` self-loop instead of
ending the session).

**Change:** Add `online`, `offline`, `ended` to the linter's allowlist of known target states so E005 is
suppressed for them. Compiler is active (🔥) — no unfreeze needed. Add a lint test covering each.

### L2. `set` inside an `on intent` block crashes the AST mapper — P1 🧊

**What:** A `set` (`memory_stmt`) inside a block-form `on intent` handler makes the behavior parser fail
with: `Failed to map tree to AST: data did not match any variant of untagged enum IntentBody`. The
grammar's `block` rule admits `memory_stmt`, but the `IntentBody` untagged enum cannot deserialize it.

**Reproduction:**
```
on intent "foo"
  set session.flag = true     ← crash
  transition to bar
```

**Why:** The grammar accepts syntax the AST cannot represent → a hard crash on input that looks valid.
Silent, surprising failure class.

**Change:** Decide the intended semantics and align grammar + AST:
- (a) extend the `IntentBody` AST variant to accept memory/`set` statements, **or**
- (b) restrict the grammar so `set` is not allowed inside intent blocks, and document the restriction.

Crosses frozen **parser-dsl** — batch with the C1/C6 unfreeze window.

### L3. `on failure` on the next line after `run` is rejected — P1 🧊

**What:** The reference shows `on failure` on the line *after* `run` (`dsl/reference/behavior.md:133-134`,
`189-190`), but the `run_stmt` grammar requires `on failure` on the **same line** (no optional
`_newline` before `failure_stmt`). The documented form yields E004.

**Reproduction (per the reference, but rejected):**
```
run script "scripts/scaffold-rfc.js"
  on failure
    transition to error
```

**Why:** Users following the reference hit E004. Same `_newline` fragility family as the known
trailing-newline bug in `run_stmt`.

**Change:** Make the parser accept the documented form — add the optional `_newline` before
`failure_stmt` in `run_stmt` so the next-line/indented form parses (this also matches how
`apply`/`remove`/`parallel` document `on failure`). Alternatively, if same-line is the intended
canonical form, update the reference instead — but the next-line form is the documented norm, so prefer
fixing the grammar. Crosses frozen **tree-sitter** + **parser-dsl**.

---

## Implementation order

```
P0:  L1 (linter native-state allowlist) ─ compiler only, independent, ship now

P1:  L2 + L3 ─ batch under the parser-dsl / tree-sitter unfreeze window
              shared with pre-public-consolidation.md C1 (on failure on apply/remove)
              and C6 (dead AST nodes) — freeze once, fix all four
```

L1 is a self-contained quick win on an active package. L2 and L3 cross frozen grammar/parser boundaries
and should ride the single unfreeze window already planned for C1/C6, so the grammar is opened once.
