# Changelog

All notable changes to `@dot-agent/parser-dsl` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **BREAKING — `Value` gained an object shape, and a memory reference now uses it.** An unquoted
  operand — either side of a comparison, or the right-hand side of a `set` — is a memory reference and
  is emitted as `{ "path": "session.count" }` where it used to be the bare string `"session.count"`.
  The published type moves from `string | number | boolean | null` to
  `string | number | boolean | null | { path: string }`. A consumer that pattern-matches a condition
  operand as a plain string must handle the object arm. Quoted literals are unaffected and still
  arrive as plain strings, and the tag is positional: a state's `name` and a `transition_stmt`'s
  `state` are not operands and do not change. Rationale and the rejected alternatives are in ADR
  DA00-10.

---

## [0.10.2] - 2026-07-16

### Fixed
- **Browser bundles no longer break on `node:fs/promises`** — same fix as `@dot-agent/kernel-dsl@0.10.3`: the Node-only WASM loader's dynamic `import` is now built at runtime so bundlers can't resolve the `node:` scheme statically. Also replaced the browser/Node split's unreliable `typeof window` check (false inside Web Workers, which sent them down the Node `readFile` path) with an explicit `isNodeRuntime()`.
- Added a browser-bundle regression test (esbuild `platform:'browser'`) that gates the publish workflow.

---

## [0.10.1] - 2026-07-14

### Changed
- Build tooling migrated from `tsup` to `tsdown`; upgraded to TypeScript 7. No output-shape change.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
