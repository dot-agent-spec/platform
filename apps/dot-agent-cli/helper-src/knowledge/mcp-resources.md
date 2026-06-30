# MCP resources reference

All resources use the `dot-agent://` scheme.

| URI | Mutable | Description |
|---|---|---|
| `dot-agent://howto` | No | 3-line interaction primer |
| `dot-agent://manifest` | No | Full aboutme.json (name, description, capabilities) |
| `dot-agent://state` | Yes | Current FSM state name |
| `dot-agent://intents` | Yes | Valid intents in the current state |
| `dot-agent://graph` | Yes* | SCXML with `_active="true"` on current state |
| `dot-agent://memory` | Yes | Full memory store, all 4 domains |
| `dot-agent://persona` | No | SOUL.md content |
| `dot-agent://guides/{name}` | No | Individual guide file content |
| `dot-agent://knowledge/{name}` | No | Individual knowledge file content |

*graph changes on each state transition.

## Interaction loop

```
1. read dot-agent://state       -> current state name
2. read dot-agent://intents     -> array of valid intents
3. call send_intent             -> returns effects[]
4. process effects
5. if transition effect: go to 1
6. if request_interact: ask user, then go to 2
```

## Do not cache

`state`, `intents`, and `memory` change with every interaction. Always read fresh before each send_intent call.
