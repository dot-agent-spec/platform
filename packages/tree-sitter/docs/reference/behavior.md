# The Behavior (.behavior)

The `.behavior` file defines the agent's logic, state machine, and interaction flow.

## 1. Runtime vs. User Scope

`.behavior` divides responsibility between what the engine enforces and what the agent developer declares.

**Closed scope (managed by the Runtime, not writable by the user):**
- `compaction_threshold` — local context window management
- `permissions` — access control to filesystem, network, MCP servers
- Built-in variables: `session.is_first_time`, `session.prompt_count`
- Native states: `online`, `offline`, `ended`

**Declarative scope (written in `.behavior`):**
- Overriding `init`, `onboarding`, and the default `responsive` state
- Creating arbitrary business states (e.g., `phases.planning`)
- Deterministic orchestration: tools, subagents, scripts, conditional evaluation

## 2. Memory Domains

`.behavior` tracks state across four semantic scopes:

| Domain | Lifetime | Use |
|---|---|---|
| `context` | Current LLM turn | Active working memory for the model |
| `session` | Current conversation thread | Cross-turn conversation state |
| `worksession` | Current work unit | Task-scoped data |
| `user` | Long-term, persistent | User preferences and history |

```flow
set context.active_phase   = "planning"   // cleared after this turn
set session.has_context    = true         // cleared when thread closes
set worksession.phase      = "review"     // cleared when work unit ends
set user.language          = "pt-br"      // persists across all conversations
```

## 3. Flow Composition via `merge`

`.behavior` files can include states from other `.behavior` files using `merge`:

```flow
// preamble — before any state declaration
merge "phases/planning.behavior"
merge "phases/review.behavior"

state responsive
  interact
  on intent "planning" transition to phases.planning.start
  on intent "review"   transition to phases.review.start
```

`merge` is **preamble-only**: it must appear at the top of the file, before any `state` declaration. It is resolved at compile time (eager). All states from the merged file enter the **same flat namespace** as if they had been written inline — there is no state hierarchy at runtime.

## 4. State Anatomy

Every `.behavior` state is one of two types: **oriented** (with LLM interaction) or **setup** (pure orchestration).

### Oriented State

An oriented state guides the LLM before releasing it to respond. The structure is strict:

```flow
state car_search
  goal "Help the user find available cars"
  guide "Ask about destination, dates, and vehicle preferences."
  teach "premium_features.md"
  interact
  on intent "select_car" transition to reservation
  on fallback
    transition to responsive
```

**Semantics:**

- **`goal "..."`** — injected into the **message context**: the objective the LLM should accomplish.
- **`guide "..."`** — injected into the **message context**: behavioral instructions for this interaction.
- **`teach "..."`** — fills the LLM's **reusable cache** (e.g., markdown knowledge files). Persistent across turns for this state.
- **`interact`** — mandatory after orientation; releases LLM control to generate a response.
- **`handler+` (≥1 required)** — `on intent`, `on fallback`, `on offtopic` after interact. Prevents FSM deadlock.

### Setup State

A setup state performs pure orchestration without LLM interaction:

```flow
state prepare_data
  run script "fetch_available_cars.sh"
  set context.cars = payload
  transition to car_search
```

**No keywords inside setup states:** `goal`, `guide`, `teach`, `interact` are forbidden. Only actions: `run`, `set`, `apply`, `remove`, `transition`, and control flow (`if`, `after`, `parallel`).

## 5. Handler Statements

Handlers are the **case statements** of the state machine. They execute *after* `interact` to route the LLM's response.

| Handler | Trigger | Must provide |
|---|---|---|
| `on intent "phrase"` | LLM-interpreted user intent matching the phrase | A block or `transition to` |
| `on fallback` | Runtime cannot resolve required actions | A block or `transition to` |
| `on offtopic` | User conversation drifts from current task | A block or `transition to` |

Handlers can be inline for simple transitions:
```flow
on intent "confirm" transition to payment
on fallback transition to support
```
Or use a block for multiple actions:
```flow
on intent "retry"
  set session.retries += 1
  transition to retry_state
```

## 6. Actions

### Run
Executes a script, subagent, or tool. Supports optional labels for UI display and modifiers for execution mode.

```flow
run script "process.sh" "Processing data..."
run subagent "analyst" silent
run tool "search" in background
```

### UI Manipulation
The `apply` and `remove` statements allow the agent to modify the UI environment:

```flow
state show_results
  apply html "results_table.html"
  apply css "styles.css"
  interact
  on intent "close"
    remove html "results_table.html"
    transition to responsive
```

Supported targets: `css`, `html`, `video`.

## 7. Design Philosophy

- **Flat states only — no hierarchical nesting.**
- **Procedural guards — not declarative.** `if / else` inside a state.
- **Entry actions only — no exit actions.**
- **Global observers replace orthogonal states.** `on event` at top level.

## 8. IDE Tooling

Any IDE or tooling implementing `.behavior` support **must** resolve file paths in string literals that follow standard actions (e.g., `merge`, `run script`, `guide`, `teach`). These should be rendered as clickable document links.
