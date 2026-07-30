# Common agent patterns

## 1. Simple responder

Handles everything in init. Good for stateless Q&A agents.

```
state init
  guide "Ask me anything."
  on intent "question"
    guide "Here is the answer."
  on intent "another"
    guide "Here is another answer."
  on offtopic
    guide "I did not understand. Try: question, another."
```

## 2. Multi-stage workflow

Linear state progression. Good for step-by-step tasks.

```
state init
  guide "Ready to start the workflow."
  on intent "start"
    transition to stage_one
  on offtopic
    transition to init

state stage_one
  goal "Collect the input needed to start."
  guide "Step one: provide the input."
  interact
  on intent "next"
    transition to stage_two
  on offtopic
    transition to stage_one

state stage_two
  goal "Get the user to confirm the result."
  guide "Step two: confirm the result."
  interact
  on intent "confirm"
    transition to done
  on intent "retry"
    transition to stage_one
  on offtopic
    transition to stage_two

state done
  guide "Workflow complete."
  on intent "restart"
    transition to init
  on offtopic
    transition to done
```

## 3. Memory-aware

Stores user context across exchanges.

```
state init
  guide "Tell me your name to get started."
  on intent "set_name"
    transition to capture_name
  on intent "greet"
    transition to greeting
  on offtopic
    transition to init

state capture_name
  goal "Learn the user's name."
  guide "What is your name?"
  interact
  on intent "done"
    transition to init
  on offtopic
    transition to capture_name

state greeting
  guide "Hello! (inject context.name before greeting for personalization)"
  on intent "back"
    transition to init
  on offtopic
    transition to greeting
```

The `.behavior` never writes memory itself — it steers the conversation, and the host writes what
it learned into the store, where it shows up in `dot-agent://memory`:
```ts
session.injectMemory('context', 'name', 'Alice')
// or via MCP:
// { tool: "inject_memory", domain: "context", key: "name", value: "Alice" }
```

## 4. Hub and spoke

An `init` menu that fans out to topic states, each of which routes back. This is how this helper
agent itself is built — see `cli` → `cli_walkthrough` for it being driven end to end.

```
state init
  guide "Topics: billing, shipping. Send one, or 'bye' to finish."
  on intent "billing"
    transition to billing
  on intent "shipping"
    transition to shipping
  on offtopic
    transition to init

state billing
  goal "Answer the user's billing question."
  guide "Billing questions: invoices, refunds, payment methods."
  teach "knowledge/billing.md"
  interact
  on intent "shipping"
    transition to shipping
  on intent "back"
    transition to init
  on offtopic
    transition to billing

state shipping
  goal "Answer the user's shipping question."
  guide "Shipping questions: delivery times, tracking, returns."
  interact
  on intent "billing"
    transition to billing
  on intent "back"
    transition to init
  on offtopic
    transition to shipping
```

Each spoke carries a `back` intent so the user is never trapped, and cross-links to its siblings so
navigation does not have to go through `init` every time. `on offtopic` self-transitions keep the
current topic loaded when input does not match.
