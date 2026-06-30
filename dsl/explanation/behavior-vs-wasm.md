<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# `.behavior` vs. WASM: Choosing the Right Layer

`.behavior` and WASM modules both serve the same goal: **deterministic orchestration of agent state**. They differ in format, power scope, and authoring complexity.

---

## The spectrum

```
Prompt  →  .behavior  →  WASM  →  Runtime
```

Each layer serves a purpose:

- **Prompt** — highly flexible, probabilistic. The LLM reasons, interprets, and generates. Poorly suited to enforcing routing logic or deterministic tool calls.
- **`.behavior`** — structured, readable, deterministic. Designed so agents can be authored without writing compiled code. The common case.
- **WASM module** — full power. Handles everything `.behavior` cannot: loops, complex aggregations, transactional rollback, IP-protected logic, strict regulatory compliance.
- **Runtime** — the execution layer. Loads `.behavior` files, links WASM modules, manages memory, routes to models.

**The key insight:** everything expressible in `.behavior` could be implemented in WASM. `.behavior` is not a different system — it is a simpler entry point into the same system. Agents can start with `.behavior` and progressively migrate hot paths to WASM as complexity grows.

---

## When to use `.behavior`

Use `.behavior` when the agent workflow is too structured for a prompt but not complex enough to justify writing compiled code. Concretely:

- State transitions driven by user intent
- Conditional branching on memory values
- Sequential tool/script/subagent calls with `on failure` routing
- Any flow that remains scannable in under 30 seconds

---

## When to use WASM

Use WASM when the workflow exceeds `.behavior`'s cognitive scope. The criterion is **cognitive density**, not line count.

Signals that a behavior has crossed the frontier:

- You need to **loop over a collection** (e.g., process each item in a list)
- You need to **aggregate and transform** results before acting
- You need **transactional rollback** across multiple operations
- The flow requires **arithmetic** beyond simple comparisons
- Logic must remain **opaque** (IP protection, regulatory compliance)
- **Performance** is a constraint (tight loop, heavy computation)

---

## Migration pattern

A common pattern: start with `.behavior` for the full agent, then extract individual states into WASM modules as they grow beyond `.behavior`'s scope. The two coexist — a `.behavior` file can call WASM modules via `run script` or `run tool`.

```
state analyze_transactions
  goal "Run transaction analysis"
  run script "analyze.wasm" "session.transactions"
    on failure
      transition to error
  transition to show_results
```

The WASM module handles the complex aggregation; `.behavior` handles the routing.
