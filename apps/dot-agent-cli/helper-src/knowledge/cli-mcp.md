# MCP tools, resources, and effects

dot-agent agents are authored as a text DSL (`.behavior` files: `state`, `on intent`, `set`, `run
script`, ...) — JSON only shows up at the MCP wire boundary. Each effect object below is the
serialized runtime output of one DSL statement; JSON is not the source format.

## Tools

All tools return effects synchronously in the call result.

### send_intent
```json
{ "tool": "send_intent", "intent": "hello" }
```
Returns: `{ "ok": true, "effects": [...] }`. Advances the FSM via the named intent. Read
`dot-agent://intents` first to see valid options.

### send_event
```json
{ "tool": "send_event", "event": "user_returned" }
```
Sends a named event (for global triggers, `on event "..."` in the DSL).

### send_offtopic
```json
{ "tool": "send_offtopic" }
```
Signals that user input did not match any intent. Triggers `on offtopic`.

### tick_prompt
```json
{ "tool": "tick_prompt" }
```
Advances the prompt counter. Triggers `after N prompts` transitions when the threshold is reached.

### inject_memory
```json
{ "tool": "inject_memory", "domain": "context", "key": "user_name", "value": "Alice" }
```
Returns: `{ "ok": true }`. Writes a value to memory. Domain: `context`, `session`, `worksession`,
or `user`.

## Resources

All resources use the `dot-agent://` scheme.

| URI | Mutable | Description |
|---|---|---|
| `dot-agent://howto` | No | 3-line interaction primer |
| `dot-agent://manifest` | No | Full `aboutme.json` (name, description, capabilities) |
| `dot-agent://state` | Yes | Current FSM state name |
| `dot-agent://intents` | Yes | Valid intents in the current state (bare labels, no descriptions) |
| `dot-agent://graph` | Yes* | SCXML with `_active="true"` on the current state |
| `dot-agent://memory` | Yes | Full memory store, all 4 domains |
| `dot-agent://persona` | No | SOUL.md content |
| `dot-agent://guides/{+name}` | No | Individual guide file content (`{+name}` may include `/`) |
| `dot-agent://knowledge/{+name}` | No | Individual knowledge file content (`{+name}` may include `/`) |

*graph changes on each state transition. `state`, `intents`, and `memory` change with every
interaction — never cache them.

## Effect types

| Type | Fields | Action | DSL statement |
|---|---|---|---|
| `goal` | `text` | Set as LLM objective — incorporate into system context | `goal "text"` |
| `guide` | `text` | Instruction or context — use it immediately | `guide "text"` |
| `teach` | `text` | Path relative to the agent root, already namespace-prefixed — fetch via `dot-agent://<text>` verbatim | `teach "knowledge/filename.md"` |
| `request_interact` | (none) | Pause — ask the user before continuing | `interact` |
| `transition` | `from`, `to` | FSM changed state — re-read `dot-agent://state` and `dot-agent://intents` | `transition to <state>` |
| `set_memory` | `domain`, `key`, `value` | Kernel stored a value — visible in `dot-agent://memory` | `set <target> <op> <value>` |
| `run_script` | `target`, `parameters`, `silent` | Kernel ran an external script | `run script "target" ["parameters"]` |

## Processing order

1. Apply `goal` effects to LLM context
2. Display `guide` and `teach` content to the user
3. On `transition`: update local state tracking, re-read intents
4. On `request_interact`: stop and wait for user input before the next tool call
5. Continue the loop after the user responds
