<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

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

## Gaps and limitations

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
