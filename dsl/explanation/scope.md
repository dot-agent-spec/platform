<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Scope: What `.behavior` Is (and Is Not)

`.behavior` occupies a precise position in the agent authoring stack. Understanding its boundaries is as important as understanding its syntax.

---

## What `.behavior` is

A **declarative state machine language** for orchestrating LLM-driven agent workflows. It sits between a prompt (too flexible, too probabilistic) and a compiled WASM module (too powerful, too complex for the common case).

```
Prompt  →  .behavior  →  WASM  →  Runtime
```

`.behavior` is the right tool when: the agent workflow is too structured for a prompt but not complex enough to justify writing compiled code. This is the common case.

---

## What `.behavior` is not

**Not a simplified programming language.**
No loops, no recursion, no arithmetic. These belong in scripts or WASM. The absence of these features is intentional — it keeps the vocabulary small, the cognitive load low, and the generated code predictable.

**Not YAML with fewer symbols.**
YAML is a data format. `.behavior` is a behavioral language. The distinction matters for readability and for how AI models generate it. YAML's structure is container-oriented; `.behavior`'s structure is flow-oriented.

**Not natural language.**
The temptation to drift toward prose (e.g., `remember that I prefer Portuguese`) must be resisted. Natural language reduces parseability and predictability. The language uses human concepts (`goal`, `guide`, `interact`, `transition`) with structured syntax — not prose.

**Not a competitor to LangGraph or XState.**
Those frameworks are compilation targets. `.behavior` abstracts over them. A `.behavior` file could compile to XState, LangGraph, or a custom execution format — the language does not prescribe the runtime representation.

---

## The two-format system

Every agent is defined by exactly two files:

```
.description  —  the manifest: what the agent is, consumes, and exposes
.behavior     —  the behavior: how the agent executes, state by state
```

This mirrors the `.h` / `.c` split in C:

- **`.description`** is the header — the public contract. The Runtime reads it for capability enforcement, dependency resolution, and tool discovery. Other agents and registries index it without ever reading the behavior.
- **`.behavior`** is the implementation — private to the agent. It contains state logic, prompt injection, and execution flow.

This separation is a runtime guarantee, not just a convention. In a distributed ecosystem, reading hundreds of full `.behavior` files to discover agents would be unworkable. The `.description` manifest enables instant indexing.

---

## The Runtime as operating system

The Runtime (whether Claude, Gemini, or a custom engine) acts as the operating system of the agent ecosystem. It reads manifests, resolves dependencies, and orchestrates execution.

**Example: orchestration via `requires`**

1. A system invokes the `Doctor` agent
2. The Runtime reads: `requires Prontuario`
3. It finds `Prontuario` is not in the current context
4. It locates which agent produces `output Prontuario`, invokes `Triage`, validates the returned JSON against the declared type structure, and passes it to `Doctor`

Determinism is central: the Runtime never invents data structures at runtime. Every piece of data that flows between agents needs an explicit contract.
