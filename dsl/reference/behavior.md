<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# The Behavior (`.behavior`)

The `.behavior` file defines an agent's logic through a deterministic state machine. It is the implementation — private to the agent.

For the interchange format produced by parsing this file, see [`docs/reference/behavior-file.md`](../../docs/reference/behavior-file.md).
For memory domain semantics, see [`dsl/reference/memory.md`](memory.md).
For design principles and state machine philosophy, see [`dsl/explanation/design-principles.md`](../explanation/design-principles.md).

---

## 1. Scope

### 1.1 Runtime-managed (read-only in `.behavior`)

| Item | Description |
|---|---|
| `session.is_first_time` | `true` on the user's first conversation with this agent |
| `session.prompt_count` | Number of LLM turns in the current session |
| `compaction_threshold` | Local context window management — set by Runtime |
| `permissions` | Filesystem, network, MCP access — enforced by Runtime |
| Native states: `online`, `offline`, `ended` | Lifecycle states managed by the Runtime |

### 1.2 Declarative scope (written in `.behavior`)

- **Required entry state: `init`** — the compiler enforces this (E016 lint error) and the kernel enters it by name at startup. `onboarding`, `responsive`, and any business state names are conventional; only `init` is mandatory.
- Arbitrary business states: `car_reservation`, `phases.planning`, etc.
- All orchestration: tools, subagents, scripts, memory, conditionals

---

## 2. State Anatomy

A state has an optional **setup phase** (imperative actions on entry) followed by an optional **oriented phase** (LLM interaction loop). Most states use one or the other; a state can combine both.

### 2.1 Oriented State (LLM interaction)

```
state car_reservation
  goal "Collect car reservation details from the user"
  guide "Ask for pickup date, return date, and car category. Confirm before proceeding."
  teach "car-categories.md"
  interact
  on intent "details confirmed" transition to payment
  on intent "cancel"            transition to responsive
  on offtopic                   transition to responsive
```

| Statement | Required | Position | Purpose |
|---|---|---|---|
| `goal "text"` | Yes | First | Orients the LLM on this state's objective |
| `guide "text"` | No | After `goal` | Detailed instructions for LLM behavior |
| `teach "filename"` | No | After `guide`, repeatable | Loads a knowledge file into LLM context |
| `interact` | Yes | Before handlers | Releases control to the LLM for a user turn |
| `on intent "..."` | Yes (one+) | After `interact` | Routes user intent to an action or block |
| `on offtopic` | No | Optional, last handler | Handles off-topic user turns |

> **Syntax model.** The grammar is keyword-driven: whitespace and line breaks are
> insignificant — structure is held by keywords and an explicit `end` that closes
> every multi-statement block (`if`, `on failure` block, `on intent`/`on offtopic`
> block, `after`, `parallel`). A single-action handler stays inline with no `end`.
> The grammar is deliberately permissive (order, uniqueness, and the oriented-state
> shape are enforced by the linter, not the parser); the formatter re-imposes the
> canonical layout shown in these examples.

### 2.2 Setup State (orchestration only)

```
state init_session
  set session.started = true
  run script "setup.js"
  transition to responsive
```

`goal`, `guide`, `teach`, and `interact` are **forbidden** in setup states. Only actions and `transition to` are allowed.

---

## 3. Statements Reference

### `goal` — LLM Orientation

```
goal "Collect car reservation details"
```

Required as the first statement in an oriented state. Injected into the LLM's message context as the state's objective.

### `guide` — LLM Instructions

```
guide "Ask for: pickup date, return date, car category. Always confirm before proceeding."
guide "instructions/car-rental.md"   // filepath form — loaded at runtime
```

Optional. Injected into message context after `goal`. Accepts inline text or a file path.

### `teach` — Knowledge Injection

```
teach "car-categories.md"
teach "pricing-rules.md"   // repeatable
```

Loads a file into the LLM's reusable cache (not context). Optional, repeatable.

### `interact` — LLM Turn

```
interact
```

Releases control to the LLM for a user turn. After the LLM responds, the Runtime evaluates the `on intent` handlers.

### `set` — Memory

```
set context.active_phase   = "planning"
set session.has_context    = true
set session.count         += 1
set localVar               = true   // local, not persisted
```

See [`dsl/reference/memory.md`](memory.md) for full semantics.

### `run` — External Execution

```
run script   "setup.js"
run subagent "reviewer.behavior" "context params"

run tool "booking.api" on failure transition to error   // inline, single action

run tool "booking.api"                                   // block, closed by end
  on failure
    run script "use-cache.js"
    transition to error
  end
```

Three targets: `script`, `subagent`, `tool`. Optional second quoted string is a parameters payload.

`on failure` is an optional error handler — either a **single inline action** (no `end`) or a **block** of actions closed by `end`. It is **catch-and-resume**: after the handler runs, execution falls through to the next statement, *unless* the handler `transition`s away. There is no `on success` — success is the implicit fall-through to the next statement.

### `apply` / `remove` — CSS

```
apply css "dark-theme.css" on failure transition to error

remove css "loading-overlay.css"
  on failure
    run script "restore.js"
  end
```

### `transition to` — State Change

```
transition to responsive
transition to phases.planning.start
```

Moves the machine to the named state. Dot notation for states imported via `merge`.

### `if / else / end` — Conditional

```
if session.plan_ready == true
  transition to review
else
  set session.needs_plan = true
  transition to planning
end
```

Conditions: comparison operators `==`, `!=`, `>`, `<`, `>=`, `<=`; logical operators `and`, `or`. Each `if` is closed by its own `end`, so conditionals may nest.

### `after N prompts` — Temporal

```
after 3 prompts
  set session.nudged = true
  transition to responsive
end
```

Fires after the specified number of LLM turns within the current state. The block is closed by `end`.

### `parallel` — Concurrent Execution

```
parallel
  run script "fetch-rates.js"
  run tool   "currency.api"
on failure
  transition to error
end
```

Runs the listed `run` statements concurrently. The runs inside a `parallel` do **not** carry their own `on failure` — group failure is handled by the parallel's optional `on failure` block. The block is delimited by the parallel's single `end`. There is no `on success`: success falls through after `end`.

### `merge` — Flow Composition

```
// preamble only — before any state declaration
merge "phases/planning.behavior"
merge "phases/review.behavior"
```

Imports all states from another `.behavior` file into the flat namespace. Must appear at the top of the file before any `state` declaration. Resolved at compile time (eager).

### `on event` — Global Trigger

```
on event "session.timeout"
  set session.active = false
  transition to ended
```

Top-level `on event` blocks fire independently of the current state, functioning as background observers.

---

## 4. Intent Handlers

Inside an oriented state, handlers appear after `interact`:

**Inline** (a single action — usually a transition):
```
on intent "confirm" transition to payment
on intent "log"     run script "log.js"
on offtopic         transition to responsive
```

**Block** (multiple statements, closed by `end`):
```
on intent "add item"
  set context.cart_item = "new"
  run tool "cart.api"
  transition to cart_updated
end
```

**`on offtopic`** fires when the LLM determines the user has shifted to a subject outside this state's domain — not an unmatched intent, but a genuine change of topic. It is optional. The interact loop does not stop for unmatched intents; it continues until one matches.

**`on failure`** fires on runtime errors (tool unavailable, external agent unreachable, script error). Not triggered by unmatched intents. It is catch-and-resume (see `run` above).

---

## 5. IDE Tooling Requirements

IDE or tooling implementing `.behavior` support **must** resolve file paths in string literals as clickable document links (underline on hover), navigating relative to the workspace root.

Resolvable path positions:
- `merge "<file>"`
- `run script "<file>"`
- `teach "<file>"`
- `guide "<file>"`
