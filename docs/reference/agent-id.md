# Agent ID

An agent ID is the canonical, globally-unique identifier for a dot-agent package. It encodes authorship, name, version, and integrity in a single human-readable string.

---

## Format

```
namespace/name:version~digest
```

Each separator has a single, unambiguous role:

| Separator | Role | Example |
|-----------|------|---------|
| `/` | Separates namespace from name | `entelekheia.ai/doctor` |
| `:` | Separates the full name from version | `entelekheia.ai/doctor:v1.0` |
| `~` | Separates version from digest | `entelekheia.ai/doctor:v1.0~a1b2c3d4` |
| `@` | Marks an email address as namespace | `user@gmail.com/doctor` |

No separator appears in two roles. This makes the format parseable without look-ahead or ambiguity.

---

## Valid forms

Three forms are valid. Version and digest are always together when present — there is no form with digest but no version.

| Form | Example | When used |
|------|---------|-----------|
| **A — bare** | `entelekheia.ai/doctor` | Resolution links, `requires[]`, development references |
| **B — versioned** | `entelekheia.ai/doctor:v1.0` | Pinning a release without locking to a specific build |
| **D — full** | `entelekheia.ai/doctor:v1.0~a1b2c3d4` | Immutable reference to a specific packed `.agent` file |

A form A link (`dot-agent://entelekheia.ai/doctor`) resolves to the latest available version. A form D link is immutable — two agents with the same form D ID are byte-for-byte identical.

---

## Namespace tiers

The namespace identifies the publisher. Four tiers are defined, ordered by verifiability:

### Tier 1 — Own domain

```
entelekheia.ai/doctor:v1.0~a1b2c3d4
health.example.com/analyst:v2.3.1~deadbeef
```

The namespace is an ICANN domain. Verifiable via `/.well-known/` discovery (VNext). The runtime can confirm the agent is published by the domain owner.

### Tier 2 — Code hosting platform

```
github.com/daniloborges/doctor:v1.0~a1b2c3d4
gitlab.com/someuser/agent:v2.0~cafebabe
sr.ht/~reykjalin/fonn:v1.0~12345678
```

The namespace is `platform/user`. The platform vouches for the user's identity. Verifiable via repository metadata or a config file in the repo.

**Platforms known to the compiler (V1):**

| Platform | Namespace format |
|----------|-----------------|
| GitHub | `github.com/<user>` |
| GitLab | `gitlab.com/<user>` |
| Codeberg | `codeberg.org/<user>` |
| Sourcehut | `sr.ht/<user>` — note: Sourcehut usernames begin with `~` in URLs (e.g. `sr.ht/~reykjalin`) |

The `~` in Sourcehut usernames does not conflict with the digest separator because the digest `~` always appears after `:version`, while the username `~` is always before `:`.

The compiler uses this list to parse platform namespaces correctly. Runtimes may maintain their own list to support additional platforms.

### Tier 3 — Email

```
user@gmail.com/doctor:v1.0~a1b2c3d4
user+agentcreator@gmail.com/doctor:v1.0~a1b2c3d4
```

The `@` before the first `/` identifies the namespace as an email address. RFC 5321 address formats are accepted, including `+` sub-addressing.

Email is useful as a contact identity but cannot be verified programmatically without depending on each provider's infrastructure. Runtimes should treat email-namespaced agents as unverified and surface this to the user.

### Tier 4 — Unknown

```
unknown/doctor:v1.0~a1b2c3d4
unknown/doctor
```

`unknown` is a reserved namespace keyword used when an agent is packaged without a `domain` declaration. There is no guarantee that `unknown/doctor:v2` is an upgrade of `unknown/doctor:v1` — two anonymous agents with the same name and different digests are unrelated packages. Version and commit fields are preserved when present, as informational context only.

Runtimes in secure environments may refuse to load `unknown`-namespaced agents by policy.

---

## Digest

The digest is the first 8 hex characters of the SHA-256 hash of all source files in the `.agent` ZIP, concatenated in collection order. It identifies a specific build of the agent, not just a version.

Two agents with the same `namespace/name:version` but different digests are different builds — for example, built from different commits or with different source files.

---

## Resolution scheme

The `dot-agent://` URI scheme is used for sharing and resolving agents:

```
dot-agent://entelekheia.ai/doctor              ← latest
dot-agent://entelekheia.ai/doctor:v1.0         ← specific version
dot-agent://entelekheia.ai/doctor:v1.0~a1b2c3d4  ← immutable
```

Resolution (download, local lookup, cache) is the responsibility of the runtime. The scheme itself does not imply HTTP.

---

## Parsing rules

Implementations that parse agent IDs should follow this order:

1. Split on the **first `:`** — left side is `identifier`, right side is `version~digest`
2. If right side contains `~`, split on first `~` — left is `version`, right is `digest`
3. Parse `identifier` to extract `namespace` and `name`:
   - If `@` appears before any `/` → email namespace: everything up to the first `/` is the namespace
   - If `identifier` starts with a known platform prefix → `platform/user` is the namespace, the remaining segment is the name
   - Otherwise → the last `/` separates namespace from name

This order ensures the `~` in Sourcehut usernames (which appears before `:`) is never mistaken for the digest separator.
