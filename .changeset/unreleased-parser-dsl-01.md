---
"@dot-agent/parser-dsl": minor
---

**BREAKING — `Value` gained an object shape, and a memory reference now uses it.** An unquoted
operand — either side of a comparison, or the right-hand side of a `set` — is a memory reference and
is emitted as `{ "path": "session.count" }` where it used to be the bare string `"session.count"`.
The published type moves from `string | number | boolean | null` to
`string | number | boolean | null | { path: string }`. A consumer that pattern-matches a condition
operand as a plain string must handle the object arm. Quoted literals are unaffected and still
arrive as plain strings, and the tag is positional: a state's `name` and a `transition_stmt`'s
`state` are not operands and do not change. Rationale and the rejected alternatives are in ADR
DA00-10.
