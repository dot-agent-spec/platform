<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Type System

The dot-agent DSL uses explicit type contracts to ensure deterministic data flow between agents. The Runtime never infers the structure of a custom type — all contracts must be declared.

For string constraints and new primitive types, see [RFC-0016](../../rfcs/0016-string-constraints.md).
For the standard library (`std.*` types), see [RFC-0017](../../rfcs/0017-standard-library.md).

---

## Custom Type Declaration

Custom types are defined using the `type` keyword in a `.description` file:

```
type BankStatement
  category https://www.wikidata.org/wiki/Q806653
  concept  https://schema.org/BankAccount
  account: Person      "Account holder"
  transactions: [Transaction]
  balance: number
  status: Enum(active, closed, suspended)
  avatar?: ImageObject "Holder photo (optional)"
```

### Semantic anchors

| Keyword | Required | Function |
|---|---|---|
| `category` | Yes | Wikidata URL anchoring the type to a stable semantic category. Used by the Runtime for adapter compatibility checks between agents. |
| `concept` | No | Supplementary ontology annotation (Wikidata, Schema.org, or other). Not used in runtime decisions. |

`category` references Wikidata QIDs: stable, multilingual, and carrying a maintained semantic hierarchy that enables subclass-based compatibility detection.

### Property forms

| Form | Example | Semantics |
|---|---|---|
| Simple reference | `account: Person` | Single type |
| Array | `transactions: [Transaction]` | Typed list |
| Enum | `status: Enum(active, closed)` | Closed set of literals |
| Optional | `avatar?: ImageObject` | `?` marks the field as optional |
| With description | `account: Person "Holder"` | Quoted string documents the property |

### Primitive types

| Type | Semantics |
|---|---|
| `string` | Text value, single line |
| `text` | Multiline or rich text (Markdown) |
| `number` | Numeric value |
| `boolean` | `true` or `false` |
| `url` | URL string |
| `file(mime)` | Binary file, with optional MIME type hint (e.g. `file(image)`, `file(audio)`) |

---

## Namespace Resolution

Types without a namespace are resolved by the Runtime in the following precedence order:

1. **Local** — `type` declarations in the agent's own package (absolute precedence)
2. **Standard Library** — `std.*` types provided by the Runtime (see [RFC-0017](../../rfcs/0017-standard-library.md))
3. **Global** — Schema.org / Wikidata

**Absolute shadowing:** a local `type Prompt` always shadows `std.Prompt`, ensuring that updates to the standard library never break existing agent logic.

---

## Naming Conventions

| Element | Convention | Examples |
|---|---|---|
| Agent name | Space-separated words, each capitalized | `agent Doctor`, `agent Mickey Mouse` |
| Custom type | Continuous PascalCase | `UserProfile`, `BankStatement` |
| Standard library | `std.` + PascalCase | `std.Prompt`, `std.Image` |
| Custom namespace | `ns.` + PascalCase | `custom.SpeechSynthesis` |
| Type property | camelCase | `patient`, `createdAt`, `transactionList` |

The parser distinguishes agent names from types by structural context: after `agent`, it always expects an `agent_name` (space-separated words); after `input`, `output`, etc., it always expects type references (PascalCase).
