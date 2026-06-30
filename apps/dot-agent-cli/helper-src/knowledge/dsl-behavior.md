# .behavior file format

Minimal valid example (init state required):

```
state init
  goal "Ready. Send an intent to begin."
  on intent "hello"
    transition to greeting
  on offtopic
    transition to init

state greeting
  guide "Hello! How can I help you?"
  interact
  on intent "back"
    transition to init
  on offtopic
    transition to greeting
```

## Rules

- Every .behavior must have a state named `init` (E016 if missing)
- State names are barewords (no quotes, no spaces)
- Intent names in handlers are quoted strings: `on intent "name"`
- `transition to <state>` (two words, no underscore)
- `interact` emits a request_interact effect (signals the agent is waiting for user input)
- Effects at the top of the state fire on entry; handler bodies fire on match

## Merge

To split behavior across files:

```
merge "phases/generation.behavior"

state init
  ...
```

Merge paths must stay within the agent root (E014 if they escape).
Circular merges are detected at compile time (E013).
