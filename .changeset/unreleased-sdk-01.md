---
"@dot-agent/sdk": minor
---

`session.snapshot()` returns an opaque, JSON-serialisable `AgentSnapshot` — the kernel's FSM position (state and prompt count) plus the whole memory store, with its own format version and the agent's id (#17).
