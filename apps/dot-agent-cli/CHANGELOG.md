# Changelog

All notable changes to `@dot-agent/cli` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- `dot-agent pack` and `dot-agent run <dir>` failed with a false-positive `E018` for any agent whose `teach`/`guide` targets lived under `knowledge/` or `guides/` — including this package's own `helper-src/`. Fixed in `@dot-agent/compiler`; see its changelog for the root cause. Until now, `npm run repack-helper` (and therefore `prepublishOnly`) could not succeed.

### Added
- `repack-helper` script, wired into `prepublishOnly`, so a stale or out-of-sync `assets/helper.agent` can never ship silently again.
- `pack` and `run` now surface `W015` for files left in `guides/`/`knowledge/` that no `guide`/`teach` statement references. Such files are **not** bundled — only linked content is packed.

### Changed
- `assets/helper.agent` regenerated from `helper-src/`.

### Documentation
- `README.md` and the helper's own knowledge (`helper-src/knowledge/pack.md`, `dsl-overview.md`) now state the linked-only rule: a file in `guides/`/`knowledge/` is packed only when the behavior names it, and an unreferenced one is reported (`W015`) and left out. An unreferenced file would be unreachable at runtime anyway — the host only ever learns a filename from a `teach` effect, and there is no way to list the knowledge directory.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
