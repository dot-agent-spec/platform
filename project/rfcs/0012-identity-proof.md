# RFC-0012: did and proof — Artifact Identity and Package Integrity

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Updated | 2026-08-02 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | ⚠️ | — | ⚠️ |

---

## Summary

Define `did` and `proof{}` — author identity via `did:web` or `did:key`, and package authenticity via an
Ed25519 signature over `aboutme.json`. The mechanism is specified as a **reusable envelope** rather than
as a property of `aboutme.json`, because every independently distributable artifact in this ecosystem
needs the same thing.

---

## Motivation

`integrity.sha256` (V1) lets a runtime detect that a package was altered *after* the compiler produced
it. It does not establish **who produced it**. Anyone can author their own agent, declare
`domain entelekheia.ai`, and pack it — the compiler will compute a perfectly valid hash for the forgery.

`did` and `proof{}` add the missing layer. This matters most for packages distributed **off** the
publisher's own domain — a mirror, a marketplace, a chat attachment, a USB stick — which is the normal
case for a portable `.agent` file.

A second, quieter motivation: an anonymous agent that becomes popular has no way to prove that its next
version came from the same author. Today `unknown/receitas:v2` carries no relationship to
`unknown/receitas:v1` — anyone can publish the successor. Identity is not only about knowing *who*
someone is; it is also about knowing it is *still the same someone*.

---

## Resolved Decisions

### R1 — What `integrity.sha256` actually covers today

This RFC previously stated that `integrity.sha256` was "the SHA-256 hash of the entire ZIP". **It is
not**, and no hash of the ZIP bytes exists anywhere in the implementation. The compiler concatenates the
*contents* of the collected source files and hashes that string
([`pack.ts:521-522`](../../packages/compiler/src/pack.ts)):

```js
const contentForHash = Array.from(allFiles.values()).join('')
const sha256 = createHash('sha256').update(contentForHash).digest('hex')
```

| Covered | Not covered |
|---|---|
| `agent.description` | `.agent/aboutme.json` |
| `agent.behavior` (consolidated) | `.agent/types.json`, `.agent/files.json` |
| `behaviors/*.behavior` | the **file names** |
| `guides/*.md`, `knowledge/*.md` | any byte of the ZIP container |
| the persona file (`SOUL.md`) | |

Because the hash covers only authored sources — and `aboutme.json` is not one of them — there is no
circularity in `aboutme.json` carrying the hash. That is what makes R2 possible.

### R2 — `proof{}` signs `aboutme.json`, not the ZIP

Signing `aboutme.json` protects the metadata (`id`, `version`, `capabilities`, `license`) *and*, through
the embedded `integrity.sha256`, the agent's content — with one signature:

```
proof{} signs aboutme.json
        └─ which carries integrity.sha256
                └─ which covers the source files
```

The signature is stored inside the document it signs. This is a solved problem in the Data Integrity
model: the `proofValue` field is excluded from the input when computing and verifying the signature.

### R3 — Prerequisite: `integrity` must become a chain, not a concatenation

R2 promotes `integrity.sha256` from a corruption checksum into a **security boundary**, and the current
construction is not strong enough to carry that weight:

1. **File names are not covered.** Only contents are hashed; a rename that preserves content is invisible.
2. **File boundaries dissolve.** `.join('')` uses no separator, so `"foo" + "bar"` is indistinguishable
   from `"fo" + "obar"`. Moving text from the end of one file to the start of the next preserves the hash.
3. **Ordering is unspecified.** It follows collection order, which is deterministic in practice but
   written down nowhere — an independent verifier cannot reproduce it.

The fix reuses a file that already exists. `files.json` lists paths today
([`pack.ts:560-567`](../../packages/compiler/src/pack.ts)); it should list **path + per-file hash**:

```
each file      →  its own hash
files.json     →  the (path, hash) list, canonically ordered
aboutme.json   →  integrity.sha256 = hash of files.json
proof{}        →  signs aboutme.json
```

Each link is independently verifiable, names are covered, boundaries stop mattering, and ordering becomes
an explicit property of a list rather than an accident of iteration. This is the same shape npm and
Sigstore use. **This change lands before `proof{}`, not after.**

Per-file hashes are sufficient here: files travelling inside the package need integrity, not identity.
Identity is only required for artifacts that circulate on their own — see R12.

### R4 — Two DID methods, because they answer different questions

| | `did:web` | `did:key` |
|---|---|---|
| Where the public key lives | a file on the publisher's server | **inside the identifier itself** |
| Network fetch to verify | required | none |
| Identifier | `did:web:entelekheia.ai` | `did:key:z6MkhaXgBZ…` (48 chars) |
| Establishes **who** you are | yes — control of the domain | no |
| Establishes **continuity** | yes | yes |
| Infrastructure needed | a domain with TLS | none |

`did:web` is derived from `domain` by the compiler and is not separately declared in `.description`. Per
the did:web method, the method-specific identifier is a fully qualified domain name that MUST match the
common name in the TLS certificate.

`did:key` is self-certifying: the identifier *is* the public key, so verification requires no server, no
DNS and no third party. It proves nothing about who the author is — only that the same private key signed
both releases. That is precisely the property the anonymous tier lacks today.

### R5 — Namespace tiers, with `did:key` inserted

Tiers remain ordered by verifiability. Adding a key-based tier gives an author with no domain, no
platform account and no wish to be identified a way to be *consistent*:

| Tier | Namespace | `did` | What a runtime can check |
|---|---|---|---|
| 1 — own domain | `entelekheia.ai` | `did:web:entelekheia.ai` | identity **and** continuity |
| 2 — code platform | `github.com/user` | none | identity, attested by the platform |
| 3 — key | `z6MkhaXgBZ…` | `did:key:z6MkhaXgBZ…` | continuity only |
| 4 — email | `user@gmail.com` | none | nothing |
| 5 — unknown | `unknown` | none | nothing |

Tier 2 above tier 3 deserves a word, because on a purely cryptographic reading the order would invert: a
`did:key` is checkable today with arithmetic alone, while platform verification is still aspirational.
The tier ladder ranks **how well the publisher can be identified**, and a bare key identifies nobody.
Tier 3 is nonetheless the only tier below 2 where a runtime can verify anything at all mechanically.

**Tier 5 is not replaced by tier 3, and must not be.** A key that is generated, used once and lost — the
author shared an agent, then reinstalled their machine — leaves a lineage that can never be continued.
That is worse than having no lineage, because it is a broken promise. Tier 5 remains the honest
zero-commitment state for "I made this while experimenting", and adopting tier 3 must stay a deliberate
act.

Tier 2 publishers wanting a DID can host one on a Pages domain (`did:web:user.github.io`), accepting that
the Pages domain carries less recognition than the platform namespace. `did:web:github.com:user` is not
an option: it resolves to `https://github.com/user/did.json`, which the platform does not serve.

### R6 — `id` and `did` are bound by one invariant, for both methods

When `did` is present, its method-specific identifier **MUST** equal the namespace of `id`:

```
tier 1                                  tier 3
id:  entelekheia.ai/doctor:v1.0~a1b2    id:  z6MkhaXgBZ…/receitas:v2~c3d4
did: did:web:entelekheia.ai             did: did:key:z6MkhaXgBZ…
             └──────┬──────┘                         └────┬─────┘
              matches namespace                   matches namespace
```

One rule covers both methods with no special case — a sign the shape is right. The compiler enforces it
at pack time and the runtime re-checks at load time. It is the cheapest of all checks: no network, no
cryptography.

For tier 3 the namespace holds the **multibase key alone**, without the `did:key:` prefix. This is not
cosmetic: a namespace of `did:key:z6Mk…` would break the ID parser, whose first rule is to split on the
first `:` ([`agent-id.md`](../../docs/reference/agent-id.md) parsing rules). The base58btc alphabet is
purely alphanumeric, so the bare key collides with none of `/`, `:`, `~` or `@`, and its `z6Mk` prefix
identifies the tier without a lookup table.

### R7 — In the key tier, `proof{}` is mandatory

A namespace is only as strong as what binds a package to it. For tier 1 the namespace still carries
meaning without a signature, because the catalog can be consulted. For tier 3 it carries **none**: the
namespace is a public string that anyone can type.

Therefore a tier-3 package with no valid `proof{}` **MUST** be treated as tier 5 (`unknown`), not as
belonging to the key it names. Without this rule the tier is decorative — an attacker would simply copy
a popular agent's namespace and publish an unsigned successor.

### R8 — `proof{}` uses the current Data Integrity vocabulary

The earlier draft used `Ed25519Signature2020`. That vocabulary is superseded: the W3C EdDSA cryptosuite
specification keeps it only "to provide a stable reference" and directs new implementations to the
cryptosuite form. `proofPurpose` — a required property whose whole purpose is to stop a signature being
replayed for a different intent — is present.

Tier 1, with the DID document served separately at `https://entelekheia.ai/.well-known/did.json`:

```json
"did": "did:web:entelekheia.ai",
"proof": {
  "type": "DataIntegrityProof",
  "cryptosuite": "eddsa-jcs-2022",
  "created": "2026-08-02T10:00:00Z",
  "verificationMethod": "did:web:entelekheia.ai#key-1",
  "proofPurpose": "assertionMethod",
  "proofValue": "z58Dv8mK3pQrS9tU2vW..."
}
```

Tier 3, where no second file exists anywhere — the key is carried by the identifier:

```json
"did": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
"proof": {
  "type": "DataIntegrityProof",
  "cryptosuite": "eddsa-jcs-2022",
  "created": "2026-08-02T10:00:00Z",
  "verificationMethod": "did:key:z6MkhaXgBZ…#z6MkhaXgBZ…",
  "proofPurpose": "assertionMethod",
  "proofValue": "z3FXQjecWufY9k2mHqLpXvB8nR4tYzA1cD5eF7gH9jK"
}
```

`eddsa-jcs-2022` canonicalizes with JCS (plain JSON) rather than RDF canonicalization, which keeps
`aboutme.json` an ordinary JSON document and avoids pulling a JSON-LD processor into the compiler and the
SDK. Whether `@context` is required alongside it is P1.

### R9 — Two DIDs with distinct roles: the author signs, the agent acts

The author's DID and the agent's own DID are different subjects and must never be conflated:

| | Author DID | Agent DID |
|---|---|---|
| Field | `did` | `agent.did` |
| Signs the package | **yes** | **never** |
| Answers | "who published this?" | "who am I talking to?" |
| Required | when the tier has one | optional |

An agent signing its own package would be a document attesting to itself, which establishes nothing.
`agent.did` exists so an agent can be an **actor** — authenticating in agent-to-agent interactions and
open-market scenarios — and so a single agent can change hands independently of its author.

It is optional by design. An author with five agents would otherwise hold five private keys to lose;
the agent key is warranted by the market use case, not by the tier.

### R10 — Heredity is a second proof, signed by the parent

```json
"agent": {
  "did": "did:key:z6MkAGENT_B…",
  "derivedFrom": "did:key:z6MkAGENT_A…"
},
"proof": [
  { "verificationMethod": "did:key:z6MkAUTHOR…#…",  "proofPurpose": "assertionMethod" },
  { "verificationMethod": "did:key:z6MkAGENT_A…#…", "proofPurpose": "assertionMethod" }
]
```

The first proof asserts authorship; the second is the parent acknowledging the derivation. `proof` as an
array is standard — the Data Integrity specification defines proof sets and chains — so this needs no
invention.

The semantics are deliberately minimal: **the parent acknowledges the child.** Whether the relationship
is a fork, an evolution or a training lineage is left to the ecosystem to settle through use.

Two properties that look like limitations and are not:

- **Heredity requires consent.** The parent's private key must be available when the child is built. A
  non-consensual fork simply cannot carry the proof — which is the correct outcome, not a gap.
- **Absence is not an accusation.** An agent with no `derivedFrom` is an agent that declares no ancestry,
  not a plagiarism finding. Nothing in this RFC licenses a runtime to present it as one.

### R11 — `requires[]` MAY pin a publisher key

`requires[]` identifies dependencies by name today, which means any package answering to that name can
satisfy it. A dependency MAY additionally pin the expected publisher DID:

```
requires: receitas                          ← open: any publisher
requires: receitas @ did:key:z6MkhaXgBZ…    ← bound: that publisher only
```

Pinning is **optional and stays optional**. The default posture of the ecosystem is open — an agent
should be satisfiable by whoever publishes a compatible dependency, and mandatory pinning would ossify
that. The bound form exists for deployments that require it: a corporation composing agents internally,
or a brand that must not have a competitor's artifact substituted into its own agent.

The exact syntax is not settled here; the decision is that the capability exists and that it is opt-in.

### R12 — The envelope is generic, not a property of `aboutme.json`

`.knowledge` bundles (RFC-0003), lib addons (RFC-0002) and addons generally (RFC-0001) are all
**independently distributable artifacts**. Each faces the same question a `.agent` faces — who published
this, and has it been altered — and each would otherwise invent its own answer.

`did` + `proof{}` + the `integrity` chain are therefore specified here as a reusable envelope. Those RFCs
should reference it rather than redefine it. Three parallel inventions of the same mechanism is the
outcome this decision exists to prevent.

Files travelling *inside* a package are out of this scope: they are covered by the per-file hashes of R3
and need no identity of their own.

**Naming collision to avoid:** RFC-0003 already uses "Tier 1/2/3" for knowledge *bundle sizes* — an
unrelated concept. Once that RFC references this envelope the two vocabularies sit side by side, so
namespace tiers should be written as "namespace tier N" wherever both could be read.

### R13 — `integrity{}` and `proof{}` remain independent layers

`integrity.sha256` stays useful on its own for runtimes with no key material and no network. `proof{}`
adds author verification on top. A runtime may implement the first without the second.

### R14 — Verification timing is the runtime's concern

Whether a runtime verifies eagerly (at install) or lazily (before first execution) is not defined here.

---

## The verification chain, end to end

The two `.well-known` files answer different questions and neither substitutes for the other. `did.json`
is mandated by did:web and its format belongs to W3C; `dot-agent.json` (RFC-0010) is this project's own
catalog format. Tier 3 uses neither.

```
1. read .agent/aboutme.json
     id:  entelekheia.ai/doctor:v1.0~a1b2c3d4
     did: did:web:entelekheia.ai

2. CHECK — offline, free
     does the id's namespace equal the did's method-specific id?    (R6)

3. GET https://entelekheia.ai/.well-known/did.json      ← keys, W3C format
     → public key #1                          (tier 3: skip — the key is in the did)

4. CHECK — verify proof{} over aboutme.json                        (R2, R8)

5. GET https://entelekheia.ai/.well-known/dot-agent.json ← catalog, ours (RFC-0010)
     → CHECK: is this agent actually published?          (tier 3: not applicable)
```

This answers RFC-0010's open question about whether `dot-agent.json` should carry publisher identity:
**it should not.** The identity half is not ours to design — did:web fixes its location and W3C fixes its
format. The two can be linked by declaring a `service` entry in the DID document pointing at the catalog,
giving one entry point that leads to the other.

---

## Security considerations

Recorded because each of these is easy to assume away, and each changes what the documentation may
honestly claim.

### `did:web` is exactly as strong as domain control

The keys are served by the same infrastructure that serves the agents. An attacker who takes over the web
server, the DNS, or obtains a fraudulent TLS certificate replaces `did.json` with their own key and signs
forgeries that verify perfectly. This scheme is **equivalent to TLS trust, not stronger than it**.

The value is real but specific: it protects packages travelling *away* from the origin — mirrors,
marketplaces, chat attachments, offline copies — where TLS never applied in the first place. Nothing here
defends against a compromised `entelekheia.ai`, and no document should imply that it does.

### Copying a public key achieves nothing, and this must be said plainly

The public half of a keypair is meant to be copied; it can only *verify*. Producing a signature requires
the private half, which is never published. An attacker who copies a popular tier-3 namespace has two
options and both fail: sign with their own key and the verification returns false, or change the
namespace to their own and the package is a homonym rather than a successor. This is the whole reason R7
makes signatures mandatory in that tier.

### Rotating a key invalidates every past signature

Replacing the key breaks verification for every previously signed package, including legitimate ones
already installed. Distinguishing "signed before the compromise" from "signed with the stolen key"
requires the DID document to expose `versionId`/`versionTime` metadata, the proof to record which version
it used, and a trustworthy notion of *when* the signature was made.

`proof.created` does not provide that last part — it is a self-asserted string, and an attacker holding
the stolen key writes whatever date they like. Real systems anchor this in a transparency log or a
timestamping authority. Out of scope for V1, but the consequence must be stated: **until it exists, key
rotation is a mass-invalidation event.**

### Losing a signing key must not look like an attack

For a tier-3 author, key loss is a likely event, not an exotic one. Two consequences follow.

The damage is bounded: this key only ever signs, never encrypts. Losing it discloses nothing and breaks
nothing already published — existing packages keep verifying forever. What is lost is only the ability to
continue the lineage.

And a runtime **must not** present "same name, different key" as a security alert. It is the ordinary
signature of someone who reinstalled their computer. The correct treatment is the tier-5 semantics
already defined: an unrelated package. Treating it as attempted fraud would fire on honest users far more
often than on attackers.

### A signature proves authorship, not safety

`proof{}` establishes accountability: which key signed this. It says nothing about whether the contents
are benign. This weighs more here than in a typical package format, because an `.agent` payload is
*instructions to a language model* — a correctly signed agent can be adversarial. Verified status must
never be presented to a user as a safety verdict.

### Most packages will have no identity at all

Tiers 4 and 5 carry no `did`, and tier 3 is opt-in. The security boundary for the majority of community
packages is therefore a **user-interface** problem — how to convey "unverified" without training users to
dismiss the warning — not a cryptographic one. That work belongs to the runtime, and is where the
practical risk concentrates.

### Signing keys and the build

If packing signs automatically, the private key has to be reachable by the build, which pushes it into CI
secrets or leaves it unencrypted on disk. Git's model is instructive: signing is opt-in and the key is
held by an agent, not read from a plaintext path by default. The compiler should not acquire a default
that silently reads a private key.

---

## Pending Decisions

### P1 — Does `aboutme.json` need `@context`?

`eddsa-jcs-2022` canonicalizes plain JSON, but Data Integrity is specified in Verifiable Credential
terms, where `@context` establishes the vocabulary. Whether an off-the-shelf verifier accepts a
`DataIntegrityProof` on a document with no `@context` — or whether the field must be added, making
`aboutme.json` a JSON-LD document — needs to be settled against a real implementation, not against prose.

**Fallback if it does not hold:** drop the W3C vocabulary and define a minimal proof struct
(`algorithm`, `key`, `signature`). Interoperates with nothing, but does not misrepresent itself as
interoperable. The one option to avoid is the current hybrid — W3C field names over non-conforming
semantics, which yields the syntax of the standard and none of its benefits.

### P2 — Anything written after packing breaks the signature

Two mechanisms already specified mutate the manifest after the compiler has produced it:

- **RFC-0009** states `endpoints{}` and `securitySchemes{}` are filled by the host at deploy time.
- **[`dsl/reference/description.md`](../../dsl/reference/description.md) §5** states the runtime "may
  fetch the canonical definition … and **override the local manifest**".

They are the same problem wearing two costumes: post-signature mutation. A package whose manifest can be
rewritten after signing has no verifiable integrity — what was signed stops being what runs.

Either those fields are explicitly excluded from the signed surface (and documented as unsigned), or the
mechanisms change. There is currently no specification of agent update or lifecycle at all; the override
behaviour exists solely as one sentence in a reference document.

### P3 — `requires[]` pinning syntax

R11 settles that key pinning exists and is optional. The surface form — whether in `.description`, in
`aboutme.json` only, and how it renders in the DSL — is open.

### P4 — `domain_type` and platform namespaces

R5 settles what happens for tiers 2, 4 and 5 today (no DID). Whether a future `domain_type` field changes
that — for instance by letting a publisher declare a Pages domain as the identity anchor for a
platform-namespaced agent — remains open and is being studied separately.

---

## Future work and derivations

Directions this RFC opens but deliberately does not explore. They are recorded here rather than as new
RFCs because none has been investigated far enough to know how large it is; each becomes its own document
when it is actually taken up, and not before.

### Build provenance — proving `compiler` and `commit`

`aboutme.json` already carries `compiler` and `commit`, both self-asserted strings today. Proving them
instead of declaring them is attractive and the mechanism is **not** the one in this RFC.

A compiler that signs with a key shipped inside its own distributed package proves nothing: everyone who
installed it holds that key. Build provenance is only meaningful when the build runs somewhere the author
does not control, signing with a key the author cannot extract — the shape of npm provenance (CI identity
via OIDC, anchored in a transparency log). Different infrastructure, different trust model, its own RFC
when the time comes.

### Adoption of the envelope by addon formats

R12 establishes that the envelope is generic. Actually referencing it from RFC-0001, RFC-0002 and
RFC-0003 is editorial work on those documents, to be done when each is next opened.

### Agent lifecycle and update

The resolution of P2 will likely need a document of its own covering install, update, revalidation and
manifest authority. Named here so P2 is not mistaken for a field-level fix.

### Identity-gated presentation

If a `logo` field is ever added, the file itself is covered by the R3 hash chain — the easy half. The
hard half is that a logo is precisely what a user looks at *instead of* reading a namespace, which makes
rendering one for an unverified package an active spoofing vector. This is why BIMI exists in email.
Any such field should be gated on verification tier at render time. A runtime concern, but it originates
here.

### Tier upgrade and transfer

An author who starts at tier 3 and later acquires a domain, or hands an agent to another organisation,
would want the lineage to survive. The standard mechanism is `alsoKnownAs` in the DID document, which
DID Core describes for exactly this case — with the caveat that the claim only carries weight when the
**old** key signs the handoff, since anyone can assert `alsoKnownAs` about anyone.

This gives an ordering worth knowing before choosing a tier: **tier 3 can be upgraded provably; tier 4
cannot**, having never had a key to sign with. And an unplanned key loss forecloses the upgrade
permanently. `agent.did` (R9) is what would make per-agent transfer possible, as distinct from
transferring an author's whole portfolio.

---

## Out of Scope

- **Key management** — generation, storage and rotation mechanics. Tooling exists and is free
  (`ssh-keygen -t ed25519`, `openssl genpkey -algorithm ed25519`, and `crypto.generateKeyPairSync` is
  built into Node); this is a keypair, not a certificate — no authority, no cost, no expiry. What the
  spec must not do is mandate where the private key lives.
- **Revocation** — a `proof{}` is a point-in-time signature. See the rotation note in Security
  Considerations for why this is more consequential than it first appears.
- **Trust policy** — what a runtime does with an unverified or missing `proof{}`.
- **Agent-to-agent authentication** — `securitySchemes{}` (RFC-0009) covers runtime auth. `agent.did`
  (R9) gives an agent an identity to authenticate *with*, but the protocol is not defined here.

---

## Documentation corrections this RFC implies

Not applied yet — this RFC is Draft and the reference docs describe ratified behaviour.

| Where | What is wrong |
|---|---|
| [`docs/reference/agent-id.md`](../../docs/reference/agent-id.md) | Four tiers; R5 defines five. |
| same, tier 4 section | "no guarantee that `unknown/doctor:v2` is an upgrade of `unknown/doctor:v1`" — still true for tier 5, and precisely what tier 3 exists to fix. |
| same, Digest section | "two agents with the same form D ID are byte-for-byte identical" overstates what the digest guarantees — it is the short git commit SHA, not a content hash. |
| [`dsl/reference/description.md`](../../dsl/reference/description.md) §5 | Cites a third well-known path (`/.well-known/agents/<Name>.description`) that appears in no RFC. RFC-0010 defines `dot-agent.json`; did:web defines `did.json`. There is no third. |
| This file (fixed above) | R1 previously described a ZIP hash that the implementation never computed. |
