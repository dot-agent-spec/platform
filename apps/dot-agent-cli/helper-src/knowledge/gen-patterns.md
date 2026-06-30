# Common agent patterns

## 1. Simple responder

Handles everything in init. Good for stateless Q&A agents.

```
state init
  goal "Ask me anything."
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
  goal "Ready to start the workflow."
  on intent "start"
    transition to stage_one
  on offtopic
    transition to init

state stage_one
  guide "Step one: provide the input."
  interact
  on intent "next"
    transition to stage_two
  on offtopic
    transition to stage_one

state stage_two
  guide "Step two: confirm the result."
  interact
  on intent "confirm"
    transition to done
  on intent "retry"
    transition to stage_one
  on offtopic
    transition to stage_two

state done
  goal "Workflow complete."
  on intent "restart"
    transition to init
  on offtopic
    transition to done
```

## 3. Memory-aware

Stores user context across exchanges.

```
state init
  goal "Tell me your name to get started."
  on intent "set_name"
    transition to capture_name
  on intent "greet"
    transition to greeting
  on offtopic
    transition to init

state capture_name
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

Inject name from host before greeting:
```ts
session.injectMemory('context', 'name', 'Alice')
// or via MCP:
// { tool: "inject_memory", domain: "context", key: "name", value: "Alice" }
```
