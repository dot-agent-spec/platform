<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DescriptionFile — Interchange Contract

`DescriptionFile` is the JSON type that represents a fully parsed `.description` file. It is the stable contract between the parsing layer and the compiler, which uses it to populate `aboutme.json` and generate `types.json`.

---

## 1. Role in the Architecture

```
.description source text
        │
        ↓
@dot-agent/parser-dsl  ── parse_description() ──→  DescriptionFile (JSON)
                                                           │
                                       ┌───────────────────┴────────────────────┐
                                       ↓                                        ↓
                              pack.ts (aboutme.json)                    schema.ts (types.json)
                              name, description, domain,                JSON Schema 2020-12
                              license, capabilities, requires           for input, output, types
```

| Role | Package / File | How it uses DescriptionFile |
|---|---|---|
| Producer | `@dot-agent/parser-dsl` | `parse_description()` returns `{ "ok": DescriptionFile }` |
| Consumer — packaging | `@dot-agent/compiler` `pack.ts` | Populates `aboutme.json`: name, description, domain, license, capabilities, requires |
| Consumer — schema gen | `@dot-agent/compiler` `schema.ts` | Generates `.agent/types.json` from `types`, `input`, `output` |
| Consumer — LSP | `@dot-agent/language-server` | Hover, completions, diagnostics for `.description` files |

`@dot-agent/kernel-dsl` does **not** consume `DescriptionFile` — it links `@dot-agent/parser-dsl` as an `rlib` for `BehaviorFile` only.

---

## 2. Stability

`DescriptionFile` is stable across patch and minor versions of `@dot-agent/parser-dsl`. The following guarantees apply:

- **Field additions** (new optional fields): non-breaking.
- **Field removals or renames**: breaking — treated as a major version bump.
- **New `PropertyType` variants** (new `kind` values): non-breaking for consumers that use an exhaustive-or-ignore pattern.

---

## 3. Top-Level Schema

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

// Used for items in requires, input, output, and capabilities blocks.
// description is null for inline comma-separated forms (e.g. input Foo, Bar).
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
  | { kind: 'reference'; value: string }   // "namespace.Name" concatenated by parser
  | { kind: 'array';     value: PropertyType }
  | { kind: 'enum';      value: string[] }
```

---

## 4. Minimal Example

Given the `.description` source:

```
agent Doctor
  domain health.example.com
  license MIT

description
  Clinical diagnostic agent.

capabilities
  TriagePatient "Initial patient triage"
  IssueReferral

input Patient
output Prescription
```

`parse_description()` returns:

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
    { "name": "TriagePatient", "description": "Initial patient triage" },
    { "name": "IssueReferral", "description": null }
  ],
  "requires": [],
  "input":  [{ "name": "Patient",      "description": null }],
  "output": [{ "name": "Prescription", "description": null }],
  "types": []
}
```

---

## 5. TypeDefinition Example

Given a `.description` with a custom type:

```
type Patient
  category https://schema.org/Patient
  concept https://www.wikidata.org/wiki/Q181600

  name: string
  dob?: string "Date of birth"
  status: Enum(active, inactive, deceased)
```

The `types` array contains:

```json
[
  {
    "name": "Patient",
    "category": { "uri": "https://schema.org/Patient", "label": null },
    "concept":  { "uri": "https://www.wikidata.org/wiki/Q181600", "label": null },
    "properties": [
      { "name": "name",   "type": { "kind": "primitive", "value": "string" }, "is_optional": false, "description": null },
      { "name": "dob",    "type": { "kind": "primitive", "value": "string" }, "is_optional": true,  "description": "Date of birth" },
      { "name": "status", "type": { "kind": "enum", "value": ["active", "inactive", "deceased"] }, "is_optional": false, "description": null }
    ]
  }
]
```

The compiler's `schema.ts` converts this into a JSON Schema 2020-12 object and writes it to `.agent/types.json`.

---

## 6. Mapping to aboutme.json

The compiler maps `DescriptionFile` fields to `aboutme.json` as follows:

| DescriptionFile field | aboutme.json field | Notes |
|---|---|---|
| `agent.name` | `name` | Required |
| `description` | `description` | Defaults to `""` if absent |
| `agent.domain` | `domain` | Defaults to `""` if absent |
| `agent.license` | `license` | Defaults to `""` if absent |
| `capabilities` | `capabilities` | Each `AnnotatedRef` → `{ id: name, description }` |
| `requires` | `requires` | `AnnotatedRef[]` passed through |
| *(not in file)* | `purpose` | Defaults to `"unknown"`. Derivation via LLM at pack time (Wikidata QID) is pending — see RFC-0013. |

`input`, `output`, and `types` do **not** appear in `aboutme.json`. They go to `.agent/types.json` (generated only when the agent declares public types; conditional).

`.agent/files.json` is always generated for any agent that includes `agent.description` and `agent.behavior`. It is not conditional.

---

## 7. Further Reading

- `.description` language specification: [`docs/reference/manifest.md`](manifest.md)
- Custom type declarations: [`docs/reference/types.md`](types.md)
- Behavior interchange contract: [`docs/reference/behavior-file.md`](behavior-file.md)
- Full API reference: [`packages/parser-dsl/docs/reference/api.md`](../../packages/parser-dsl/docs/reference/api.md)
