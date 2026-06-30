<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0012: did and proof — Author Identity and Package Integrity

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | ⚠️ | — | ⚠️ |

---

## Summary

Define the `did` and `proof{}` fields in `aboutme.json` — cryptographic author identity via Decentralized Identifiers (DID) and package integrity proof via Ed25519 signature.

---

## Motivation

`integrity.sha256` (V1) guarantees that a downloaded `.agent` matches the hash declared in its envelope. It does not guarantee **who signed it**. Anyone can repackage a ZIP with a different `aboutme.json` and compute a matching hash.

`did` and `proof{}` add the missing layer: the author signs the hash with their private key, and any runtime with the author's public key can verify the package has not been tampered with and was published by the declared identity.

This also enables:
- Publisher verification in marketplace and discovery contexts
- Trust escalation for automated agent-to-agent orchestration
- Future revocation of compromised packages

---

## Resolved Decisions

### R1 — What `proof{}` signs

`proof{}` signs `integrity.sha256` — the SHA-256 hash of the entire ZIP already present in V1. It does not sign individual files. Signing the whole ZIP via its hash is consistent, simple to verify, and prevents partial substitution attacks (replacing one file without invalidating others).

### R2 — `integrity{}` and `proof{}` coexist

`integrity.sha256` remains for runtimes that want to verify package integrity without cryptographic key material (offline, no DID support). `proof{}` adds author verification on top. The two layers are independent:

```json
"integrity": {
  "sha256": "e3b0c44298fc1c149afb..."
},
"proof": {
  "type": "Ed25519Signature2020",
  "created": "2026-01-01T00:00:00Z",
  "verificationMethod": "did:web:entelekheia.ai#key-1",
  "proofValue": "..."
}
```

### R3 — Verification timing is runtime's concern

Whether the runtime verifies `proof{}` eagerly (at install) or lazily (before first execution) is not defined by this spec. The spec defines the mechanism; each runtime decides when to apply it.

### R4 — `domain_type` is out of scope for this RFC

The relationship between `did` and platform namespaces (e.g. `github.com/user` vs `cocacola.com/xxx`) is being studied separately. This RFC covers `did:web` for tier-1 publishers (own domain) only.

---

## Pending Decisions

### P1 — `did` derivation: from `domain` or declared independently?

**Option A — always derived:** `did` is always `did:web:<domain>`. The compiler generates it from the `domain` field automatically. Not a separate declared field.

**Option B — declared independently:** the author can have a DID that differs from their domain (`did:key:...`, or DID hosted elsewhere). Explicit field in `.description`.

**Leaning:** A for V1 (`did:web` derived from `domain`). Other DID methods deferred to VNext.

**Blocked on:** review of `did:web` spec to confirm derivation semantics (how `did:web:entelekheia.ai` resolves to a DID Document, and whether subdomains or paths are needed).

### P2 — `proof{}` format: W3C VC Data Integrity or custom?

**Option A — W3C VC Data Integrity:** uses the standard vocabulary (`Ed25519Signature2020`, `verificationMethod`, etc.). Interoperable with existing DID tooling. Couples the spec to W3C VC lifecycle.

**Option B — custom minimal struct:** only `algorithm`, `key`, `signature`. No W3C dependency. Simpler to implement but not interoperable with VC tooling.

**Leaning:** A if `did:web` is adopted (R1 makes the DID chain natural). B if DID is deferred significantly.

**Status:** pending — blocked on P1 resolution and DID spec review.

---

## Out of Scope

- **Key management** — how the author generates, stores, and rotates their Ed25519 key pair is not defined by this spec.
- **Revocation** — how a compromised package is marked invalid is not addressed in V1. The `proof{}` is a point-in-time signature; revocation requires a separate mechanism (DID Document update or CRL).
- **Trust policy** — what a runtime does with an unverified or missing `proof{}` is a runtime policy, not a spec requirement.
- **Agent-to-agent authentication** — `securitySchemes{}` (RFC-0009) covers runtime auth. `proof{}` covers package authorship. They are distinct.
