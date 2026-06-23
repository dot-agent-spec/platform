<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0006: Experimental Roadmap & Open Questions

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | — | ? | ? |

---

## Summary

This RFC tracks future specification work, experimental syntax under evaluation, and open architectural questions that require resolution before finalizing the `v2` kernel protocol and grammar.

---

## 1. Experimental Syntax

### Dynamic Parallelism (`each`)
Allows iterating a `run` statement over a collection, spawning tasks in parallel.

- **Syntax**: `run subagent "analyst" each context.files`
- **Status**: Defined in grammar; runtime semantics (accumulation, failure modes, error bubbling) are currently pending definition.

---

## 2. Open Questions

The following architectural topics require formal RFCs or resolution within the dot-agent ecosystem:

- **HTTP/MCP Interfaces**: Formalizing how an agent exposes server endpoints and declares compliance with the Model Context Protocol (MCP) or standard REST.
- **Authorization Gates**: Designing stricter Human-in-the-loop (HITL) triggers that are isolated from standard conversation flow (e.g., waiting for explicit user permission to execute a tool).
- **Checkpointing**: Determining if FSM state persistence (`kernel.serialize_state()`) should be implicit (after every turn) or explicitly directive-based by the agent author.
- **Timeouts**: Defining temporal boundaries for tool and subagent execution to prevent indefinitely hanging operations.
- **Subagent Contracts**: Standardizing how subagent outputs are accessed by the parent flow, specifically resolving the data lineage of `run subagent "Name" into context.target`.
