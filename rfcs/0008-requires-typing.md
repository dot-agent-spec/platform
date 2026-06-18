<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0008: requires[] Typing

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

---

## Summary

Define the semantics and typing model for the `requires[]` field in `agent.description` and in `aboutme.json`, including how action granularity is expressed and how `requires` relates to `capabilities`, `input`, and `output`.

---

## Motivation

`requires[]` exists in the DSL and is surfaced in the envelope as `AnnotatedRef[]` (`{name, description?}`). Today it carries no action granularity — `requires UserProfile` says nothing about whether the agent reads, writes, or creates. This ambiguity blocks:

- runtimes that want to display accurate permission summaries before installation
- orchestrators that need to route agents by what types they consume vs produce
- future registry tooling that matches agents by declared contracts

The current design is also underdocumented in how `requires` differs from `capabilities`, `input`, and `output` — four blocks that exist in the DSL but without a formal semantic contract between them.

---

## Semantic Model (Resolved)

The four DSL blocks have distinct scopes:

| Block | Contract with | Meaning |
|---|---|---|
| `requires` | Runtime | Types/services the runtime must guarantee in context before the agent runs |
| `capabilities` | Runtime + other agents | Actions the agent exposes and is sandboxed to perform |
| `input` | Other agents | Data types the agent accepts as invocation payload |
| `output` | Other agents | Data types the agent produces |

`requires` is a **runtime contract**, not an inter-agent exchange contract. When an agent declares `requires UserProfile`, it tells the runtime: "this must exist in context before I start." The runtime is responsible for providing it — whether by invoking another agent, reading from a data store, or asking the user.

`capabilities` is a **sandboxing contract** and an **agent-to-agent contract**: it declares what the agent is allowed to do and what other agents can invoke on it.

`input`/`output` are **exchange contracts** — the typed interface for direct agent invocation.

---

## Pending Decisions

### P1 — Action granularity in `AnnotatedRef`

How does the action (read, write, create, delete) enter the contract?

**Option A — field on struct:**
```ts
interface AnnotatedRef {
  name: string
  action?: string   // "read" | "write" | "create" | "delete"
  description?: string
}
```

**Option B — prefix in name (DSL syntax sugar):**
```
requires Read:UserProfile
```
Parser desugars to `{ name: "UserProfile", action: "read" }`.

**Option C — name stays simple, action implied by behavior:**
Action granularity is not declared in `requires` — it is inferred by the runtime from what the `.behavior` states actually do with the type.

**Reference:** Apple AppIntents as inspiration for how platforms expose typed intents with explicit action semantics.

**Blocking:** until P1 is resolved, `AnnotatedRef` stays as `{name, description?}`.

### P2 — Who defines what `UserProfile` means?

When two agents declare `requires UserProfile`, are they referring to the same thing?

**Option A — inline (V1):** the agent that produces `UserProfile` defines the type in its `types.json`. Consumers `$ref` that definition. No central registry.

**Option B — registry (VNext):** `UserProfile` is a registered name at `dot-agent.dev/registry/requires` with a canonical schema. Any agent using the name refers to the same contract.

**Option C — structural compatibility:** the runtime checks shape compatibility, not name equality.

**Status:** pending study. Reference: Apple AppIntents registry model.

---

## Out of Scope

- **Action enforcement at runtime** — whether the runtime blocks an agent that tries to write when it only declared `read` is a runtime policy, not a spec concern.
- **Permission UI/UX** — how the runtime presents `requires[]` to the user before installation is a runtime decision.
