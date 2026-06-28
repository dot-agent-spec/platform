# Memory domains

4 domains with different lifetimes:

| Domain | Lifetime | Use for |
|---|---|---|
| `context` | Agent lifetime (persistent) | Long-term user facts, preferences |
| `session` | Current session | Session state, current task |
| `worksession` | Focused work block | Temporary work context |
| `user` | Cross-agent | User identity, global preferences |

## Set from behavior

```
state capture_name
  on intent "done"
    transition to init
    set_memory context.name ""
```

Note: `set_memory` stores an empty string as placeholder; the actual value is injected by the host.

## Inject from host (MCP)

```
session.injectMemory('context', 'user_name', 'Alice')
```

Or via MCP tool:
```json
{ "tool": "inject_memory", "domain": "context", "key": "user_name", "value": "Alice" }
```

## Read all memory

```ts
session.getMemory()
// returns: [{ domain: "context", key: "user_name", value: "Alice" }, ...]
```

Or via MCP resource: `dot-agent://memory`
