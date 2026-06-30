<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# The `.behavior` File — Implementation Reference

> For the **language syntax** of `.behavior` files (states, keywords, statements, handlers), see [`dsl/reference/behavior.md`](../../dsl/reference/behavior.md).

This document covers the **implementation side**: runtime scope boundaries, the `BehaviorFile` interchange format, and how the kernel and compiler consume parsed behavior.

---

## BehaviorFile Interchange Contract

See [`docs/reference/behavior-file.md`](behavior-file.md) for the full JSON schema of `BehaviorFile` — the stable contract between `@dot-agent/parser-dsl` and its consumers (`@dot-agent/compiler` for linting, `@dot-agent/kernel-dsl` as a Rust `rlib`).

---

## Runtime Scope

The Runtime enforces a boundary between managed infrastructure and agent-defined logic.

### Runtime-managed (not writable in `.behavior`)

| Item | Description |
|---|---|
| `session.is_first_time` | `true` on the user's first conversation with this agent |
| `session.prompt_count` | Number of LLM turns in the current session |
| `compaction_threshold` | Local context window management |
| `permissions` | Filesystem, network, MCP access — enforced from `capabilities` in `.description` |
| Native states: `online`, `offline`, `ended` | Managed by the Runtime lifecycle |

### Declarative scope (written in `.behavior`)

- Standard entry points: `init`, `onboarding`, `responsive` (override as needed)
- Arbitrary business states: `car_reservation`, `phases.planning`, etc.
- All orchestration: tools, subagents, scripts, memory, conditionals

---

## Standard States

These state names are recognized by the Runtime as conventional entry points:

| State | Purpose |
|---|---|
| `init` | Runs once on first agent load; setup actions only |
| `onboarding` | First-time user flow; overrides `responsive` when `session.is_first_time == true` |
| `responsive` | Default conversational state; fallback when no other state is active |

All three can be overridden in `.behavior`. If omitted, the Runtime provides default no-op implementations.
