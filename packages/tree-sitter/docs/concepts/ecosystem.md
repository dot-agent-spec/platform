# The .agent Ecosystem

Complete reference for the agent DSL ecosystem: design philosophy, syntax, type system, security model, and packaging strategy.

## 1. Two Formats, One System

Every agent is defined by two files with a clear division of responsibility:

```
.description  —  the manifest: what the agent is, consumes, and exposes
.behavior     —  the implementation: how the agent executes, state by state
```

This mirrors the `.h` / `.c` split in C:

- **`.description`** is the header file — the public contract. The Runtime reads it for capability enforcement, dependency resolution, and tool discovery. Other agents and registries index it without ever reading the behavior.
- **`.behavior`** is the implementation — private to the agent. It contains state logic, prompt injection, and execution flow.

This separation is a runtime guarantee, not just a convention: in a distributed ecosystem, reading dozens of full `.behavior` files to discover agents would be unworkable. The `.description` manifest enables instant indexing. The `capabilities` block forces developers to declare permissions, which the Runtime then enforces against what the `.behavior` actually executes.

```
Ecosystem
 ├── Agents       — declarative manifests: "What I am"
 ├── Behaviors    — .behavior files: "How I work"
 ├── Types        — data contracts anchored to Wikidata/Schema.org
 ├── Capabilities — actions and sandbox permissions
 └── Runtime      — the "OS": resolves dependencies, runs LLMs, validates contracts
```

## 2. The Runtime as Operating System

The Runtime (whether Claude, Gemini, or a custom engine) acts as the operating system of the agent ecosystem. It reads manifests, resolves dependencies, and orchestrates execution.

**Example: orchestration via `requires`**

1. A system invokes the `Doctor` agent
2. The Runtime reads: `requires Prontuario`
3. It finds `Prontuario` is not in the current context
4. It locates which agent produces `output Prontuario`, invokes `Triage`, validates the returned JSON against the declared type structure, and passes it to `Doctor`

Determinism is central: the Runtime never invents data structures at runtime. Every piece of data that flows between agents needs an explicit contract.

## 3. .behavior and .wasm: Same Purpose, Different Formats

`.behavior` and `.wasm` both serve the same goal: **deterministic orchestration of agent state**. They differ in format and power scope.

```
Prompt  →  .behavior  →  .wasm  →  Runtime
```

Each layer serves a purpose:

- **Prompt** — highly flexible, probabilistic. The LLM reasons, interprets, and generates. Poorly suited to enforcing routing logic or deterministic tool calls.
- **`.behavior`** — structured, readable, deterministic. A text-based subset of what `.wasm` can do. Designed so agents can be authored without writing code or compiling to WASM.
- **`.wasm`** — compiled WASM. Full power. Handles everything `.behavior` cannot: loops, complex aggregations, transactional rollback, IP-protected logic, strict regulatory compliance.
- **Runtime** — the execution layer. Interprets `.behavior`, compiles it to `.wasm` as needed, manages memory, routes to models.

**The key insight:** everything expressible in `.behavior` could be written in `.wasm`. `.behavior` is not a different system — it is a simpler entry point into the same system. The Runtime compiles `.behavior` to its internal execution format; `.wasm` allows authors to write that format directly when they need capabilities beyond `.behavior`'s scope.

**When to use .behavior:** the agent workflow is too structured for a prompt but not complex enough to justify writing WASM. This is the common case.

**When to use .wasm:** the workflow needs loops, complex data aggregation, transactional rollback, high-performance math, or logic that must remain opaque (IP protection).

The criterion for crossing from `.behavior` to `.wasm` is **cognitive density**, not line count. A `.behavior` file should remain scannable in under 30 seconds. When it cannot, that complexity belongs in `.wasm`.

Signals that a behavior has crossed the frontier:
- You need to loop over a collection
- You need to aggregate and transform results before acting
- You need transactional rollback across multiple operations
- The behavior requires arithmetic beyond simple comparisons
