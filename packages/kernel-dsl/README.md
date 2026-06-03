# @dot-agent/kernel-dsl

Execution engine for the **agent behavior DSL** (`.description` and `.behavior` files), written in Rust and compiled to **WebAssembly**. Implements a Finite State Machine (FSM) that interprets `.behavior` files according to the full dot-agent-spec, running entirely in-memory on the client side (browser or Node.js).

## Architecture

```
src/
├── lib.rs              — Public WASM API (#[wasm_bindgen], no business logic)
├── effect.rs           — Effect enum + MemValue (serialized return types for JS)
├── parser/
│   ├── mod.rs          — parse_behavior(text) → BehaviorFile (recursive descent)
│   ├── lexer.rs        — Tokenizer with indentation tracking (INDENT/DEDENT)
│   └── ast.rs          — AST types (BehaviorFile, StateDef, Statement, …)
└── engine/
    ├── mod.rs          — AgentDSLKernel: orchestrates parser + FSM + memory
    ├── fsm.rs          — State execution, intent dispatch, conditionals, get_graph()
    └── memory.rs       — MemoryStore: 4 domains (context/session/worksession/user)
```

The parser is a **pure-Rust recursive descent parser** — no tree-sitter runtime dependency, fully compatible with `wasm32-unknown-unknown`. It is kept in sync with the canonical grammar at [`tree-sitter-agent/behavior/grammar.js`](https://github.com/daniloborges/dot-agent-tree-sitter/blob/main/behavior/grammar.js).

## Supported constructs

The parser and FSM cover the full `.agent DSL`:

| Construct | Example |
|-----------|---------|
| State | `state responsive` |
| Goal / Guide / Teach | `goal "text"` |
| Interact | `interact` |
| Inline intent | `on intent "planning" transition to planning` |
| Block intent | `on intent "search"` + indented block |
| Offtopic / Fallback | `on offtopic` / `on fallback` + block |
| Global event | `on event "session.ended"` + block |
| Memory assign | `set context.phase = "planning"` |
| Compound assign | `+=` / `-=` across all domains |
| Conditional | `if session.ready == true` + optional `else` |
| Transition | `transition to planning` |
| Run | `run script "file.js" silent` / `run subagent "agent.behavior" in background` |
| Temporal | `after 3 prompts guide "…"` |
| Parallel | `parallel` + block |
| UI | `apply css "…"` / `remove html "…"` |
| Merge | `merge "other.behavior"` (recorded in AST, resolved by external runtime) |
| Async completion | `on complete` / `on failed` + block |

## Build

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
wasm-pack build --target bundler
```

The generated `pkg/` directory is consumed via the package root:

```bash
npm install @dot-agent/kernel-dsl
```

## API

All methods return a **JSON array of `Effect` objects**, letting JS react to flow actions without polling.

```typescript
const engine = new AgentDSLKernel();

// Load a .behavior file and receive the entry effects of the first state
const effects = engine.load_behavior(behaviorText);
// → [{ type: "goal", text: "…" }, { type: "request_interact" }]

// Dispatch an intent (name classified by the LLM layer)
engine.send_intent("planning");

// Flow handlers
engine.send_offtopic();
engine.send_fallback();
engine.send_event("session.ended");

// Async operation completion
engine.send_complete();
engine.send_failed();

// Temporal triggers — call once per processed prompt
engine.tick_prompt();

// State reads
engine.get_current_state();  // string
engine.get_valid_intents();  // Array<string>

// Memory
engine.get_memory();                          // [{ domain, key, value }]
engine.set_memory("session", "lang", '"pt"'); // value as JSON string

// State graph (for VS Code Flow Graph panel)
engine.get_graph();
// → { states: ["responsive", "planning"], transitions: [{from, to, label}], current: "responsive" }
```

### Effect types

```typescript
type Effect =
  | { type: "goal";             text: string }
  | { type: "guide";            text: string }
  | { type: "teach";            text: string }
  | { type: "request_interact"; requiring: string | null }
  | { type: "transition";       from: string; to: string }
  | { type: "run_script";       target: string; label: string | null; silent: boolean }
  | { type: "run_subagent";     target: string; label: string | null; background: boolean }
  | { type: "run_tool";         target: string; label: string | null }
  | { type: "set_memory";       domain: string; key: string; value: string | number | boolean | null }
  | { type: "apply_css";        value: string }
  | { type: "remove_css";       value: string }
  | { type: "apply_html";       value: string }
  | { type: "remove_html";      value: string }
  | { type: "apply_video";      value: string }
  | { type: "remove_video";     value: string }
  | { type: "parse_error";      message: string }
```

For the full API reference — all effect types, handler implementation examples, memory domains, TypeScript types, and a React hook — see [API.md](API.md).

### Dynamic import (Next.js / SSR)

```javascript
import("@dot-agent/kernel-dsl").then(module => {
  const engine = new module.AgentDSLKernel();
  const effects = engine.load_behavior(behaviorText);
  console.log(effects);
});
```

---

## License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).
