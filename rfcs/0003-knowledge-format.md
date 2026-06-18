<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0003: Knowledge Format

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |
| Depends on | [RFC-0001: Addon Protocol](./0001-addon-protocol.md) |

---

## Summary

Define the `.knowledge` format — a distributable data package that separates an agent's **expertise** (raw facts, curated content, domain knowledge) from its **brain logic** (`.behavior`, kernel). Defines the hybrid artifact structure, runtime tier selection, and the user-override patching model.

---

## Motivation

An agent's knowledge and its behavioral logic are different concerns with different update lifecycles:

- **Logic** (`.behavior`) changes when you want the agent to behave differently
- **Knowledge** changes when the underlying facts change or the user wants to specialize it

Separating them enables an **open market for knowledge packages**: `britanica.knowledge`, `ritalobo.knowledge`, `medical-guidelines-2026.knowledge` can be authored once and attached to any agent that needs them.

To support both cloud infrastructure (large context windows, prompt caching) and edge/local runtimes (small language models with limited VRAM), a `.knowledge` package cannot be a simple text file. It must carry multiple representations of the same content for different runtime tiers.

---

## The Hybrid Format

A `.knowledge` package is a ZIP archive containing two representations of the same information:

```
ritalobo.knowledge (ZIP)
├── manifest.json       ← metadata (id, version, schema, language, tier-index)
├── raw.txt             ← full text, for Tier-3 cloud runtimes
└── index.db            ← SQLite: chunked text + vector embeddings, for Tier-1/2
```

### `raw.txt` — Cloud representation

- Plain text, complete and unabridged
- Designed to be fed directly into a large context window
- Intended for use with **Prompt Caching** (Anthropic, Gemini) — the runtime sends the entire blob as a cached prefix, making repeated queries cheap
- Must be **immutable** after publishing (required for cache stability)

### `index.db` — Local/Edge representation

- SQLite database with two tables:
  - `chunks(id, text, source_ref)` — segmented passages
  - `embeddings(chunk_id, model_id, vector BLOB)` — pre-computed vectors
- The runtime performs a local RAG (Retrieval-Augmented Generation) query, extracting the top-N relevant chunks to inject into the SLM context
- Embedding model ID is stored alongside each vector, allowing runtimes to ignore embeddings from incompatible models

---

## Runtime Tiers

The runtime selects which representation to use based on its capabilities:

| Tier | Context Window | Strategy | Uses |
|---|---|---|---|
| Tier 3 | Large (100k+ tokens) | Full context + prompt cache | `raw.txt` |
| Tier 2 | Medium (32k–100k tokens) | Selective injection | `raw.txt` (truncated) or `index.db` |
| Tier 1 | Small (< 32k tokens) | RAG over local embeddings | `index.db` |

The `manifest.json` declares the tier coverage of the package:

```json
{
  "id": "britanica.com/encyclopedia@2025.1",
  "interface": "knowledge@1.0",
  "language": "en",
  "tiers": ["tier1", "tier3"],
  "raw_tokens": 420000,
  "embedding_model": "text-embedding-3-small",
  "chunks": 1840
}
```

A package can omit `raw.txt` (local-only) or omit `index.db` (cloud-only). The `tiers` field declares what is present.

---

## The Read-Only Model and User Patching

Knowledge packages are treated as **immutable** after publishing, for two reasons:

1. Prompt cache entries are keyed by content hash — any mutation invalidates the cache
2. Third-party packages are intellectual property — the user should not modify the source

When a user needs to override or supplement a knowledge package, the system uses a **patch layer** stored in the agent's `user` memory domain:

```
session query: "Rita Lobo's chocolate cake"
  → core knowledge: ritalobo.knowledge (immutable, cached)
  → user patches:   user.knowledge_patches["ritalobo"] (mutable, local)
  → runtime merges: "Here is the base knowledge: [CACHE]. Apply overrides: [PATCHES]."
```

### Patch structure

Patches are stored in the `user` memory domain as structured records:

```json
{
  "user.knowledge_patches": {
    "ritalobo": [
      {
        "op": "override",
        "topic": "chocolate cake",
        "note": "I make this without sugar — replace all sugar with stevia"
      },
      {
        "op": "append",
        "topic": "general",
        "note": "I'm lactose intolerant — always suggest dairy-free alternatives"
      }
    ]
  }
}
```

### Patch recompilation

When a user's patch file grows large enough to affect performance, a background task can produce a **personalized knowledge package** by merging core + patches into a new `index.db` and `raw.txt`. The recompiled package gets a new ID with the user's namespace:

```
user.danilo/ritalobo-personal@1.0.0~sha256:…
```

---


## Packaging

During `dot-agent pack`, the compiler handles knowledge addons bundled in the agent:

1. For `bundle` type: verifies the `.knowledge` ZIP exists and contains a valid `manifest.json`
2. Validates the `manifest.json` schema (required fields: `id`, `interface`, `tiers`)
3. Does not validate the content of `raw.txt` or `index.db` — those are the author's responsibility

For `online` type: validates that `integrity` (sha256) is present in the addon declaration.

---

## Open Questions

- **Embedding model portability:** the `index.db` stores vectors pre-computed by a specific model. If the runtime uses a different embedding model at query time, it must recompute vectors. Should packages ship multiple embedding sets for common models?
- **Knowledge package composition:** can an agent declare multiple knowledge packages and query them together? Or one at a time only?
- **Streaming updates:** some knowledge (e.g., news, stock prices) changes continuously. Should there be a `live` tier alongside `tier1`/`tier3` that streams updates?
- **Privacy of `user.knowledge_patches`:** patches contain user-specific information. The runtime must guarantee they are never included in a `.agent` bundle that is shared or published.

---

## Related RFCs

- [RFC-0001: Addon Protocol](./0001-addon-protocol.md) — base protocol (ID, resolution, capabilities)
- [RFC-0002: Lib Format](./0002-lib-format.md) — WASM executable addon protocol
