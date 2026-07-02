<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# @dot-agent/parser-dsl

Unified parsing layer for the dot-agent DSL, written in Rust and compiled to **WebAssembly**. Parses both `.behavior` files (→ `BehaviorFile`) and `.description` files (→ `DescriptionFile`) using tree-sitter, and provides static analysis utilities (SCXML graph, state enumeration, intent listing).

This is **Layer 1** of the dot-agent tooling hierarchy — it sits directly above the tree-sitter grammar and below both the compiler and the kernel. The compiler imports it as a JS/WASM module; the kernel-dsl links it as a Rust `rlib` (behavior parsing only, no WASM overhead between them).

```
@dot-agent/tree-sitter  ──→  @dot-agent/parser-dsl
                                  │
                    ┌─────────────┴──────────────┐
                    ↓                            ↓
          @dot-agent/compiler          @dot-agent/kernel-dsl
          (linting, packaging,         (FSM execution —
           JSON Schema gen)             rlib link, behavior only)
```

> **The Rust crate (`dot-agent-parser-dsl`) is deliberately not published to crates.io.** It
> depends on `wasm-bindgen` without a `target_arch = "wasm32"` gate, so a native consumer would
> get a crate that either fails to build or exposes a useless API. It's consumed today only as a
> path dependency by `kernel-dsl`. Publishing natively would require extracting a
> wasm-bindgen-free core crate first.

---

## Quick Start

### Installation

```bash
npm install @dot-agent/parser-dsl
```

### Parsing a `.behavior` file

```javascript
import init, { parse_behavior, get_states, get_intents_for_state, get_graph } from '@dot-agent/parser-dsl';

await init();

const src = `
state welcome
  goal "Help the user get started"
  interact
  on intent "help" transition to helping

state helping
  goal "Provide targeted assistance"
  interact
  on intent "done" transition to welcome
`;

const result = JSON.parse(parse_behavior(src));
if (result.error) {
  console.error('Parse error:', result.error);
} else {
  console.log(result.ok.states);
  // → [{ name: "welcome", body: [...] }, { name: "helping", body: [...] }]
}

const states = JSON.parse(get_states(src));
// → ["welcome", "helping"]

const intents = JSON.parse(get_intents_for_state(src, 'welcome'));
// → ["help"]

const scxml = get_graph(src);
// → "<?xml version=\"1.0\" ...><scxml ...>...</scxml>"
```

### Parsing a `.description` file

```javascript
import init, { parse_description } from '@dot-agent/parser-dsl';

await init();

const src = `
agent Doctor
  domain health.example.com
  license MIT

description
  Clinical diagnostic agent.

capabilities
  TriagePatient "Triagem inicial do paciente"
  IssueReferral

input Patient
output Prescription
`;

const result = JSON.parse(parse_description(src));
if (result.error) {
  console.error('Parse error:', result.error);
} else {
  const df = result.ok;
  console.log(df.agent.name);       // "Doctor"
  console.log(df.agent.domain);     // "health.example.com"
  console.log(df.capabilities);     // [{ name: "TriagePatient", description: "Triagem inicial..." }, ...]
  console.log(df.input);            // [{ name: "Patient", description: null }]
}
```

### ESM / Bundler (Vite, webpack, Next.js)

```typescript
import init, { parse_behavior, parse_description } from '@dot-agent/parser-dsl';

export async function parseBehavior(text: string) {
  await init();
  return JSON.parse(parse_behavior(text));
}

export async function parseDescription(text: string) {
  await init();
  return JSON.parse(parse_description(text));
}
```

---

## API

All functions are **stateless**: they accept raw source text and return JSON strings (or XML for `get_graph`). No instance required.

| Function | Signature | Returns |
|---|---|---|
| `init` | `() → Promise<void>` | Initializes the WASM module. Call once before any other function. |
| `parse_behavior` | `(text: string) → string` | JSON: `{ "ok": BehaviorFile }` on success, `{ "error": "..." }` on failure. |
| `parse_description` | `(text: string) → string` | JSON: `{ "ok": DescriptionFile }` on success, `{ "error": "..." }` on failure. |
| `get_graph` | `(text: string) → string` | W3C SCXML string representing the static FSM graph. Empty string on parse error. |
| `get_states` | `(text: string) → string` | JSON `string[]` — state names in declaration order. `[]` on parse error. |
| `get_intents_for_state` | `(text: string, state: string) → string` | JSON `string[]` — intents valid in that state. `[]` if state not found or has no interact block. |

`get_graph`, `get_states`, and `get_intents_for_state` all operate on `.behavior` source text only.

---

## Output Formats

### BehaviorFile (`parse_behavior`)

`parse_behavior()` returns `{ "ok": BehaviorFile }` where `BehaviorFile` is the JSON representation of the parsed behavior:

```json
{
  "merges": [],
  "global_triggers": [],
  "states": [
    {
      "name": "welcome",
      "body": [
        { "type": "goal_stmt", "text": "Help the user get started" },
        { "type": "interact_stmt", "handlers": [] },
        { "type": "intent_trigger", "intent": "help", "body": "helping" }
      ]
    }
  ]
}
```

See [`docs/reference/api.md`](docs/reference/api.md) for the full `BehaviorFile` TypeScript interface and all `Statement` variants.

### DescriptionFile (`parse_description`)

`parse_description()` returns `{ "ok": DescriptionFile }`:

```json
{
  "agent": {
    "name": "Doctor",
    "domain": "health.example.com",
    "license": "MIT",
    "terms": null,
    "privacy": null
  },
  "description": "Clinical diagnostic agent.",
  "persona": null,
  "behavior": null,
  "capabilities": [
    { "name": "TriagePatient", "description": "Triagem inicial do paciente" },
    { "name": "IssueReferral", "description": null }
  ],
  "requires": [],
  "input": [{ "name": "Patient", "description": null }],
  "output": [{ "name": "Prescription", "description": null }],
  "types": []
}
```

See [`docs/reference/api.md`](docs/reference/api.md) for the full `DescriptionFile` TypeScript interface.

### SCXML (`get_graph`)

`get_graph()` returns W3C SCXML. States with no outgoing transitions become `<final>`; states with transitions become `<state>` with `<transition>` children:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="welcome">
  <state id="welcome">
    <transition event="help" target="helping"/>
  </state>
  <state id="helping">
    <transition event="done" target="welcome"/>
  </state>
</scxml>
```

The SCXML output is **static** — it does not annotate the current active state. For runtime state visualization, use the kernel's `get_graph()` method instead.

---

## Architecture

### Dual crate-type

The Rust crate declares `crate-type = ["cdylib", "rlib"]`:

- **`cdylib`** — compiled to `dot_agent_parser_dsl_bg.wasm` for JS consumption via wasm-bindgen.
- **`rlib`** — linked directly into `kernel-dsl` as a Rust library. The kernel calls `parse_behavior()` and accesses `ast::BehaviorFile` types with no WASM overhead. All `DescriptionFile` code is pruned by dead-code elimination.

### Browser compatibility

The build target is `wasm32-wasip1` (required because tree-sitter's C runtime uses `<stdio.h>`, which `wasm32-unknown-unknown` lacks). After `wasm-bindgen`, the build script runs [`wasi-stub`](https://github.com/trevyn/wasi-stub), which replaces all WASI import call sites with `unreachable` and removes them from the binary's import table.

The final WASM imports only functions from its own `_bg.js` glue. No WASI shim required in the host.

### Source layout

```
src/
├── lib.rs                — wasm_bindgen exports (6 functions, no business logic)
├── ast.rs                — BehaviorFile, DescriptionFile, and all supporting types (serde)
├── parser.rs             — parse_behavior(text) → BehaviorFile via tree-sitter
├── description_parser.rs — parse_description(text) → DescriptionFile via tree-sitter
└── analysis.rs           — to_scxml(), list_states(), intents_for_state()

build.rs                  — generates node_kinds.rs from tree-sitter grammar at compile time
scripts/
└── build-wasm.sh         — full build pipeline: cargo → wasm-bindgen → wasi-stub → patches
```

---

## Build

Prerequisites: Rust stable, `zig` on `$PATH`, `wasm-bindgen-cli`, `wasi-stub`.

```bash
# Debug build (faster, larger binary)
npm run build:debug

# Release build (optimized, smaller binary)
npm run build
```

Artifacts land in `pkg/`. The `pkg/` directory is checked in to the repository; you only need to rebuild when changing Rust source.

To install missing tools:

```bash
rustup target add wasm32-wasip1
cargo install wasm-bindgen-cli
cargo install wasi-stub
# zig: https://ziglang.org/download/
```

---

## License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).
