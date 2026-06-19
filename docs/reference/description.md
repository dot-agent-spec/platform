<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# The `.description` File — Implementation Reference

> For the **language syntax** of `.description` files (keywords, blocks, type declarations), see [`dsl/reference/description.md`](../../dsl/reference/description.md).

This document covers the **implementation side**: the `DescriptionFile` interchange format produced by `@dot-agent/parser-dsl`, and how the compiler uses it to generate `aboutme.json` and `types.json`.

---

## DescriptionFile Interchange Contract

See [`docs/reference/description-file.md`](description-file.md) for the full JSON schema of `DescriptionFile` — the stable contract between `@dot-agent/parser-dsl` and its consumers.

---

## Runtime Scope

The `.description` file is read by the Runtime for:

- **Capability enforcement** — the `capabilities` block defines the sandbox; the Runtime enforces it against what `.behavior` actually executes
- **Dependency resolution** — `requires` tells the Runtime what must be in context before invoking the behavior
- **Tool discovery** — registries index `.description` without reading the behavior
- **Identity verification** — the `domain` field enables verification via `/.well-known/`

### Domain verification

If an agent declares `domain figma.com`, the Runtime can verify publisher identity via the `.well-known` endpoint. Discovery format is defined in [RFC-0010](../rfcs/0010-well-known.md).

Verification policy (block unverified, warn, or allow silently) is the Runtime's responsibility — the spec does not prescribe enforcement behavior.

### High-risk capabilities

| Capability | Runtime behavior |
|---|---|
| `AgentCreation` | Requires explicit Human-in-the-Loop authorization before spawning agents |
| `SelfEvolution` | Requires HitL authorization before modifying own behavior files |
| `AgentUpgrade` | Requires HitL authorization before requesting runtime version updates |
