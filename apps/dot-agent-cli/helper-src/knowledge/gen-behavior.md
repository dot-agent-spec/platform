# .behavior template

```
state init
  guide "I am ready. Send an intent to begin."
  on intent "start"
    transition to working
  on intent "help"
    transition to help
  on offtopic
    transition to init

state working
  goal "Find out what the user needs and help with it."
  guide "Tell me what you need."
  interact
  on intent "done"
    transition to init
  on offtopic
    transition to working

state help
  guide "Available intents: start, help."
  on intent "back"
    transition to init
  on offtopic
    transition to help
```

## Syntax rules

- `state <name>` — bareword name, no quotes, no spaces
- `on intent "name"` — intent name in double quotes
- `transition to <state>` — two words, target is bareword
- `on offtopic` — catches unmatched input
- `interact` — emits request_interact, signals waiting for user
- `goal "text"` / `guide "text"` — short inline text
- `teach "filename.md"` — reference to a knowledge file

## Required

- Every .behavior must have a state named `init` (lint error E016 if missing)
- State names must be unique across all merged files (E015)
