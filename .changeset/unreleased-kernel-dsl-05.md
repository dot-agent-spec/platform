---
"@dot-agent/kernel-dsl": patch
---

**Conditions and `set` read memory.** An unquoted operand used to reach the kernel as the path
*text*, so it was compared as a string: `if context.onboarding == true` was always false,
`if session.count > 3` was always false, a bare `if context.flag` was always true even for a stored
`false`, and `set context.a = session.b` stored the literal text `"session.b"` and shipped it to the
host as an `Effect::SetMemory`. Each now resolves against `MemoryStore`. **This corrects behavior
silently**: a flow that always took the `then` branch may now always take the `else` branch, with no
diagnostic. Requires `@dot-agent/parser-dsl` with the tagged `Value` contract (ADR DA00-10).
