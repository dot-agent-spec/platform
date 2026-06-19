<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0015: Cross-Agent Calls

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-19 |
| Author | Danilo Borges |
| Depends | [RFC-0014](0014-data-contract.md) — data contract defines types that flow between agents |

---

## Summary

Define the `.behavior` syntax for invoking another agent's capability from within a behavior file: `start CapabilityName [in "agent.domain"]`, with `on complete with Type` and `on failure` handlers, plus `into context.var` for injecting the result into the calling agent's memory.

---

## Motivation

Agents need to delegate sub-tasks to other agents. The current `.behavior` has `run subagent "target"` but no mechanism for:

1. Calling by **capability** rather than by agent identity (Runtime resolves the best match)
2. Declaring the **expected output type** of the cross-agent call
3. **Injecting the result** into the calling agent's memory domain in a declared, traceable way

Without these, cross-agent composition is possible only by hardcoding agent names and accepting untyped results.

---

## `start ... in` — Invoke a capability

### Named agent (explicit, takes priority)

```
start BookingAction in "carrent.com"
on complete with BookingConfirmation
  set context.car_booking = result
  transition to confirm_trip
on failure
  transition to error
```

### Anonymous (Runtime resolves best match)

```
start BookingAction
on complete with BookingConfirmation
  set context.car_booking = result
  transition to confirm_trip
on failure
  transition to error
```

When no agent is specified, the Runtime queries the registry for agents that expose the named capability, evaluates compatibility via Wikidata category and agent description, and suggests the best match to the user before proceeding.

When an agent is named, it is used directly without resolution — this covers brand-specific integrations where identity matters (e.g. `start VectorizeAction in "illustrator.adobe.com"` rather than any compatible vector tool).

If no compatible agent is found in either case, `on failure` executes.

---

## `into` — Subagent output injection

When calling `run subagent` (inline, not cross-agent), the output is injected into a memory variable using `into`:

```
run subagent "analyzer" into context.analysis_result
on failure
  transition to error
```

This makes the data lineage explicit and traceable. The `into` clause declares where the subagent's output lands — the compiler can validate that `context.analysis_result` is later read in a consistent type context.

`into` is distinct from `on complete with Type` in `start`: `run subagent` calls a specific agent file directly; `start` calls by capability with Runtime resolution.

---

## Handler semantics

| Handler | Triggered by |
|---|---|
| `on complete with TypeName` | The called agent fulfilled the capability and returned the declared type |
| `on failure` | The called agent was unreachable, returned an error, or the output type did not match |

`on failure` in `start` blocks is a routing handler — it directs to an error state. Detailed error recovery logic belongs in WASM if needed.

---

## Implementation Notes

- `start ... in` is a new top-level statement in setup states — not currently in the grammar.
- `on complete with TypeName` is distinct from `on intent ... with TypeName` (RFC-0014): `on complete` fires on capability fulfillment, not on LLM-interpreted user intent.
- `into` requires a grammar addition to `run_stmt` in `packages/tree-sitter/tree-sitter-behavior/grammar.js`.
- The Runtime must coordinate state serialization across the calling and called agent's kernel instances.

---

## Open Questions

- Should `start` be allowed in oriented states (after `interact`) or only in setup states?
- Should the Runtime's agent resolution present a choice to the user or select automatically when a single compatible agent is found?
- Should `timeout` be a first-class keyword on `start` blocks (e.g. `start BookingAction timeout 30s`) or handled in WASM?

---

## Decisions Closed

- **`into` for subagent output, `on complete` for cross-agent** — Two distinct patterns for two distinct cases: direct subagent invocation uses `into` for conciseness; capability-based cross-agent calls use `on complete` because the output type is part of the contract and must be declared.
- **`on failure` routes, does not recover** — Recovery logic belongs in WASM. The `.behavior` DSL handles routing only.
