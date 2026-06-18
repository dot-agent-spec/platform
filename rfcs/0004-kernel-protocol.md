<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0004: Kernel Protocol

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |

---

## Summary

Define the minimum interface that every kernel — the built-in behavior kernel and any custom WASM kernel — must implement to be compatible with the SDK. Establishes the memory ownership model (runtime owns memory, kernel gets read access via injection) and the state serialization contract for memory-efficient runtimes.

---

## Motivation

Kernels are pluggable (see `architecture_map.md`). Without a formal protocol, each runtime must reverse-engineer what a given kernel exposes. This RFC defines the contract once so that:

- Any conforming kernel can be loaded by any conforming SDK
- Runtimes can implement memory permission models without kernel cooperation
- Runtimes that need to optimize memory usage can evict kernel WASM modules between interactions

---

## WASM Exports

Every kernel must export the following functions. All return values are strings; arrays and objects are JSON-encoded strings.

### Loading

```rust
/// Load agent sources into the kernel.
/// For single-file kernels (behavior DSL): pass the .behavior text directly.
/// For multi-file kernels: pass a JSON-encoded Map<filename, text>.
/// Returns: JSON-encoded Effect[] from initial state entry.
pub fn load_behavior(text: &str) -> String
```

Custom kernels with multiple source files receive the full source map and decide internally how to parse each file.

### Execution loop

```rust
/// Dispatch a user intent to the current state.
/// Returns: JSON-encoded Effect[]
pub fn send_intent(intent: &str) -> String

/// Dispatch a named event (e.g. from a tool result or subagent completion).
/// Returns: JSON-encoded Effect[]
pub fn send_event(event: &str) -> String

/// Signal successful completion of an async operation.
/// Returns: JSON-encoded Effect[]
pub fn send_complete() -> String

/// Signal failure of an async operation.
/// Returns: JSON-encoded Effect[]
pub fn send_failed() -> String

/// Signal an off-topic message from the user.
/// Returns: JSON-encoded Effect[]
pub fn send_offtopic() -> String

/// Notify the kernel that an LLM turn has completed.
/// Triggers `after N prompts` handlers if applicable.
/// Returns: JSON-encoded Effect[]
pub fn tick_prompt() -> String
```

### FSM state queries

```rust
/// Returns the name of the current FSM state.
pub fn get_current_state() -> String

/// Returns a JSON-encoded string array of intents valid in the current state.
pub fn get_valid_intents() -> String

/// Returns the full FSM graph in SCXML format (W3C, https://www.w3.org/TR/scxml/).
/// The active state is annotated with the custom attribute _active="true".
pub fn get_graph() -> String
```

`get_graph()` returns [SCXML](https://www.w3.org/TR/scxml/) — the W3C standard for State Chart XML. This ensures interoperability with external visualization and validation tooling. Example output:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="greeting">
  <state id="greeting" _active="true">
    <transition event="confirm" target="booking"/>
    <transition event="cancel" target="farewell"/>
  </state>
  <state id="booking">
    <transition event="complete" target="farewell"/>
  </state>
  <final id="farewell"/>
</scxml>
```

### Memory interface

**The kernel does not own memory.** The runtime is responsible for storing and persisting memory values. The kernel receives a read-only view of memory through injection, used only for evaluating conditions in `if` statements.

```rust
/// Inject a memory value into the kernel's read-only view.
/// The runtime calls this after processing each SetMemory effect,
/// after applying its own permission checks.
/// domain: one of "context" | "session" | "worksession" | "user"
pub fn inject_memory(domain: &str, key: &str, value_json: &str)
```

There is no `get_memory()` export. The canonical memory store lives in the runtime.

### State serialization (eviction support)

```rust
/// Serialize the current FSM execution state (active state, transition history).
/// Does NOT include memory — memory serialization is the runtime's responsibility.
/// Returns: compact JSON string, suitable for storage between interactions.
pub fn serialize_state() -> String

/// Restore a previously serialized FSM state.
/// Must be called before the next send_intent() after a kernel reload.
pub fn restore_state(state_json: &str)
```

This pair enables runtimes to evict the WASM module from memory while the agent is idle, then reload and resume on the next user interaction:

```
user sends message
  → runtime loads WASM module (from module cache)
  → kernel.restore_state(saved_fsm_state)
  → runtime calls inject_memory() for all relevant domains
  → kernel.send_intent(message)
  → kernel runs to next wait state, yields Effect[]
  → runtime processes effects, updates memory store
  → saved_fsm_state = kernel.serialize_state()
  → WASM module evicted from memory
```

The WASM module itself is stateless and cacheable — multiple agent instances of the same agent share a single loaded module.

---

## Effect Types

Effects are the kernel's output — the only way the kernel communicates with the outside world. The SDK dispatches each effect to the handler registered by the runtime.

### Current effects (behavior kernel today)

| Effect | Fields | Description |
|---|---|---|
| `Goal` | `text` | Communicates the state's goal to the LLM context |
| `Guide` | `text` | Provides instruction text (shown inline or to LLM) |
| `Teach` | `text` | References a teaching file |
| `RequestInteract` | — | Signals the agent is waiting for user input |
| `Transition` | `from`, `to` | FSM state change notification |
| `RunScript` | `target`, `label?`, `silent` | Execute a script |
| `RunSubagent` | `target`, `label?`, `background` | Call another agent |
| `RunTool` | `target`, `label?` | Call an external tool |
| `SetMemory` | `domain`, `key`, `value` | Write a value to a memory domain |
| `ApplyCss` / `RemoveCss` | `value` | DOM style manipulation |
| `ParseError` | `message` | Syntax/semantic error during load |

> HTML and video effects were removed pending a formal GenUI design.
> See [RFC-0007: GenUI and Templates](./0007-genui-and-templates.md).

### Proposed effects (pending from other RFCs)

These are not yet in the behavior kernel. Kernels that support them must document it.

| Effect | Fields | RFC |
|---|---|---|
| `RunLib` | `lib_id`, `method`, `args` | [RFC-0002](./0002-lib-format.md) |
| `QueryKnowledge` | `knowledge_id`, `query`, `limit?` | [RFC-0003](./0003-knowledge-format.md) |

---

## SDK Dispatch Model

The SDK is a minimal dispatch layer. It does not define how effects are resolved — only that each effect type can have a registered handler:

```typescript
sdk.registerHandler('RunTool', myToolHandler)
sdk.registerHandler('RunSubagent', mySubagentHandler)
sdk.registerHandler('SetMemory', myMemoryHandler)
// etc.
```

The SDK calls the matching handler with the effect payload and feeds the result back to the kernel via the appropriate `send_*` call. Effects with no registered handler cause the SDK to throw an `UnhandledEffect` error.

---

## Impact Review Pending

> [!IMPORTANT]
> Before moving this RFC from Draft → Review, verify impact in:
>
> - **`dsl/kernel-dsl/`** — current behavior kernel: remove internal `get_memory()`/`set_memory()` storage; add `inject_memory()`; add `serialize_state()`/`restore_state()`; update `get_graph()` to return SCXML
> - **`apps/dot-agent-cli/`** — CLI drives the execution loop directly; after this change it takes ownership of memory storage and must call `inject_memory()` before each `send_intent()`
> - **`dsl/language-server/`** — LSP uses the compiler, not the runtime kernel; verify whether diagnostics for `set` statements or memory domain references are affected
> - **`murici`** — primary runtime; confirm it takes responsibility for storing memory, enforcing permission checks, and calling `inject_memory()` before dispatching intents

---

## Related

- [RFC-0001: Addon Protocol](./0001-addon-protocol.md)
- [RFC-0002: Lib Format](./0002-lib-format.md) — defines `RunLib` effect
- [RFC-0003: Knowledge Format](./0003-knowledge-format.md) — defines `QueryKnowledge` effect
- `dsl/kernel-dsl/src/lib.rs` — current behavior kernel implementation
- `dsl/kernel-dsl/src/effect.rs` — current Effect enum
