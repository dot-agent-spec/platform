<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0010: .well-known/dot-agent.json

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

---

## Summary

Define the `/.well-known/dot-agent.json` endpoint — what it contains, who publishes it, and how runtimes use it for publisher discovery and agent resolution.

---

## Motivation

A `dot-agent://` link (RFC-0011) resolves an agent by domain and name. The resolution algorithm needs a known entry point on the publisher's domain. `.well-known` is the standard web mechanism for per-domain metadata (used by `did:web`, A2A, OAuth, and others). Without a defined `.well-known` format for dot-agent publishers, resolution requires a central registry — a dependency this spec explicitly avoids.

---

## Resolved Decisions

### R1 — Resolution algorithm

When a runtime encounters `dot-agent://entelekheia.ai/doctor`, it performs:

```
GET https://entelekheia.ai/.well-known/dot-agent.json
```

No central registry. The publisher controls resolution via their own `.well-known`. Consistent with `did:web` resolution.

### R2 — Scope: publisher-level, not agent-level

`.well-known/dot-agent.json` describes the **publisher**, not a specific agent. Individual agents are described by their own `aboutme.json` inside their `.agent` ZIP. The `.well-known` file aggregates and points to what the publisher offers.

---

## Pending Decisions

### P1 — File contents

Leaning toward a mix of publisher metadata (A) and redirect/index (B):

```json
{
  "name": "Entelekheia",
  "publisher": "entelekheia.ai",
  "agents": [
    {
      "id": "entelekheia.ai/doctor:v1.0~a1b2c3d",
      "distribution": "https://entelekheia.ai/agents/doctor.agent"
    }
  ],
  "collections": [
    "https://entelekheia.ai/agents/collection.json"
  ]
}
```

Open questions:
- Does the file list individual agents inline, or only point to a collection file?
- Does it include publisher identity (`did`, contact) or just agent pointers?
- What is the minimal valid file (only `agents[]`? only `collections[]`? both optional?)?

**Status:** pending — needs alignment with how RFC-0011 uses this file for resolution, and with RFC-0012 DID for publisher identity.

### P2 — Caching and staleness

How long can a runtime cache `.well-known/dot-agent.json`? Standard HTTP caching headers or a field in the file?

**Status:** pending. Likely defer to HTTP cache headers — no custom field needed.

---

## Out of Scope

- **Central registry** — there is no `dot-agent.dev` fallback if `.well-known` is absent. Publishers without a domain use platform-based namespaces (e.g. `github.com/user`) which resolve differently.
- **Agent hosting** — `.well-known` points to agents; it does not host them. The actual `.agent` files live at whatever URL the publisher chooses.
- **Authentication of the `.well-known` file itself** — covered by RFC-0012 (proof/did). This RFC only defines structure and resolution.
