<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# behavior-parser — API Reference

This document covers the WASM-exported API, the `FSMDefinition` JSON type, SCXML output format, and error handling. For the Rust AST types used when linking as an `rlib`, see [`ast.md`](ast.md).

---

## 1. WASM Exports

All functions are pure and stateless. Each call parses the source text from scratch.

### `init(): Promise<void>`

Initializes the WASM module. Must be called once before any other function. Safe to call multiple times (no-op after first call).

```typescript
import init from '@dot-agent/behavior-parser';
await init();
```

---

### `parse(text: string): string`

Parses `.behavior` source text and returns a JSON envelope:

| Outcome | Return value |
|---|---|
| Success | `{ "ok": FSMDefinition }` |
| Parse error | `{ "error": "..." }` |

```typescript
const result = JSON.parse(parse(src));

if ('error' in result) {
  // result.error: string — human-readable parse error message
} else {
  // result.ok: FSMDefinition
  const fsm = result.ok;
}
```

---

### `get_graph(text: string): string`

Generates a W3C SCXML document from the behavior source. See [Section 3](#3-scxml-output) for the output format.

Returns an empty string on parse error (does not throw).

---

### `get_states(text: string): string`

Returns a JSON-encoded `string[]` of state names in declaration order.

```typescript
const states: string[] = JSON.parse(get_states(src));
// → ["welcome", "helping", "farewell"]
```

Returns `"[]"` on parse error.

---

### `get_intents_for_state(text: string, state_name: string): string`

Returns a JSON-encoded `string[]` of intent names that are valid in the given state.

```typescript
const intents: string[] = JSON.parse(get_intents_for_state(src, 'welcome'));
// → ["help", "cancel"]
```

Returns `"[]"` if the state is not found, has no `interact` block, or the source fails to parse.

**Note:** Collects intents from both `intent_trigger` nodes that are direct siblings in the state body and those nested inside an `interact_stmt.handlers` block. Both forms are grammatically valid and produce identical results here.

---

## 2. FSMDefinition

`FSMDefinition` is the JSON representation of a parsed `.behavior` file. It is the stable interchange type between the behavior-parser and its consumers.

### TypeScript interface

```typescript
interface FSMDefinition {
  merges: string[];                // merge "other.behavior" declarations (resolved externally)
  global_triggers: TriggerDecl[];  // on event "..." blocks at file scope
  states: StateDef[];
}

interface TriggerDecl {
  event: string;
  body: Statement[];
}

interface StateDef {
  name: string;
  body: Statement[];
}

// Statement is a discriminated union on the "type" field.
// See Section 4 for all variants.
type Statement =
  | GoalStmt
  | GuideStmt
  | TeachStmt
  | InteractStmt
  | TransitionStmt
  | IntentTrigger
  | OfftopicStmt
  | AfterStmt
  | RunStmt
  | MemoryStmt
  | ConditionalStmt
  | ApplyStmt
  | RemoveStmt
  | ParallelStmt
  | OnCompleteStmt
  | OnFailedStmt;
```

### Full example

```json
{
  "merges": ["shared/greetings.behavior"],
  "global_triggers": [
    {
      "event": "session.ended",
      "body": [{ "type": "transition_stmt", "state": "farewell" }]
    }
  ],
  "states": [
    {
      "name": "welcome",
      "body": [
        { "type": "goal_stmt", "text": "Help the user get started" },
        { "type": "interact_stmt", "handlers": [] },
        { "type": "intent_trigger", "intent": "help", "body": "helping" },
        { "type": "intent_trigger", "intent": "cancel", "body": [
          { "type": "guide_stmt", "text": "Goodbye" },
          { "type": "transition_stmt", "state": "farewell" }
        ]}
      ]
    },
    {
      "name": "helping",
      "body": [
        { "type": "goal_stmt", "text": "Provide targeted assistance" }
      ]
    },
    {
      "name": "farewell",
      "body": [
        { "type": "teach_stmt", "text": "Session complete" }
      ]
    }
  ]
}
```

---

## 3. SCXML Output

`get_graph()` returns W3C SCXML ([spec](https://www.w3.org/TR/scxml/)).

### Structure rules

- The root `<scxml>` element sets `initial` to the first declared state.
- States with no outgoing transitions are emitted as `<final id="..."/>`.
- States with at least one outgoing transition are emitted as `<state id="...">` with `<transition>` children.
- Transitions carry an `event` attribute when the trigger is named (intents, offtopic, after, complete, failed). Unconditional transitions (`transition to X`) emit `<transition target="X"/>` with no event.

### Event name mapping

| DSL construct | SCXML event |
|---|---|
| `on intent "foo"` | `foo` |
| `on offtopic` | `offtopic` |
| `after N prompts` | `after_N_prompts` |
| `on complete` | `complete` |
| `on failed` | `failed` |
| `transition to X` | *(no event — unconditional)* |

### Example

For a `.behavior` with three states:

```
state welcome
  goal "Welcome"
  interact
  on intent "help" transition to helping
  on intent "bye" transition to farewell

state helping
  goal "Help"
  interact
  on intent "done" transition to welcome

state farewell
  goal "Goodbye"
```

`get_graph()` produces:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="welcome">
  <state id="welcome">
    <transition event="help" target="helping"/>
    <transition event="bye" target="farewell"/>
  </state>
  <state id="helping">
    <transition event="done" target="welcome"/>
  </state>
  <final id="farewell"/>
</scxml>
```

**Static vs. runtime SCXML:** This output represents the static structure of the behavior, not the active execution state. The kernel's `get_graph()` method returns the same structure annotated with the current active state.

---

## 4. Statement Variants

All `Statement` objects use a `"type"` discriminant field. The table below lists each variant with its JSON type tag, fields, and DSL equivalent.

| JSON `type` | Fields | DSL form |
|---|---|---|
| `goal_stmt` | `text: string` | `goal "text"` |
| `guide_stmt` | `text: string` | `guide "text"` |
| `teach_stmt` | `text: string` | `teach "text"` |
| `interact_stmt` | `handlers: Statement[]` | `interact` |
| `transition_stmt` | `state: string` | `transition to <state>` |
| `intent_trigger` | `intent: string`, `body: IntentBody` | `on intent "..."` |
| `offtopic_stmt` | `body: Statement[]` | `on offtopic` |
| `after_stmt` | `prompts: number`, `body: Statement[]` | `after N prompts` |
| `run_stmt` | See [RunStmt](#runstmt) | `run script/subagent/tool "..."` |
| `memory_stmt` | `target: MemoryPath`, `op: AssignOp`, `value: Expr` | `set domain.key = value` |
| `conditional_stmt` | `condition: Condition`, `then: Statement[]`, `else?: Statement[]` | `if ... / else` |
| `apply_stmt` | `target: MediaKind`, `text: string` | `apply css "..."` |
| `remove_stmt` | `target: MediaKind`, `text: string` | `remove css "..."` |
| `parallel_stmt` | `body: Statement[]`, `on_complete?: Statement[]`, `on_failed?: Statement[]` | `parallel` |
| `on_complete_stmt` | `body: Statement[]` | `on complete` |
| `on_failed_stmt` | `body: Statement[]` | `on failed` |

### IntentBody

`intent_trigger.body` is either a string (inline `transition to` shorthand) or a `Statement[]` (block form):

```typescript
type IntentBody = string | Statement[];

// Inline: "on intent "help" transition to helping"
{ "type": "intent_trigger", "intent": "help", "body": "helping" }

// Block: "on intent "help"\n  guide "Sure"\n  transition to helping"
{ "type": "intent_trigger", "intent": "help", "body": [
  { "type": "guide_stmt", "text": "Sure" },
  { "type": "transition_stmt", "state": "helping" }
]}
```

### RunStmt

```typescript
interface RunStmt {
  type: "run_stmt";
  kind: "script" | "subagent" | "tool";
  target: string;
  label: string | null;       // as "label"
  modifier: "silent" | "background" | null;
  each: string | null;        // each "domain.key"
  on_failed: Statement[] | null;
}
```

### MemoryPath and AssignOp

```typescript
interface MemoryPath {
  domain: "context" | "session" | "worksession" | "user";
  key: string;
}

type AssignOp = "=" | "+=" | "-=";
```

### Condition and Expr

```typescript
interface Condition {
  parts: [LogicalOp | null, Expr][];
}

type LogicalOp = "and" | "or";

type Expr =
  | Value
  | { left: Value; op: CompareOp; right: Value };

type CompareOp = "==" | "!=" | ">" | "<" | ">=" | "<=";

type Value = string | number | boolean | null;
// Note: memory path references (e.g. session.lang) are also serialized as strings.
```

---

## 5. Input Normalization

All functions normalize the source text before parsing: a trailing `\n` is appended if the input does not already end with one.

This is transparent to callers and does not affect the returned AST or SCXML. It exists because the behavior grammar uses newlines as statement terminators — files without a trailing newline produce a `MISSING _newline` node in the tree-sitter CST, causing `has_error = true` on valid input. The JavaScript tree-sitter binding is tolerant of this; the Rust binding is not (tree-sitter#1200).

---

## 6. Error Format

When `parse()` returns an error:

```json
{ "error": "Parse error at line 3: unexpected token '}'" }
```

The error message is a human-readable string from the tree-sitter parser. It is not machine-parseable — do not rely on its format for programmatic error handling.

All other functions (`get_graph`, `get_states`, `get_intents_for_state`) return empty/default values on parse error rather than propagating the error. Use `parse()` first when you need error details.
