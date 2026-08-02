# RFC-0010: .well-known/dot-agent.json

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | — | — | — |

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

### R3 — This file is a catalog; it carries no publisher identity

A publisher adopting `did:web` (RFC-0012) already serves a second well-known file, and its location and
format are not ours to choose:

| File | Answers | Format owned by |
|---|---|---|
| `/.well-known/did.json` | "what are the publisher's keys?" | W3C — mandated by did:web resolution |
| `/.well-known/dot-agent.json` | "what agents does this publisher offer?" | this specification |

They are consumed at different steps of verification and neither substitutes for the other. Identity
therefore stays out of `dot-agent.json` entirely — duplicating a `did` here would create a second place
for it to be wrong.

The two can be linked from the W3C side: the DID document may declare a `service` entry whose endpoint
points at `dot-agent.json`, so resolving the DID leads to the catalog and there is a single entry point.

This settles the second bullet of P1 below.

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
- ~~Does it include publisher identity (`did`, contact) or just agent pointers?~~ — **resolved by R3**: agent pointers only.
- What is the minimal valid file (only `agents[]`? only `collections[]`? both optional?)?

**Status:** pending — needs alignment with how RFC-0011 uses this file for resolution.

### P2 — Caching and staleness

How long can a runtime cache `.well-known/dot-agent.json`? Standard HTTP caching headers or a field in the file?

**Status:** pending. Likely defer to HTTP cache headers — no custom field needed.

### P3 — Is absence from the catalog invalidating?

RFC-0012's verification chain ends by checking that the agent appears in this file. What a runtime does
when it does **not** appear has consequences beyond discovery:

- If absence invalidates, removing an entry disables installations already on disk. That is a useful
  lightweight revocation path — and RFC-0012 notes it may be the only one available, since key rotation
  invalidates all past signatures indiscriminately.
- It is also a kill switch that fires when the publisher's site is merely unreachable.

The offline case needs its own answer: a runtime that cannot fetch this file must not silently choose
between failing open and failing closed.

**Status:** pending — this is a trust-policy decision with a security consequence, not a format detail.

---

## Out of Scope

- **Central registry** — there is no `dot-agent.dev` fallback if `.well-known` is absent. Publishers without a domain use platform-based namespaces (e.g. `github.com/user`) which resolve differently.
- **Agent hosting** — `.well-known` points to agents; it does not host them. The actual `.agent` files live at whatever URL the publisher chooses.
- **Authentication of the `.well-known` file itself** — covered by RFC-0012 (proof/did). This RFC only defines structure and resolution.
