# Changelog

All notable changes to `@dot-agent/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `session.snapshot()` returns an opaque, JSON-serialisable `AgentSnapshot` — the kernel's FSM position (state and prompt count) plus the whole memory store, with its own format version and the agent's id (#17).
- `session.restore(snapshot, options?)` rehydrates a fresh `AgentSession` in place of `start()`, with the same `resolveContent` option: it loads the behavior, discards the `init` entry effects so no handler or listener sees them, clears the memory that load wrote (with the kernel's new `clear_memory()`), repositions the FSM and writes the snapshot's memory back — so the restored memory is exactly the snapshot's, every value's type and content intact, and memory injected before a successful restore is replaced. A snapshot from a different agent or behavior revision, a malformed one, one of an unknown version, or a behavior that fails to parse throws and leaves the session unstarted, its injected memory and file resolver in place, and usable for `start()` (#17).
- `AgentSnapshot` and `StartOptions` types are exported.

### Changed
- `start()` now throws on a session that was restored from a snapshot, and `restore()` throws on a session already started or restored. `snapshot()` throws before either, and after a `start()` whose behavior failed to parse (`start()` itself still reports that as a `parse_error` effect).

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
