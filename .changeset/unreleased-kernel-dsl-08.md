---
"@dot-agent/kernel-dsl": minor
---

**BREAKING — a comparison between two unresolvable operands is now true.** This is the two changes
above composed: an unquoted word with no domain resolves to null, and null now equals itself, so
`if mode == active` and `if context.missing == planning` take the `then` branch where they took
`else`. The shape to audit is a bare word written meaning a literal — `if user.plan == free` now
fires whenever `user.plan` is unset, which is the opposite of the intent. Quoting the word restores
the old result. No diagnostic fires for either half.
