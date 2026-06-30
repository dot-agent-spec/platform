# State block reference

```
state <name>
  <effects>
  on intent "<intent-name>"
    <effects>
  on intent "<other-intent>"
    transition to <state>
  on offtopic
    transition to <state>
  after <n> prompts
    transition to <state>
```

## Handlers

| Handler | Description |
|---|---|
| `on intent "name"` | Fires when the kernel receives this intent in the current state |
| `on offtopic` | Fires when no intent matches |
| `after <n> prompts` | Fires after n calls to tick_prompt |

## Global triggers

Declared outside any state, fire in all states:

```
on trigger "emergency"
  transition to error
```

## Notes

- State names must be unique across merged files (E015 if duplicate)
- `init` is the required entry state (E016 if missing)
- Handler bodies can contain any effects including transition to
- A state with no handlers is valid — it's a terminal state
