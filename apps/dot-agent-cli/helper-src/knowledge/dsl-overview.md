# .behavior file format and package composition

An agent project has: a `.description` file (metadata), a `.behavior` file (the FSM), an optional
`SOUL.md` persona, and optional `guides/` and `knowledge/` directories. A `guide`/`teach` file
reference is a path relative to the agent root (e.g. `teach "knowledge/x.md"`) and is bundled verbatim
at that path. Only referenced files are packed — an unreferenced one is reported (`W015`) and left out
of the bundle; a reference resolving outside `guides/`/`knowledge/` is reported (`W016`) as unreachable.

Minimal valid `.behavior` (init state required):

```
state init
  goal "Welcome the user and find out what they want."
  guide "Ready. Send an intent to begin."
  interact
  on intent "hello"
    transition to greeting
  on offtopic
    transition to init

state greeting
  goal "Find out how to help the user."
  guide "Hello! How can I help you?"
  interact
  on intent "back"
    transition to init
  on offtopic
    transition to greeting
```

## Rules

- Every `.behavior` must have a state named `init` (E016 if missing)
- State names are barewords (no quotes, no spaces)
- Intent names in handlers are quoted strings: `on intent "name"`
- `transition to <state>` (two words, no underscore)
- `interact` emits a `request_interact` effect (signals the agent is waiting for user input); it
  pairs with `goal` — a state with `goal` but no `interact` gets a W012 lint warning, and
  `interact` without `goal` gets W013
- `goal`/`guide`/`teach` are state-level only, valid in an **Oriented State** (one that also
  declares `interact`); a state with none of those is a **Setup State** — see `dsl_states` for the
  full statement/handler reference

## Merge

To split behavior across files:

```
merge "phases/generation.behavior"

state init
  ...
```

Merge paths must stay within the agent root (E014 if they escape).
Circular merges are detected at compile time (E013).
Merge is resolved by the compiler at pack time, not by the kernel at runtime — always validate the
consolidated result with `dot-agent run`.

## Where the language is going

This file describes the language as it stands. For the direction of travel, see the roadmap:
https://github.com/dot-agent-spec/platform/blob/main/ROADMAP.md
