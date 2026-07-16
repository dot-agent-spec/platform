# Changelog

All notable changes to `@dot-agent/parser-dsl` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
