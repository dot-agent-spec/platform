# State anatomy: statements and handlers

```
state <name>
  <statements>
  on intent "<intent-name>"
    <statements>
  on intent "<other-intent>"
    transition to <state>
  on offtopic
    transition to <state>
  after <n> prompts
    transition to <state>
```

## Statements

Statements at the top of a state fire on entry; the same statements inside a handler body fire
on match. Order in a state body does not matter.

| Statement | Syntax | Effect emitted | Description |
|---|---|---|---|
| `goal` | `goal "text"` | `goal` | Sets the LLM's current objective — only valid paired with `interact` (W012 otherwise) |
| `guide` | `guide "text"` | `guide` | Instruction or context — use it immediately |
| `teach` | `teach "filename.md"` | `teach` | References a knowledge file by name |
| `interact` | `interact` | `request_interact` | Pauses — agent is waiting for user input |
| `transition to` | `transition to <state>` | `transition` | Moves the FSM to the named state |
| `set` | `set <target> <op> <value>` | `set_memory` | Writes memory; target is `domain.var` or a bare local var; op is `=`, `+=`, `-=` |
| `run script` | `run script "target"` or `run script "target" "parameters"` | `run_script` | Triggers an external script; the optional second string is a raw parameter string, format is caller-defined |

## Handlers

| Handler | Description |
|---|---|
| `on intent "name"` | Fires when the kernel receives this intent in the current state |
| `on offtopic` | Fires when no intent matches |
| `after <n> prompts` | Fires after n calls to `tick_prompt` |

## Global triggers

Declared outside any state, fire in all states:

```
on event "emergency"
  transition to error
```

## Notes

- State names must be unique across merged files (E015 if duplicate)
- `init` is the required entry state (E016 if missing)
- A state with no handlers is valid — it's a terminal state
- A handler body with 2+ statements needs a closing `end`. Omitting it does not always raise a
  parse error — the parser may accept just the first statement as the whole (inline) handler and
  silently attach the rest to the enclosing state instead of scoping them inside the handler.

## Example

```
state example
  goal "Current LLM objective — incorporate this."
  guide "Instruction or context for the LLM."
  teach "filename.md"
  interact
  on intent "next"
    transition to next_state
    guide "Transitioning now."
  end
```
