# Effect reference

Effects appear at the top of a state (fire on entry) or inside a handler body (fire on match).

```
state example
  goal "Current LLM objective — incorporate this."
  guide "Instruction or context for the LLM."
  teach "filename.md"
  interact
  on intent "next"
    transition to next_state
    guide "Transitioning now."
```

## Effect types

| Effect | Syntax | Description |
|---|---|---|
| `goal` | `goal "text"` | Sets the LLM's current objective |
| `guide` | `guide "text"` | Provides instruction or context |
| `teach` | `teach "filename.md"` | References a knowledge file by name |
| `interact` | `interact` | Pauses — agent is waiting for user input |
| `transition to` | `transition to <state>` | Moves FSM to named state |
| `run script` | `run script "path" { key: value }` | Triggers an external action |

## Notes

- Multiple effects can appear in one state or handler
- `interact` emits `request_interact` — the LLM should pause and ask the user
- `teach "file"` emits the filename as text; the LLM fetches content via `dot-agent://knowledge/{name}`
- Order of effects in a state body does not matter
