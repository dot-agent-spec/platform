# Changelog

All notable changes to `@dot-agent/kernel-dsl` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **`serialize_state()` / `restore_state(state_json)` — the FSM position is now persistable.** A host could already persist memory through `get_memory` / `set_memory`, but nothing exposed where the FSM stood, so a runtime could not evict the kernel and resume. `serialize_state()` returns a compact versioned blob (`{"v":1,"state":"booking","prompt_count":3}`) and `restore_state()` repositions the FSM from it **without firing entry effects**. The prompt counter travels with the state name because `after N prompts` handlers fire off it and a transition zeroes it — restoring the name alone would fire those handlers a turn late. The blob **excludes memory** by design; that half stays the runtime's, through the existing pair. `restore_state` throws (rather than returning a value a caller can ignore) when the blob is malformed, carries an unreadable version, names a state the loaded behavior does not declare, or when no behavior has been loaded; it validates before writing, so a rejected restore leaves the kernel untouched.

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
