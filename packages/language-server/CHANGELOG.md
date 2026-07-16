# Changelog

All notable changes to `@dot-agent/language-server` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.10.2] - 2026-07-16

### Fixed
- **Diagnosing a `.behavior` file outside any agent bundle no longer crawls the filesystem.** When no `*.description` agent root was found, `diagnose()` fell back to the file's own directory and still ran the backward merge-edge scan (`findMergeRoot` → `collectBehaviorFiles`), a recursive depth-6 `readdir`. For a lone file opened at or near the filesystem root / home directory that meant walking huge protected trees — slow enough to time out and, on macOS, tripping the "access data from other apps" (TCC) permission prompt. The merge-edge walk is now gated on actually finding an agent bundle; a file outside any bundle has no merge graph and gets local-only lint.

### Changed
- `@dot-agent/parser-dsl` and `@dot-agent/compiler` pins bumped to `0.10.2` to pick up the browser-bundle fix from this release round. `@dot-agent/tree-sitter` stays `0.10.1`.

---

## [0.10.1] - 2026-07-14

### Changed
- Pin-only release: `@dot-agent/parser-dsl`, `@dot-agent/compiler`, and `@dot-agent/tree-sitter` pins bumped to `0.10.1` to pick up their fixes from this release round. No code change in this package — it ships JS source directly and has no build step.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
