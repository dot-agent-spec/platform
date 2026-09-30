---
"@dot-agent/kernel-dsl": minor
---

**BREAKING — an unquoted operand with no domain resolves to null.** A lookup needs
`<domain>.<key>`, so `set context.stage = planning` now stores null where it stored the text
`"planning"`. Quote it — `set context.stage = "planning"` — to keep the literal.
