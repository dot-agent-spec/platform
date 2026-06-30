<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Antipatterns

Common mistakes in `.behavior` authoring and the recommended alternatives.

---

## Antipattern 1: Complex logic in `.behavior`

Attempting to express loops, aggregations, or multi-step transformations in `.behavior` using `if/else` chains and multiple states.

**Problem:** `.behavior` has no loops and no arithmetic. Simulating them with states creates an unreadable machine that defeats the purpose of the language.

**Example of what not to do:**
```
state check_item_1
  if session.item1_done == false
    run tool "process.api" "item1"
    set session.item1_done = true
  end
  transition to check_item_2

state check_item_2
  if session.item2_done == false
    run tool "process.api" "item2"
    set session.item2_done = true
  end
  transition to done
```

**Recommended alternative:** extract the loop into a WASM module or script, then call it from a single clean state:

```
state process_items
  goal "Process all pending items"
  run script "process-all.js" "session.items"
    on failure
      transition to error
  transition to done
```

The criterion: if you cannot scan the `.behavior` file in under 30 seconds, the complexity belongs in WASM. See [behavior-vs-wasm.md](behavior-vs-wasm.md).

---

## Antipattern 2: Overcrowded `goal` text

Writing long paragraphs in `goal` instead of using the `guide` statement for detailed instructions.

**Problem:** `goal` is injected into the LLM's message context as the state's objective. It should answer *what* the agent is doing, not *how*. Mixing both into `goal` makes both harder to maintain.

**Example of what not to do:**
```
state car_reservation
  goal "Collect car reservation details from the user. Ask for pickup date, return date, and car category. If the user mentions a preference for electric cars, note it in session memory. Always confirm before proceeding. Do not assume the user wants the cheapest option."
```

**Recommended alternative:**
```
state car_reservation
  goal "Collect car reservation details"
  guide "Ask for: pickup date, return date, car category. Note electric car preferences in session. Always confirm before proceeding. Do not assume cheapest option."
```

---

## Antipattern 3: Redundant orientation in handlers

Adding `guide` statements inside `on intent` or `on offtopic` blocks to re-orient the LLM for the destination state.

**Problem:** the destination state already has its own `goal` and `guide`. Adding orientation to the handler creates duplication and makes it harder to change either state independently.

**Example of what not to do:**
```
on offtopic
  guide "Return to the booking flow and ask the user to continue."
  transition to car_reservation
```

**Recommended alternative:**
```
on offtopic transition to car_reservation
```

If a `guide` is needed in the handler, the design signal is that the destination state is insufficiently defined. Fix the destination state, not the handler.

---

## Antipattern 4: Using `.behavior` for background processing

Attempting to use `.behavior` states for long-running background jobs that don't require user interaction.

**Problem:** `.behavior` is designed around LLM turns. States without `interact` are setup-only — they execute synchronously on entry and immediately transition. They are not suitable for polling, waiting on external events, or running tasks in the background while the user does something else.

**Recommended alternative:** use `run subagent "background-worker.wasm" "params"` for work that must happen outside the main conversation flow, or use WASM modules with their own async primitives for event-driven background tasks.
