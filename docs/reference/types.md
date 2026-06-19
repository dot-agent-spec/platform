<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Types — Implementation Reference

> For the **language syntax** of type declarations (keywords, property forms, namespace resolution), see [`dsl/reference/types.md`](../../dsl/reference/types.md).

This document covers the **implementation side**: how `@dot-agent/compiler` validates types and how `types.json` is generated.

---

## Compiler Validation

`@dot-agent/compiler` validates type declarations in `.description` files at pack time:

- Every `type` declaration must have a `category` field with a valid URI — missing `category` is a lint error (`E001` or equivalent)
- Property types are resolved against local declarations, `std.*`, and Schema.org/Wikidata in that precedence order
- Arrays (`[TypeName]`) and Enums (`Enum(a, b)`) are valid property value forms
- Optional marker `?` before `:` is valid on any property

For lint codes, see [`packages/compiler/docs/reference/lint-codes.md`](../../packages/compiler/docs/reference/lint-codes.md).

---

## `types.json` Generation

When `@dot-agent/compiler` packs a `.agent` bundle, it generates `types.json` from the `input`, `output`, and `type` declarations in the `.description` file. The schema follows JSON Schema 2020-12.

This file is used by:
- The Runtime for type validation at agent invocation
- Registries for capability and type indexing
- Cross-agent adapter generation

The generation logic lives in [`packages/compiler/src/schema.ts`](../../packages/compiler/src/schema.ts).
