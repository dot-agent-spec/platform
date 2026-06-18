<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# BehaviorFile — Interchange Contract

`BehaviorFile` is the JSON type that represents a fully parsed `.behavior` file. It is the stable contract between the parsing layer and its consumers across the dot-agent tooling stack.

---

## 1. Role in the Architecture

```
.behavior source text
        │
        ↓
@dot-agent/parser-dsl  ── parse_behavior() ──→  BehaviorFile (JSON)
        │                                              │
        │ (as Rust rlib)                               │
        ↓                                             ↓
@dot-agent/kernel-dsl               @dot-agent/compiler
(FSM execution runtime)             (semantic linting)
```

| Role | Package | How it uses BehaviorFile |
|---|---|---|
| Producer | `@dot-agent/parser-dsl` | `parse_behavior()` returns `{ "ok": BehaviorFile }` |
| Consumer — tooling | `@dot-agent/compiler` | Semantic validation: isolated states, unreachable transitions |
| Consumer — runtime | `@dot-agent/kernel-dsl` | Links parser-dsl as Rust `rlib`; uses `BehaviorFile` directly (no JSON) |
| Future consumer | `@dot-agent/sdk` | Will load BehaviorFile for agent bundle resolution |

---

## 2. Stability

`BehaviorFile` is stable across patch and minor versions of `@dot-agent/parser-dsl`. The following guarantees apply:

- **Field additions** (new optional fields): non-breaking.
- **Field removals or renames**: breaking — treated as a major version bump.
- **New `Statement` variants** (new `type` values): non-breaking for consumers that use an exhaustive-or-ignore pattern; breaking only for consumers that treat unknown variants as errors.

The `type` discriminant field on `Statement` uses the grammar node name (e.g. `goal_stmt`, `intent_trigger`) and is stable.

---

## 3. Top-Level Schema

```typescript
interface BehaviorFile {
  merges: string[];                // paths from "merge ..." declarations
  global_triggers: TriggerDecl[];  // "on event ..." blocks at file scope
  states: StateDef[];              // in declaration order
}

interface TriggerDecl {
  event: string;
  body: Statement[];
}

interface StateDef {
  name: string;
  body: Statement[];
}
```

---

## 4. Statement Variants

Statements use a `"type"` discriminant. The `body` of `StateDef` and `TriggerDecl` contains `Statement[]`.

### Orientation statements

```typescript
{ type: "goal_stmt";  text: string }
{ type: "guide_stmt"; text: string }
{ type: "teach_stmt"; text: string }
```

### Control flow

```typescript
{ type: "interact_stmt"; handlers: Statement[] }
// Note: handlers is always [] in current grammar; intent_trigger and
// offtopic_stmt appear as siblings in the parent body, not inside handlers.

{ type: "transition_stmt"; state: string }

{ type: "intent_trigger"; intent: string; body: string | Statement[] }
// body is a string (target state name) for inline form,
// Statement[] for block form.

{ type: "offtopic_stmt"; body: Statement[] }

{ type: "after_stmt"; prompts: number; body: Statement[] }

{ type: "conditional_stmt";
  condition: Condition;
  then: Statement[];
  else?: Statement[] }

{ type: "parallel_stmt";
  body: Statement[];
  on_complete?: Statement[];
  on_failed?: Statement[] }

{ type: "on_complete_stmt"; body: Statement[] }
{ type: "on_failed_stmt";   body: Statement[] }
```

### Side effects

```typescript
{ type: "run_stmt";
  kind: "script" | "subagent" | "tool";
  target: string;
  label: string | null;
  modifier: "silent" | "background" | null;
  each: string | null;
  on_failed: Statement[] | null }

{ type: "memory_stmt";
  target: { domain: "context" | "session" | "worksession" | "user"; key: string };
  op: "=" | "+=" | "-=";
  value: Expr }

{ type: "apply_stmt";  target: "css" | "html" | "video"; text: string }
{ type: "remove_stmt"; target: "css" | "html" | "video"; text: string }
```

### Condition and Expr

```typescript
interface Condition {
  parts: [null | "and" | "or", Expr][];
  // parts[0][0] is always null (no leading operator)
}

type Expr =
  | Value
  | { left: Value; op: "==" | "!=" | ">" | "<" | ">=" | "<="; right: Value }

type Value = string | number | boolean | null;
// string covers both literal strings and memory path references (e.g. "session.lang")
```

---

## 5. Minimal Example

```json
{
  "merges": [],
  "global_triggers": [],
  "states": [
    {
      "name": "welcome",
      "body": [
        { "type": "goal_stmt", "text": "Help the user" },
        { "type": "interact_stmt", "handlers": [] },
        { "type": "intent_trigger", "intent": "help", "body": "helping" }
      ]
    },
    {
      "name": "helping",
      "body": [
        { "type": "goal_stmt", "text": "Provide assistance" }
      ]
    }
  ]
}
```

---

## 6. Further Reading

- Full TypeScript types and examples: [`packages/parser-dsl/docs/reference/api.md`](../../packages/parser-dsl/docs/reference/api.md)
- Rust AST types for `rlib` consumers: [`packages/parser-dsl/docs/reference/ast.md`](../../packages/parser-dsl/docs/reference/ast.md)
- `.behavior` language specification: [`docs/reference/behavior.md`](behavior.md)
- `.description` interchange contract: [`docs/reference/description-file.md`](description-file.md)
- Architecture map showing producers and consumers: [`docs/explanation/architecture/map.md`](../explanation/architecture/map.md)
