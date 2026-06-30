<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

> ⚠️ Point-in-time DSL usability snapshot (2026-06-23). NOT spec truth — may be obsolete. Source of truth: dsl/ + packages/.

# DSL Expressiveness Report — RFC Authoring Workflow

> **Context:** `rfc-author.description` + `rfc-author.behavior` model the `/new-rfc` skill
> as a dot-agent state machine. This document records what the DSL expressed cleanly and
> every place where the language had to be bent or could not express the intent at all.
> Each gap is a candidate RFC.

---

## What expressed cleanly

- **Linear workflow with two interactive checkpoints** — the five-state machine
  (`collect_topic` → `draft_sections` → `validate_impact_table` → `emit` → `done`)
  maps directly to the DSL state model. Each state's role is obvious at a glance.

- **Setup vs. oriented state distinction** — `draft_sections` and `emit` are pure setup
  states (no `interact`); `collect_topic`, `validate_impact_table`, `done`, and `error`
  are oriented states. The grammar enforces this cleanly with no extra syntax.

- **Error routing** — the `on failure` handler on `run script` provides a single
  authoritative exit to `state error`. The `error` state handles retry cleanly.

- **Self-loop for iterative correction** — `validate_impact_table` loops to itself on
  `on intent "corrections provided"`. This naturally models an iterative review loop
  without any looping construct in the language.

- **Agent public contract in `.description`** — `capabilities`, `input`, and `output`
  express the sandboxing contract precisely. The agent can be indexed without reading
  the behavior.

---

## Gaps & limitations

### G1 — No way to capture user input into session memory

**Problem:** The LLM collects the RFC topic and author name in `collect_topic`, but there
is no statement in `.behavior` to extract those values and store them as session variables.
`set session.topic = <user_input>` is not possible — `set` only accepts literal values,
not references to what the LLM just extracted from the user.

**Workaround used:** The `set session.topic_collected = true` flag was added and then
removed, because it conveyed no real information. The downstream script (`scaffold-rfc.js`)
would need to re-collect the values through some other channel (e.g., session memory
populated by the Runtime from the last LLM turn).

**RFC candidate:** *Input extraction statements* — a mechanism to bind fields from the
current LLM turn into session memory. Something like:
```
on intent "topic provided"
  extract session.topic from intent
  transition to draft_sections
```

---

### G2 — `set` inside `on intent` block handlers causes an AST mapper crash (bug)

**Problem:** Placing a `set` statement inside a block `on intent` handler causes the Rust
behavior-parser to fail with: `Failed to map tree to AST: data did not match any variant
of untagged enum IntentBody`. The grammar syntactically allows it (the `block` rule
includes `memory_stmt`), but the AST mapper cannot deserialize the result.

**Reproduction:**
```
on intent "foo"
  set session.flag = true     ← triggers E006 crash
  transition to bar
```

**Workaround used:** Removed all `set` statements from intent blocks.

**RFC candidate:** *Fix `set` in intent block handlers* — either the grammar should
restrict `set` from intent blocks (and the reference should document this), or the AST
mapper should handle it. This is an implementation bug, not a language design question.

---

### G3 — `on failure` must be on the same line as `run`

**Problem:** The `.behavior` reference documents `on failure` on the *next* line after
`run`:

```
run tool "booking.api"
  on failure
    transition to error
```

But the grammar requires `on failure` on the *same* line as `run` (no leading `_newline`
before `failure_stmt` in the `run_stmt` rule). Writing it on the next line produces E004.

**Workaround used:** Placed `on failure` on the same line:
```
run script "scripts/scaffold-rfc.js" on failure
  transition to error
```

**RFC candidate:** *Fix reference documentation for `on failure`* — either update the
grammar to allow `on failure` on the next line (matching the reference examples), or
update the reference to show the correct same-line form. ADR candidate too, since this
is a decision about syntax consistency.

---

### G4 — No string interpolation in `run script` parameter payload

**Problem:** `run script "foo.js" "session.topic"` passes the literal string
`"session.topic"` as params, not the resolved value of `session.topic`. The script
cannot receive session variables directly through the `run` statement.

**Workaround used:** The `draft_sections` and `emit` states call scripts with no
parameters. The scripts would need to read session state through a Runtime API, not
through the `run` statement's parameter string.

**RFC candidate:** *Parameterized `run` with memory interpolation* — allow session/context
variables to be referenced in the parameter payload:
```
run script "scaffold-rfc.js" session.topic
```
or with an explicit interpolation syntax. This pairs with G1.

---

### G5 — No way to signal a clean session end from `.behavior`

**Problem:** When the user cancels the RFC authoring flow, the natural response is to end
the session. `transition to ended` would be the semantic target (`ended` is a
Runtime-managed native state), but the linter treats it as E005 (undefined state) because
`ended` is not declared in the behavior file and does not contain a dot.

**Workaround used:** The `on intent "cancel"` handler transitions to `done` instead,
which loops on itself. This is semantically wrong — the session doesn't end, it just
stays in `done` forever.

**RFC candidate:** *Explicit native state allowlist in the linter* — the linter should
recognize `ended`, `online`, and `offline` as native Runtime states and suppress E005 for
them. Or the grammar/linter should provide a `transition to end` syntax that doesn't
require defining a state.

---

### G6 — No way to express "validate that all five impact cells are non-`?`"

**Problem:** The real validation logic for the impact table is: "do not advance until every
cell is `—`, `⚠️`, or `🔄`". This is a predicate over structured data. `.behavior`
can only express binary conditions (`if session.flag == true`). Checking five cells
individually would require five session variables and five `if` conditions — which is the
antipattern from `antipatterns.md` (Antipattern 1: complex logic in `.behavior`).

**Workaround used:** The validation state is oriented (goal + guide), relying on the LLM
to perform the check conversationally. The `on intent "corrections provided"` loop lets
the user iterate until confirmed. This is semantically correct but not deterministically
enforced.

**RFC candidate:** This is not a language gap per se — it's the intended boundary between
`.behavior` and WASM. A script called from `validate_impact_table` could enforce the
constraint programmatically. The gap is that there is no mechanism to pass structured data
*back* from a script to the LLM for presentation (see G4).

---

### G7 — Description block order is fixed and undocumented

**Problem:** The `agent_decl` grammar requires blocks in a specific order:
`description → persona → behavior → capabilities → requires → input → output`.
Placing `input` before `capabilities` produces E004 with a confusing error message
("Syntax error near 'input ...'").

The DSL reference (`dsl/reference/description.md`) does not mention this ordering
constraint. The example in `examples/2. Fridge Assistant/src/agent.description` uses a
non-standard indented style that happened to work, which masks the issue.

**Workaround used:** Reordered blocks in `rfc-author.description` to match grammar order.

**RFC candidate:** *Document and enforce description block ordering* — add the ordering
constraint to `dsl/reference/description.md` with a clear explanation. Consider whether
the grammar should be relaxed to allow any order (a `choice` of all optional blocks
would require disambiguation via keyword lookahead).

---

## Parser & linter error-message quality

---

### D1 — E006 reports at line 1:1 with a Rust internal type name

**What the compiler emitted:**
```
E006 (line 1:1): Failed to map tree to AST: data did not match any variant
of untagged enum IntentBody
```

**What was actually wrong:** A `set` statement inside an `on intent` block handler (G2).
The grammar admitted it; the Rust AST mapper could not deserialize the result.

**Why the message was unhelpful:**

- `line 1:1` is the file start — no relationship to the actual failing line.
- `untagged enum IntentBody` is a Rust/serde implementation detail leaked into the
  user-facing error string. An author writing `.behavior` has no mental model of
  `IntentBody`.
- Because there was no location, the only way to find the offending line was binary
  search: copy one state at a time into a scratch file, lint it, repeat. With six states,
  this took six iterations.

**What would have been actionable:**
```
E006 (line 12): AST mapping failed in state "collect_topic", on-intent handler
"topic provided" — statement type "set" is not valid inside an intent block.
```

The mapper walks a known structure (state → body → handler → statements). It knows
which state it is processing when deserialization fails. Propagating that context to the
error string would make the problem immediately locatable.

**Pattern this experience points to:** Elm's "I got X but expected Y in this context"
format. The parser knows what it was trying to build when it failed; surfacing that —
rather than the name of the internal Rust type — gives the author a search term that
exists in the DSL reference, not in the Rust source.

---

### D2 — E004 `Syntax error near 'on failure'` with no correct-form hint

**What the compiler emitted:**
```
E004: Syntax error near 'on failure'
```

**What was actually wrong:** `on failure` was written on the next line after `run script`,
which is the form shown in the reference documentation. The grammar requires it on the
same line (G3).

**Why the message was unhelpful:**

- The error names the token it found (`on failure`) but not the token it expected, and
  gives no indication of where the form described in the docs differs from what the
  grammar requires.
- The reference docs show the next-line form; the grammar requires the same-line form.
  Nothing in the error message pointed toward placement — it looked like `on failure`
  itself was the problem, not its position.
- The fix (moving `on failure` to the end of the `run` line) was found only by reading
  the tree-sitter grammar source directly.

**What would have been actionable:**
```
E004 (line 8): Expected 'on failure' immediately after 'run script "..."'
(same line, before the newline). Found 'on failure' on the next line.

Correct form:
  run script "scripts/foo.js" on failure
    transition to error
```

This is not a large investment: the `run_stmt` production has `optional(failure_stmt)`
with no `_newline` in between. The parser already knows at the point of failure that it
was parsing a `run_stmt` and that the next token was `on` when it expected something
else. Emitting the correct form of that specific rule is a localized change.

**Pattern this experience points to:** rustc's `error[EXXXX]: expected X, found Y`
with a note showing the valid form. The grammar rule structure already encodes the
constraint; the question is whether the diagnostic layer surfaces it or swallows it into
a generic "syntax error near TOKEN" message.

---

### D3 — E004 `Syntax error near 'input ...'` implicates the wrong token

**What the compiler emitted:**
```
E004: Syntax error near 'input string "RFC topic — a short phrase..."'
```

**What was actually wrong:** The `input` block appeared before `capabilities` in
`rfc-author.description`. The `agent_decl` grammar requires a fixed block order:
`description → persona → behavior → capabilities → requires → input → output`. The
error named `input` as the problem token when the real issue was that `capabilities` was
expected at that position.

**Why the message was unhelpful:**

- The named token (`input`) is valid syntax and appears verbatim in the reference.
  The author's first inference is that something about the `input` block content is
  malformed — not that the block is in the wrong position.
- There is no mention of expected block order anywhere in the error or in
  `dsl/reference/description.md`.
- Discovering the root cause required reading the tree-sitter description grammar to
  find that `agent_decl` uses `seq()` with optionals in strict order — an invisible
  constraint with no documentation trail.

**What would have been actionable:**
```
E004 (line 14): Unexpected block 'input' — in a description file, 'capabilities'
must appear before 'input'.

Expected block order: description → persona → behavior → capabilities
                      → requires → input → output
```

The grammar's `seq()` encodes the constraint directly. A diagnostic pass over the
parsed tree that knows which blocks appeared and in what order could produce an exact
"X before Y" message rather than naming the first misplaced token as the offender.

**Pattern this experience points to:** This class of error — wrong order, not wrong
syntax — is better caught in a linter pass that sees the full block list than in the
tree-sitter parser that fails at the first unexpected token. The separation already
exists (E004 is tree-sitter; E005/E006/W00x are the JS linter and Rust mapper). A
linter rule that validates `agent_decl` block order post-parse could produce a targeted
message without touching the grammar.

---

### D4 — E004 and E006 share a code namespace, masking their different root causes

**Observation across all three incidents above:** E004 covers tree-sitter parse failures
(wrong token, wrong placement). E006 covers Rust AST mapper failures (grammar
admitted it, deserializer rejected it). These have fundamentally different causes and
different remediation paths, but from the author's perspective they look identical: a
code, a terse message, no source location for E006.

The consequence is that an author who hits E006 at line 1:1 and searches for "E006"
in the reference will find a description that reads like a syntax error — which it is not.
The actual fix path for E006 (remove the statement the mapper cannot handle, even though
the grammar allowed it) is not implied by anything in the error text.

**What would help:** Distinct sub-codes or a clear prose distinction in the error
message — "this is a grammar error" vs. "the file parsed but the AST mapper rejected it
at state X." The information is available at error-generation time; propagating it to the
message is a compiler change, not a grammar change.
