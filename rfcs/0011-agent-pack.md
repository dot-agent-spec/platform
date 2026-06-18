<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0011: dot-agent:// scheme and Agent Pack

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

---

## Summary

Define the `dot-agent://` URI scheme for sharing and resolving agents, and the Agent Pack format for distributing collections of agents as a single shareable link.

---

## Motivation

Today a `.agent` file is shared as a raw file download. There is no standard link format that:

- Identifies an agent by identity (not by download URL)
- Can resolve to the latest version or a specific pinned version
- Can point to a collection of agents to install together
- Is registerable as a URI scheme in the OS (so the runtime handles it)

---

## Resolved Decisions

### R1 — URI scheme syntax

```
dot-agent://namespace/name              ← latest version
dot-agent://namespace/name:version      ← specific version
dot-agent://namespace/name:version~digest ← pinned, immutable
```

The same separators as `id` in `aboutme.json`: `/` namespace, `:` version, `~` digest.

### R2 — Resolution via `.well-known`

The runtime resolves `dot-agent://entelekheia.ai/doctor` by:

1. `GET https://entelekheia.ai/.well-known/dot-agent.json` (RFC-0010)
2. Finding the agent entry matching `doctor`
3. Downloading the `.agent` file from the `distribution` URL

No central registry. DNS + HTTP is the resolution stack.

### R3 — `dot-agent://` is a URI scheme, not HTTP

The `://` follows standard URI scheme syntax (RFC 3986). It does not imply HTTP. The runtime registers `dot-agent://` as an OS-level URI handler and decides how to resolve it (local cache, download, registry lookup). The agent itself is always a static package.

### R4 — Version resolution when version is omitted

When version is omitted, resolves to latest. When version is specified without digest, resolves to the latest build of that version. When digest is specified, the resolution is exact and immutable.

**Note:** semver-style range resolution (e.g. `^v1.0`) is likely a runtime concern, not spec-defined.

### R5 — Install behavior is runtime's concern

Whether the runtime installs silently, shows a confirmation dialog, or requires explicit user approval is not defined by this spec.

---

## Agent Pack Format

A `dot-agent://` link can point to a single agent or a collection. A collection is a JSON file hosted by the publisher:

```json
{
  "name": "Entelekheia Agents",
  "publisher": "entelekheia.ai",
  "agents": [
    "entelekheia.ai/doctor:v1.0~a1b2c3d",
    "entelekheia.ai/receptionist:v1.2~e5f6g7h"
  ]
}
```

The runtime detects whether a resolved resource is a single `aboutme.json` or a collection by inspecting the payload.

---

## Pending Decisions

### P1 — Collection file name and location

How does the runtime know if `dot-agent://entelekheia.ai/agents` points to a collection vs a single agent?

**Option A:** the `.well-known` file (RFC-0010) lists named collections with their URLs. The runtime looks up `agents` in the collections index.

**Option B:** the path is arbitrary; the runtime fetches the URL and inspects the `Content-Type` or the payload shape to determine if it's a collection or a single agent.

**Status:** pending — needs alignment with RFC-0010 structure.

### P2 — Collection file name on disk

`agents.json`? `pack.json`? `.agent-pack`? No decision yet.

### P3 — Version pinning in collections

Should a collection be allowed to list agents without a digest (floating version)? Or must all entries be pinned?

**Leaning:** floating allowed, pinned preferred. Mirrors npm — a `package.json` can have ranges, a lockfile pins exact versions. The runtime may generate a lockfile.

---

## Out of Scope

- **Install confirmation UX** — runtime concern.
- **Collection versioning** — collections themselves do not have a version field in V1.
- **Dependency resolution between agents** — if agent A requires agent B (not a type, but another agent), this is not addressed here.
