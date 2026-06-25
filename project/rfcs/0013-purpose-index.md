<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0013: purpose — Semantic Index via Wikidata

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| ? | ? | ⚠️ | — | — |

---

## Summary

Define how the `purpose` field in `aboutme.json` is generated, what values it accepts, and how runtimes and registries use it to build a navigable semantic index of agents.

---

## Motivation

`purpose` is currently hardcoded as `'unknown'` in `pack.ts`. The field exists in the `AboutMe` interface but the compiler has no mechanism to derive a meaningful value.

Without `purpose`, agent discovery by category is impossible — two medical triage agents have no machine-readable signal that they serve the same domain. String-based tags are unreliable (different authors use different words) and not hierarchically navigable.

Wikidata QIDs solve this: `Q784111` (medical triage) is a stable, language-neutral identifier with a defined position in a hierarchy (`Q784111 ⊂ Q11190 ⊂ Q336`). An orchestrator querying for "health agents" finds all agents whose `purpose` is a subclass of `Q336`, including medical triage, diagnostics, and pharmacology — without the agent author knowing about the query in advance.

---

## Resolved Decisions

### R1 — Value format

`purpose` is a full Wikidata QID URL:

```json
"purpose": "https://www.wikidata.org/wiki/Q784111"
```

Not a bare QID (`Q784111`) — the full URL is unambiguous across systems without requiring Wikidata-specific parsers.

### R2 — Hierarchical navigation

Runtimes and registries can use Wikidata's subclass hierarchy (`P279`) to group agents. An agent with `purpose: Q784111` is automatically discoverable under `Q11190` (medicine) and `Q336` (health science). No additional metadata required from the author.

---

## Pending Decisions

### P1 — Derivation method: LLM-assisted at pack time

**Proposed approach:** at `pack` time, the compiler sends the agent's `description` block (and optionally the full `agent.description` file) to an LLM with a prompt that asks it to identify the most specific applicable Wikidata QID from a curated set of categories.

The LLM output is a QID URL. The compiler writes it to `aboutme.json`.

**Open questions:**

1. **What is the curated category set?** Does the compiler maintain a taxonomy of valid QIDs (financial, medical, legal, productivity, etc.) or does it allow any QID? A bounded set reduces hallucination risk; an unbounded set is more expressive.

2. **Fallback when LLM is unavailable?** The `pack` command may run in offline or air-gapped environments. Options: skip the field (leave absent), use a default (`Q11660` — artificial intelligence), or fail with a warning.

3. **Confidence threshold?** If the LLM is uncertain, should it output multiple candidates? Should the compiler pick the most specific or the safest?

4. **Author override?** Can the author declare `purpose` explicitly in `agent.description` to bypass LLM derivation? Explicit declaration is more auditable.

**Status:** pending — format and fallback behavior to be defined before implementation.

### P2 — Where in `agent.description` does an author override `purpose`?

If explicit declaration is allowed (P1.4), the DSL needs a field:

```
agent MyAgent
  purpose Q784111
```

or as annotation on the description block. Syntax undecided.

---

## Out of Scope

- **Runtime use of `purpose` for routing** — how an orchestrator queries and matches agents by `purpose` is a runtime concern. This RFC defines the field and its generation, not how it is consumed.
- **`tags[]` in `skills[]`** — tags are explicitly out of the spec. `purpose` operates at agent level, not skill level.
- **Multi-purpose agents** — this RFC defines `purpose` as a single QID. Whether agents can declare multiple purposes is deferred.
