# MCP effect semantics

Effects are returned as an array in every tool call result:

```json
{
  "ok": true,
  "effects": [
    { "type": "guide", "text": "Hello! How can I help?" },
    { "type": "transition", "from": "init", "to": "greeting" }
  ]
}
```

## Effect types

| Type | Fields | Action |
|---|---|---|
| `goal` | `text` | Set as LLM objective — incorporate into system context |
| `guide` | `text` | Instruction or context — use it immediately |
| `teach` | `text` | Filename of a knowledge file — fetch via `dot-agent://knowledge/{text}` |
| `request_interact` | (none) | Pause — ask the user before continuing |
| `transition` | `from`, `to` | FSM changed state — re-read `dot-agent://state` and `dot-agent://intents` |
| `set_memory` | `domain`, `key`, `value` | Kernel stored a value — visible in `dot-agent://memory` |

## Processing order

1. Apply `goal` effects to LLM context
2. Display `guide` and `teach` content to user
3. On `transition`: update local state tracking, re-read intents
4. On `request_interact`: stop and wait for user input before next tool call
5. Continue loop after user responds
