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
    set context.name = ""
    transition to init
  end
```

`set <target> <op> <value>` — target is `domain.var` (domain is one of the 4 above) or a bare
local var; op is `=`, `+=`, or `-=`. Note: a handler with 2+ actions needs the closing `end`.

Here `set` stores an empty string as a placeholder so it shows up in `dot-agent://memory`
immediately; the actual value is typically injected by the host via `inject_memory` after
interpreting free-form user input.

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
