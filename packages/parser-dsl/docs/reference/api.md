<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# parser-dsl — API Reference

This document covers the WASM-exported API, the `BehaviorFile` and `DescriptionFile` JSON types, SCXML output format, and error handling. For the Rust AST types used when linking as an `rlib`, see [`ast.md`](ast.md).

---

## 1. WASM Exports

All functions are pure and stateless. Each call parses the source text from scratch.

### `init(): Promise<void>`

Initializes the WASM module. Must be called once before any other function. Safe to call multiple times (no-op after first call).

```typescript
import init from '@dot-agent/parser-dsl';
await init();
```

---

### `parse_behavior(text: string): string`

Parses `.behavior` source text and returns a JSON envelope:

| Outcome | Return value |
|---|---|
| Success | `{ "ok": BehaviorFile }` |
| Parse error | `{ "error": "..." }` |

```typescript
const result = JSON.parse(parse_behavior(src));

if ('error' in result) {
  // result.error: string — human-readable parse error message
} else {
  // result.ok: BehaviorFile
  const bf = result.ok;
}
```

---

### `parse_description(text: string): string`

Parses `.description` source text and returns a JSON envelope:

| Outcome | Return value |
|---|---|
| Success | `{ "ok": DescriptionFile }` |
| Parse error | `{ "error": "..." }` |

```typescript
const result = JSON.parse(parse_description(src));

if ('error' in result) {
  // result.error: string
} else {
  // result.ok: DescriptionFile
  const df = result.ok;
  console.log(df.agent.name, df.capabilities);
}
```

---

### `get_graph(text: string): string`

Generates a W3C SCXML document from `.behavior` source. See [Section 3](#3-scxml-output) for the output format.

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

## 2. BehaviorFile

`BehaviorFile` is the JSON representation of a parsed `.behavior` file. It is the stable interchange type between the parser and its consumers.

### TypeScript interface

```typescript
interface BehaviorFile {
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
  | GoalStmt | GuideStmt | TeachStmt
  | InteractStmt | TransitionStmt | IntentTrigger | OfftopicStmt | AfterStmt
  | RunStmt | MemoryStmt | ConditionalStmt
  | ApplyStmt | RemoveStmt | ParallelStmt | OnCompleteStmt | OnFailedStmt;
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
    }
  ]
}
```

---

## 3. DescriptionFile

`DescriptionFile` is the JSON representation of a parsed `.description` file. Produced by `parse_description()`; consumed by the compiler to populate `aboutme.json` and generate `types.json`.

### TypeScript interface

```typescript
interface DescriptionFile {
  agent: AgentDecl;
  description?: string;
  persona?: string;       // file reference, e.g. "SOUL.md"
  behavior?: string;      // file reference, e.g. "agent.behavior"
  requires: AnnotatedRef[];
  input: AnnotatedRef[];
  capabilities: AnnotatedRef[];
  output: AnnotatedRef[];
  types: TypeDefinition[];
}

interface AgentDecl {
  name: string;
  domain?: string;
  license?: string;
  terms?: string;
  privacy?: string;
}

interface AnnotatedRef {
  name: string;
  description?: string;
}

interface OntologyRef {
  uri: string;
  label?: string;
}

interface TypeDefinition {
  name: string;
  category: OntologyRef;
  concept?: OntologyRef;
  properties: PropertyDecl[];
}

interface PropertyDecl {
  name: string;
  type: PropertyType;
  is_optional: boolean;
  description?: string;
}

type PropertyType =
  | { kind: 'primitive'; value: string }
  | { kind: 'reference'; value: string }   // namespace.Name concatenated
  | { kind: 'array';     value: PropertyType }
  | { kind: 'enum';      value: string[] }
```

### Full example

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
  "persona": "SOUL.md",
  "behavior": null,
  "capabilities": [
    { "name": "TriagePatient", "description": "Initial patient triage" }
  ],
  "requires": [],
  "input": [{ "name": "Patient", "description": null }],
  "output": [{ "name": "Prescription", "description": null }],
  "types": [
    {
      "name": "Patient",
      "category": { "uri": "https://schema.org/Patient", "label": null },
      "concept": null,
      "properties": [
        { "name": "name", "type": { "kind": "primitive", "value": "string" }, "is_optional": false, "description": null },
        { "name": "dob",  "type": { "kind": "primitive", "value": "string" }, "is_optional": true,  "description": "Date of birth" }
      ]
    }
  ]
}
```

---

## 4. SCXML Output

`get_graph()` returns W3C SCXML ([spec](https://www.w3.org/TR/scxml/)).

### Structure rules

- The root `<scxml>` element sets `initial` to the first declared state.
- States with no outgoing transitions are emitted as `<final id="..."/>`.
- States with at least one outgoing transition are emitted as `<state id="...">` with `<transition>` children.

### Event name mapping

| DSL construct | SCXML event |
|---|---|
| `on intent "foo"` | `foo` |
| `on offtopic` | `offtopic` |
| `after N prompts` | `after_N_prompts` |
| `on complete` | `complete` |
| `on failed` | `failed` |
| `transition to X` | *(no event — unconditional)* |

### Example output

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

---

## 5. Statement Variants

All `Statement` objects use a `"type"` discriminant field.

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

`intent_trigger.body` is either a string (inline `transition to` shorthand) or a `Statement[]`:

```typescript
type IntentBody = string | Statement[];

// Inline: { "type": "intent_trigger", "intent": "help", "body": "helping" }
// Block:  { "type": "intent_trigger", "intent": "help", "body": [ ... ] }
```

### RunStmt

```typescript
interface RunStmt {
  type: "run_stmt";
  kind: "script" | "subagent" | "tool";
  target: string;
  label: string | null;
  modifier: "silent" | "background" | null;
  each: string | null;
  on_failed: Statement[] | null;
}
```

### Condition and Expr

```typescript
interface Condition {
  parts: [LogicalOp | null, Expr][];
}
type LogicalOp = "and" | "or";
type Expr = Value | { left: Value; op: CompareOp; right: Value };
type CompareOp = "==" | "!=" | ">" | "<" | ">=" | "<=";
type Value = string | number | boolean | null;
```

---

## 6. Input Normalization

All parse functions append `\n` to the input if it does not already end with one. This is transparent to callers and does not affect the returned AST. It exists because both grammars use newlines as statement terminators — files without a trailing newline produce a `MISSING _newline` node in tree-sitter, causing `has_error = true` on valid input (tree-sitter#1200).

---

## 7. Error Format

When a parse function returns an error:

```json
{ "error": "Syntax error at line 3, column 1:\n  @@@ broken" }
```

The error message is human-readable. Do not rely on its format for programmatic error handling. All other functions (`get_graph`, `get_states`, `get_intents_for_state`) return empty/default values on parse error rather than propagating the error.
