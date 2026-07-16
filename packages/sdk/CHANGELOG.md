# Changelog

All notable changes to `@dot-agent/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.10.3] - 2026-07-16

### Added
- Browser-bundle regression test that bundles the whole `sdk → kernel-dsl` chain for a browser target (esbuild), gating the publish workflow — guards against a transitive `node:` scheme leak reaching browser consumers (the SDK is imported directly in browser workers).

### Dependencies
- Re-pinned `@dot-agent/kernel-dsl` → `0.10.3` (browser-bundle fix) and `@dot-agent/compiler` → `0.10.2`.

### Changed
- `loadAgent()`'s guides/knowledge classification now uses `classifyContentPath()` from `@dot-agent/compiler/core` instead of its own inline `startsWith('guides/')`/`startsWith('knowledge/')` checks — same behavior, one shared source of truth with the packer and `bundleFromDir()`.

---

## [0.10.2] - 2026-07-14

### Changed
- Build tooling migrated from `tsup` to `tsdown`; upgraded to TypeScript 7. No output-shape change.
- `@dot-agent/compiler` pin bumped to `0.10.1`, `@dot-agent/kernel-dsl` pin bumped to `0.10.2`, to pick up their own fixes from this release round.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development. (Note: `0.10.1` was also tagged and published prior to this changelog's creation, with no recorded changelog entry.)
