---
"@dot-agent/kernel-dsl": patch
---

**`== null` and `!= null` answer whether a path is set.** Two nulls compared as unequal, so
`if context.x == null` could never be true and `if context.x != null` was true for an unset path —
both backwards. A behavior that relied on the old `!= null` flips. See ADR DA00-11.
