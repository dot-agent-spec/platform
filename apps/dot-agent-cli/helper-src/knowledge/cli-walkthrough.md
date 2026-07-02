# Worked example: driving an agent over MCP

Using the greeter agent from the overview (`init` topic): `.behavior` has `init` and `greeting`
states. Here is the full MCP transcript to drive it from a cold start.

## 1. Start the server

```
dot-agent run ./greeter/ --mcp
```

## 2. Orient

Read `dot-agent://state` → `"init"`.
Read `dot-agent://intents` → `["hello", "offtopic"]`.

## 3. Send the intent

```json
{ "tool": "send_intent", "intent": "hello" }
```
Returns:
```json
{
  "ok": true,
  "effects": [
    { "type": "transition", "from": "init", "to": "greeting" },
    { "type": "guide", "text": "Hello! Send 'done' to finish." }
  ]
}
```

## 4. React to the effects

- `transition`: the FSM moved — re-read `dot-agent://state` (now `"greeting"`) and
  `dot-agent://intents` (now `["done", "offtopic"]`)
- `guide`: surface this text to the end user immediately

## 5. Continue the loop

```json
{ "tool": "send_intent", "intent": "done" }
```
Returns a `transition` back to `init`. No `request_interact` appeared in this example because
neither state used `interact` — if one had, the loop would pause there and wait for a real user
reply before calling `send_intent` again.

## Pattern

```
loop:
  state    = read dot-agent://state
  intents  = read dot-agent://intents
  effects  = call send_intent(pick one of intents) | send_offtopic()
  for effect in effects:
    if request_interact: pause, ask the user, then continue the loop
    otherwise: apply/display the effect
```

This is the same loop described in the static `dot-agent://howto` resource, worked through
end to end against a real agent.
