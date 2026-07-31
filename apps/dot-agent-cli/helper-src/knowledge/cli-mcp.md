# MCP tools, resources, and effects

dot-agent agents are authored as a text DSL (`.behavior` files: `state`, `goal`, `guide`, `teach`,
`interact`, `on intent`, `transition to`) — JSON only shows up at the MCP wire boundary. Each
effect object below is the serialized runtime output of one DSL statement; JSON is not the source
format.

MCP server mode exposes 6 tools (`load_agent`, `send_intent`, `send_event`, `send_offtopic`,
`tick_prompt`, `inject_memory`) and 9 `dot-agent://` resources.

## Tools

All tools return effects synchronously in the call result.

### load_agent
```json
{ "tool": "load_agent", "source": "/path/to/agent-dir-or-file.agent" }
```
Returns: `{ "ok": true, "id": "<bundle id>", "state": "<initial state>" }`. Loads (or reloads) a
`.agent` file or agent project directory, starting its FSM from the initial state. Replaces
whatever agent was previously loaded on this connection. No agent is loaded until this is called.

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
Sends a named event to the FSM.

### send_offtopic
```json
{ "tool": "send_offtopic" }
```
Signals that user input did not match any intent. Triggers `on offtopic`.

### tick_prompt
```json
{ "tool": "tick_prompt" }
```
Advances the prompt counter the runtime keeps for the session.

### inject_memory
```json
{ "tool": "inject_memory", "domain": "user", "key": "name", "value": "Alice" }
```
Returns: `{ "ok": true }`. Writes a value into the memory store the host owns, visible in
`dot-agent://memory`. The four domains are `context`, `session`, `worksession` and `user`.

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

Treat any other effect type as unknown and ignore it — the five above are what the statements in
this guide produce.

## Processing order

1. Apply `goal` effects to LLM context
2. Display `guide` and `teach` content to the user
3. On `transition`: update local state tracking, re-read intents
4. On `request_interact`: stop and wait for user input before the next tool call
5. Continue the loop after the user responds
