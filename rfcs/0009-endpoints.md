<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0009: endpoints and securitySchemes

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-18 |
| Author | Danilo Borges |

---

## Summary

Define the `endpoints{}` and `securitySchemes{}` fields in `aboutme.json` — what they contain, who fills them, and when they are valid.

---

## Motivation

A `.agent` file is a static, redistributable package. It has no inherent network location — the same ZIP can be installed locally, hosted on a private server, or published on a marketplace. Today `aboutme.json` has no endpoint information, which means:

- A runtime that wants to call an agent via MCP or A2A has no declared URL to connect to
- Interoperability with A2A Agent Card (`url` required field) is blocked
- There is no standard way to attach authentication schemes to a deployed agent

`endpoints{}` and `securitySchemes{}` are intentionally absent from V1 by design. This RFC defines them for VNext.

---

## Resolved Decisions

### R1 — Who fills `endpoints{}`

The author does **not** fill `endpoints{}` in the `.agent` source. A static package cannot know where it will be deployed.

`endpoints{}` is filled by the **host at deploy time** — the platform, runtime, or operator that installs and exposes the agent. The compiled `.agent` file ships without this field. The host injects it into the `aboutme.json` when making the agent available over a network.

### R2 — Field structure

Three endpoint types, each optional:

```json
"endpoints": {
  "distribution": "https://entelekheia.ai/agents/doctor.agent",
  "mcp":          "https://api.entelekheia.ai/mcp",
  "a2a":          "https://api.entelekheia.ai/agent"
}
```

| Field | Meaning |
|---|---|
| `distribution` | URL to download the `.agent` ZIP |
| `mcp` | MCP server endpoint for tool invocation |
| `a2a` | A2A Agent Card endpoint for agent-to-agent calls |

### R3 — `integrity{}` and `endpoints{}` are independent layers

`integrity.sha256` covers the static package. `endpoints{}` is deployment metadata. Adding or changing endpoints does not invalidate the package hash — they exist at different layers.

---

## Pending Decisions

### P1 — Which endpoint fields are mandatory when `endpoints{}` is present?

If a host declares `endpoints{}`, must it include all three? Or can it declare only `mcp` without `distribution`?

**Leaning:** all fields optional individually; the block itself is optional.

### P2 — `securitySchemes{}` structure

The field exists in the spec doc as:
```json
"securitySchemes": {
  "bearer": { "type": "http", "scheme": "bearer" }
}
```
Alignment with OpenAPI `securitySchemes` is the obvious path, but the scope (agent-to-agent auth vs user-to-agent auth) needs clarification.

**Status:** pending. Blocked on understanding A2A auth model more deeply.

---

## Out of Scope

- **Transport protocol selection** — which transport (HTTP/SSE/STDIO/gRPC) a given endpoint uses is a runtime concern, not declared in the envelope.
- **Authentication enforcement** — how the runtime validates tokens against `securitySchemes` is a runtime concern.
- **Author-declared endpoints** — if an author wants to hardcode an endpoint (self-hosted, stable URL), there is no mechanism for this in V1 and it is not proposed here.
