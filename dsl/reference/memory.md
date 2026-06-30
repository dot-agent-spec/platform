<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Memory Domains

`.behavior` tracks state across four semantic scopes with distinct lifetimes. Memory is owned by the Runtime — the kernel holds a read-only view used only for `if` condition evaluation.

---

## Domains

| Domain | Lifetime | Use |
|---|---|---|
| `context` | Current LLM turn | Active working memory for the model. Cleared after each turn. |
| `session` | Current conversation thread | Cross-turn conversation state. Cleared when the thread closes. |
| `worksession` | Current work unit | Task-scoped data. Cleared when the work unit ends. |
| `user` | Long-term, persistent | User preferences and history. Persists across all conversations. |

---

## `set` — Writing to Memory

```
set context.active_phase   = "planning"   // cleared after this turn
set session.has_context    = true         // cleared when thread closes
set worksession.phase      = "review"     // cleared when work unit ends
set user.language          = "pt-br"      // persists across all conversations
```

**Operator forms:**

| Operator | Semantics |
|---|---|
| `=` | Assign value |
| `+=` | Increment (numeric) or append (string/array) |
| `-=` | Decrement (numeric) |

**Unqualified variables** (no domain prefix) are local to the current state and not persisted:
```
set localVar = true
```

---

## Reading from Memory

Memory values are read in `if` conditions:

```
if session.plan_ready == true
  transition to review
else
  transition to planning
end
```

**Supported comparison operators:** `==`, `!=`, `>`, `<`, `>=`, `<=`
**Supported logical operators:** `and`, `or`

---

## Memory ownership model

The Runtime owns the canonical memory store. Flow on every `set` effect:

```
kernel emits: SetMemory { domain: "session", key: "city", value: "São Paulo" }
  → SDK dispatches to Runtime's SetMemory handler
  → Runtime stores value canonically
  → Runtime applies permission check
  → Runtime calls kernel.inject_memory("session", "city", "São Paulo")
  → kernel updates its read-only view (used for `if` evaluation only)
```

This means `.behavior` files never directly write to persistent storage — every `set` is mediated by the Runtime.

---

## Runtime-managed variables (read-only)

These variables are set by the Runtime and available for reading in `if` conditions:

| Variable | Type | Description |
|---|---|---|
| `session.is_first_time` | boolean | `true` on the user's first conversation with this agent |
| `session.prompt_count` | number | Number of LLM turns in the current session |
