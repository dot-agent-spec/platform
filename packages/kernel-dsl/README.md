# @dot-agent/kernel-dsl

Execution engine for the **agent behavior DSL** (`.description` and `.behavior` files), written in Rust and compiled to **WebAssembly**. Implements a Finite State Machine (FSM) that interprets `.behavior` files according to the full dot-agent-spec, running entirely in-memory on the client side (browser or Node.js).

> **The Rust crate (`dot-agent-kernel-dsl`) is deliberately not published to crates.io.** It
> depends on `wasm-bindgen` without a `target_arch = "wasm32"` gate, so a native consumer would
> get a crate that either fails to build or exposes a useless API. Publishing natively would
> require extracting a wasm-bindgen-free core crate first — see
> `project/tasks/DA01-01-update-version-and-packages.md`.

## Quick Start

### Installation

```bash
npm install @dot-agent/kernel-dsl
```

### Basic Usage

```javascript
import { AgentDSLKernel, init } from '@dot-agent/kernel-dsl';

// Initialize WASM once
await init();

// Create kernel instance
const kernel = new AgentDSLKernel();

// Load behavior DSL
const behavior = `
state welcome
  goal "Help the user"
  interact
  on intent "help" transition to helping

state helping
  goal "Provide assistance"
`;

kernel.load_behavior(behavior);

// Get current state
console.log(kernel.get_current_state()); // "welcome"

// Listen to state changes and effects
kernel.observe((effect) => {
  console.log('Effect:', effect);
  
  switch (effect.type) {
    case 'goal':
      console.log('Goal:', effect.text);
      break;
    case 'transition':
      console.log('Transitioned to:', effect.to);
      break;
  }
});

// Send intents
kernel.send_intent("help");

// Get state graph
const graph = kernel.get_graph();
console.log('States:', graph.states);
console.log('Transitions:', graph.transitions);
```

### React Integration

```typescript
import { AgentDSLKernel, init } from '@dot-agent/kernel-dsl';
import { useEffect, useState } from 'react';

export function AgentPanel() {
  const [engine, setEngine] = useState<AgentDSLKernel | null>(null);
  const [currentState, setCurrentState] = useState('');

  useEffect(() => {
    (async () => {
      await init();
      const kernel = new AgentDSLKernel();
      
      kernel.observe((effect) => {
        if (effect.type === 'transition') {
          setCurrentState(effect.to);
        }
      });

      setEngine(kernel);
    })();
  }, []);

  if (!engine) return <div>Loading...</div>;

  return (
    <div>
      <p>Current State: {currentState}</p>
      <button onClick={() => engine.send_intent('help')}>Help</button>
    </div>
  );
}
```

## WASM Runtime Requirements

The kernel-dsl WASM binary has **zero WASI imports** after build — it is browser-compatible
without any WASI runtime shim, equivalent to `wasm32-unknown-unknown` for consumers.

The build pipeline uses [`wasi-stub`](https://github.com/bjorn3/wasi-stub) to strip all
`wasi_snapshot_preview1` imports from the binary after `wasm-bindgen`. In debug builds,
`index.js` provides a minimal `env` shim (12 UBSan handlers) that the Rust compiler
injects for undefined-behavior detection; release builds compile these out entirely.

**Note**: Initialization is handled automatically by the `init()` function. No manual setup needed.

## Architecture

```
src/
├── lib.rs              — Public WASM API (#[wasm_bindgen], no business logic)
├── effect.rs           — Effect enum + MemValue (serialized return types for JS)
├── parser/
│   ├── mod.rs          — parse_behavior(text) → BehaviorFile via tree-sitter
│   └── ast.rs          — AST types (BehaviorFile, StateDef, Statement, …) with serde
└── engine/
    ├── mod.rs          — AgentDSLKernel: orchestrates parser + FSM + memory
    ├── fsm.rs          — State execution, intent dispatch, conditionals, get_graph()
    └── memory.rs       — MemoryStore: 4 domains (context/session/worksession/user)

build.rs               — Code generation: extracts node kinds from tree-sitter grammar
```

The parser uses **tree-sitter** for robust parsing. The grammar is maintained in the [`dot-agent-tree-sitter`](https://github.com/daniloborges/dot-agent-tree-sitter) crate. `build.rs` automatically extracts node kinds from `tree-sitter/node-types.json` to keep parsing logic in sync with the grammar — when the grammar changes, simply update the tree-sitter crate version and rebuild.

## Supported constructs

The parser and FSM cover the full `.agent DSL`:

| Construct | Example |
|-----------|---------|
| State | `state responsive` |
| Goal / Guide / Teach | `goal "text"` |
| Interact | `interact` |
| Inline intent | `on intent "planning" transition to planning` |
| Block intent | `on intent "search"` + indented block |
| Offtopic | `on offtopic` + block |
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
  | { type: "request_interact" }
  | { type: "transition";       from: string; to: string }
  | { type: "run_script";       target: string; label: string | null; silent: boolean }
  | { type: "run_subagent";     target: string; label: string | null; background: boolean }
  | { type: "run_tool";         target: string; label: string | null }
  | { type: "set_memory";       domain: string; key: string; value: string | number | boolean | null }
  | { type: "apply_css";        value: string }
  | { type: "remove_css";       value: string }
  | { type: "parse_error";      message: string }
```

For the full API reference — all effect types, handler implementation examples, memory domains, TypeScript types, and a React hook — see [docs/reference/kernel-dsl.md](../../docs/reference/kernel-dsl.md).

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
