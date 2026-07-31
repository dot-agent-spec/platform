# State anatomy: statements and handlers

```
state <name>
  <orientation statements>
  on intent "<intent-name>"
    transition to <state>
  on intent "<other-intent>"
    transition to <state>
  on offtopic
    transition to <state>
```

## Two kinds of state

A state is either an **Oriented State** or a **Setup State** — pick one, don't mix:

- **Oriented State** — declares `interact` (exactly once) and may carry `goal`, `guide`, `teach`.
  Orientation statements are state-level only: they fire once, on entry, and are what the LLM
  reads before pausing for input.
- **Setup State** — no `interact`, no orientation. Its `on intent`/`on offtopic` handlers do
  nothing but `transition to`, moving straight to whichever state handles the topic.

`goal`/`guide`/`teach` outside an Oriented State, or two `interact` in the same state, are not
valid shapes — every pattern in `gen_patterns` is one or the other, never a mix.

## Orientation statements

State-level only — never inside a handler body.

| Statement | Syntax | Effect emitted | Description |
|---|---|---|---|
| `goal` | `goal "text"` | `goal` | Sets the LLM's current objective — pairs with `interact` (W012 if `goal` has no `interact`; W013 the other way round) |
| `guide` | `guide "text"` | `guide` | Instruction or context — use it immediately |
| `teach` | `teach "filename.md"` | `teach` | References a knowledge file by name |
| `interact` | `interact` | `request_interact` | Pauses — agent is waiting for user input; marks the state an Oriented State |

## Handlers

| Handler | Description |
|---|---|
| `on intent "name"` | Fires when the kernel receives this intent in the current state |
| `on offtopic` | Fires when no intent matches |

A handler body holds actions, not orientation — `transition to <state>` is the one this helper
teaches. Moving to an Oriented State re-enters it, firing its `goal`/`guide`/`teach` immediately.

## Notes

- State names must be unique across merged files (E015 if duplicate)
- `init` is the required entry state (E016 if missing)
- A Setup State with no handlers is valid — it's a terminal state
- An Oriented State needs at least one `on intent` handler (E009 otherwise)

## Example

```
state example
  goal "Current LLM objective — incorporate this."
  guide "Instruction or context for the LLM."
  teach "filename.md"
  interact
  on intent "next"
    transition to next_state
  on offtopic
    transition to example
```
