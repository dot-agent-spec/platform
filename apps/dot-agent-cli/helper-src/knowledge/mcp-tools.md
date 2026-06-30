# MCP tools reference

All tools return effects synchronously in the call result.

## send_intent

```json
{ "tool": "send_intent", "intent": "hello" }
```
Returns: `{ "ok": true, "effects": [...] }`

Advances the FSM via the named intent. Use `dot-agent://intents` first to see valid options.

## send_event

```json
{ "tool": "send_event", "event": "user_returned" }
```
Returns: `{ "ok": true, "effects": [...] }`

Sends a named event (for global triggers).

## send_offtopic

```json
{ "tool": "send_offtopic" }
```
Returns: `{ "ok": true, "effects": [...] }`

Signals that user input did not match any intent. Triggers `on offtopic` handler.

## tick_prompt

```json
{ "tool": "tick_prompt" }
```
Returns: `{ "ok": true, "effects": [...] }`

Advances the prompt counter. Triggers `after N prompts` transitions when threshold is reached.

## inject_memory

```json
{ "tool": "inject_memory", "domain": "context", "key": "user_name", "value": "Alice" }
```
Returns: `{ "ok": true }`

Writes a value to the agent memory store. Domain must be one of: context, session, worksession, user.
