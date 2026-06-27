<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# The Manifest (`.description`)

The `.description` file defines an agent's identity, public interface, and security requirements. It is the public contract — other agents and registries index it without ever reading the behavior.

For the interchange format produced by parsing this file, see [`docs/reference/description-file.md`](../../docs/reference/description-file.md).
For type declarations used in this file, see [`dsl/reference/types.md`](types.md).

---

## 1. Structure

The `agent` keyword defines the root node. Identity metadata is indented under it. Semantic blocks (`description`, `behavior`, `requires`, etc.) are top-level in the file.

```
agent Analyst
  domain figma.com
  license MIT
  terms  https://figma.com/terms
  privacy https://figma.com/privacy

description
  A financial agent that analyzes expenses and generates reports

persona analyst-persona.md

behavior analyst.behavior

requires BankStatement

input
  Person "The user requesting financial analysis"

capabilities
  CalculateAction "Enables mathematical calculations"
  SearchAction    "Queries external financial rates"

output
  FinancialProduct "The recommended product for the user"
```

---

## 2. Keywords Reference

### `agent` — Identity & Metadata

```
agent Doctor
  domain example.com
  license MIT
```

| Field | Required | Description |
|---|---|---|
| `domain` | No | Declares the canonical authority for this agent (e.g. `figma.com`). Enables Runtime identity verification via W3C DIDs or `.well-known`. |
| `license` | No | SPDX license identifier. |
| `terms` | No | URL to terms of service. |
| `privacy` | No | URL to privacy policy. |

### `description` — Semantic Indexing

Free-text description used by the Runtime for semantic indexing and agent discovery.

```
description
  A financial agent that analyzes expenses and generates reports
```

### `persona` — Reasoning Guidelines

Inline reference to a Markdown file with persona and reasoning guidelines for the LLM:

```
persona analyst-persona.md
```

### `behavior` — Implementation Link

**Required.** The entry `.behavior` file that manages state and transitions. Always inline:

```
behavior analyst.behavior
```

The compiler reads this field to locate the entry file, then recursively follows all `merge` declarations to produce the consolidated `agent.behavior` bundle. If this block is absent the compiler throws `E_DESC`. If the path is absolute or escapes the agent root, E014 is emitted. Use `PackOptions.description` to override `.description` file discovery, but the `behavior` block inside the file is always the authoritative source for the entry file name.

### `requires` — Runtime Prerequisites

Types the Runtime must guarantee are in context before invoking the `.behavior`:

```
requires BankStatement

// or compact form:
requires BankStatement, UserProfile
```

### `input` — Input Types

Input data types the agent needs to operate:

```
input
  Person "The user requesting financial analysis"
  MedicalCondition
```

### `capabilities` — Sandboxing Contract

Actions (Schema.org `Action`) or resources the agent may use. This is both a declaration and a **sandboxing contract** — the Runtime enforces this list against what the `.behavior` actually executes:

```
capabilities
  CalculateAction "Enables mathematical calculations"
  SearchAction    "Queries external financial rates"
```

**High-risk capabilities require explicit human authorization:**

| Capability | Effect |
|---|---|
| `AgentCreation` | Can create sub-agents |
| `SelfEvolution` | Can modify its own behavior files |
| `AgentUpgrade` | Can request runtime version updates |

### `output` — Output Type

The data type returned by the agent:

```
output
  FinancialProduct "The recommended product for the user"
```

---

## 3. Compact vs. Documented Syntax

`requires`, `input`, `capabilities`, and `output` support two forms:

**Compact** (inline, no descriptions):
```
input Patient, MedicalCondition
capabilities DiagnoseAction, CreateAction
requires Prontuario, UserProfile
```

**Documented** (indented block, optional descriptions):
```
input
  Patient "The patient to attend"
  MedicalCondition

capabilities
  DiagnoseAction         "Emits clinical diagnoses"
  custom.SpeechSynthesis "Voice synthesis"
```

---

## 4. Comments

Any line (or inline fragment) starting with `//` is ignored by the parser:

```
// This agent is in draft
agent Draft
  domain example.com

type BankStatement
  category https://www.wikidata.org/wiki/Q806653
  account: Person      "Account holder"
  // avatar is optional
  avatar?: ImageObject
```

---

## 5. Identity and Anti-Spoofing

Declaring `domain figma.com` turns the local manifest into a pointer to the official authority:

1. The Runtime verifies identity using W3C DIDs or `.well-known` directories
2. The Runtime may fetch the canonical definition from `https://figma.com/.well-known/agents/Figma.description` and override the local manifest
3. If an attacker creates an agent with `domain figma.com`, the Runtime fetches from the real server — if the server doesn't list that agent, the local package is invalidated

Informal community agents may omit `domain` — the Runtime treats them as "Unverified".
