# @dot-agent/parser-dsl

## 0.12.0-beta.1

### Minor Changes

- b340f27: **BREAKING — `Value` gained an object shape, and a memory reference now uses it.** An unquoted
  operand — either side of a comparison, or the right-hand side of a `set` — is a memory reference and
  is emitted as `{ "path": "session.count" }` where it used to be the bare string `"session.count"`.
  The published type moves from `string | number | boolean | null` to
  `string | number | boolean | null | { path: string }`. A consumer that pattern-matches a condition
  operand as a plain string must handle the object arm. Quoted literals are unaffected and still
  arrive as plain strings, and the tag is positional: a state's `name` and a `transition_stmt`'s
  `state` are not operands and do not change. Rationale and the rejected alternatives are in ADR
  DA00-10.

## 0.12.0-alpha.0

### Minor Changes

- b340f27: **BREAKING — `Value` gained an object shape, and a memory reference now uses it.** An unquoted
  operand — either side of a comparison, or the right-hand side of a `set` — is a memory reference and
  is emitted as `{ "path": "session.count" }` where it used to be the bare string `"session.count"`.
  The published type moves from `string | number | boolean | null` to
  `string | number | boolean | null | { path: string }`. A consumer that pattern-matches a condition
  operand as a plain string must handle the object arm. Quoted literals are unaffected and still
  arrive as plain strings, and the tag is positional: a state's `name` and a `transition_stmt`'s
  `state` are not operands and do not change. Rationale and the rejected alternatives are in ADR
  DA00-10.

## 0.10.2 and earlier

Releases up to 0.10.2 were recorded by hand, in Keep a Changelog format, before this package moved to changesets. That history is kept in git: [CHANGELOG.md at 73b975b](https://github.com/dot-agent-spec/platform/blob/73b975bc1f4e88a18f47f89b711c8b5207b05e6c/packages/parser-dsl/CHANGELOG.md).
