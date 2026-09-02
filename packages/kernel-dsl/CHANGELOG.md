# Changelog

All notable changes to `@dot-agent/kernel-dsl` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **Conditions and `set` read memory.** An unquoted operand used to reach the kernel as the path
  *text*, so it was compared as a string: `if context.onboarding == true` was always false,
  `if session.count > 3` was always false, a bare `if context.flag` was always true even for a stored
  `false`, and `set context.a = session.b` stored the literal text `"session.b"` and shipped it to the
  host as an `Effect::SetMemory`. Each now resolves against `MemoryStore`. **This corrects behavior
  silently**: a flow that always took the `then` branch may now always take the `else` branch, with no
  diagnostic. Requires `@dot-agent/parser-dsl` with the tagged `Value` contract (ADR DA00-10).
- **`== null` and `!= null` answer whether a path is set.** Two nulls compared as unequal, so
  `if context.x == null` could never be true and `if context.x != null` was true for an unset path —
  both backwards. A behavior that relied on the old `!= null` flips. See ADR DA00-11.

### Changed

- **BREAKING — an unquoted operand with no domain resolves to null.** A lookup needs
  `<domain>.<key>`, so `set context.stage = planning` now stores null where it stored the text
  `"planning"`. Quote it — `set context.stage = "planning"` — to keep the literal.
- **BREAKING — a comparison between two unresolvable operands is now true.** This is the two changes
  above composed: an unquoted word with no domain resolves to null, and null now equals itself, so
  `if mode == active` and `if context.missing == planning` take the `then` branch where they took
  `else`. The shape to audit is a bare word written meaning a literal — `if user.plan == free` now
  fires whenever `user.plan` is unset, which is the opposite of the intent. Quoting the word restores
  the old result. No diagnostic fires for either half.

---

## [0.10.3] - 2026-07-16

### Fixed
- **Browser bundles no longer break on `node:fs/promises`.** The Node-only WASM loader's dynamic `import('node:fs/promises')` was emitted verbatim by `tsdown`, where the previous `tsup` build had silently stripped the `node:` prefix. Webpack rejects the `node:` scheme statically at build time — regardless of the `isNodeRuntime()` runtime guard — so `0.10.2` 500'd any browser/webpack consumer. The specifier is now built at runtime so no bundler can resolve the scheme statically; it stays a Node-only path guarded by `isNodeRuntime()`. (This corrects the `0.10.2` note below: the `tsup`→`tsdown` swap *did* change output shape — the emitted `node:` import.)
- Added a browser-bundle regression test (esbuild `platform:'browser'`) that gates the publish workflow before release.

---

## [0.10.2] - 2026-07-14

### Changed
- Build tooling migrated from `tsup` to `tsdown`; upgraded to TypeScript 7. No output-shape change.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development. (Note: `0.10.1` was also tagged and published prior to this changelog's creation, with no recorded changelog entry.)
