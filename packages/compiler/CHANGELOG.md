# Changelog

All notable changes to `@dot-agent/compiler` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- **`guide`/`teach` file references no longer double-nest or cross namespaces.** The packer derived a content file's bundle location from the statement *keyword* (`teach`→`knowledge/`, `guide`→`guides/`) and prepended it to the reference text. Every real agent — and the shipped Master Gardener example — writes the path already prefixed (`teach "knowledge/x.md"`), so the keyword-prefix produced `knowledge/knowledge/x.md`, and a `teach "guides/x.md"` landed at `knowledge/guides/x.md` (a guide misfiled into the knowledge namespace). It also caused a phantom `W015` on the recommended layout, since the referenced-set key never matched the on-disk path. The bug was invisible to the test suite, which only exercised bare filenames.

### Changed
- **Breaking (reference convention): a `guide`/`teach` file reference is now a path relative to the agent root**, resolved literally and bundled verbatim at that same path. The namespace comes from the path (`knowledge/x.md`, `guides/x.md`), not the keyword — the keyword is now purely semantic. The old "resolve against the namespace directory first, then a file loose next to `agent.behavior`" two-candidate lookup is gone. Agents that relied on a bare `teach "recipes.txt"` being auto-foldered into `knowledge/` must move the file under `knowledge/`/`guides/` and reference it by its full path.
- `E018` now reports the single path it resolved (`looked for 'knowledge/x.md' relative to the agent root`) instead of two candidate paths.

### Added
- **`W016` — reference outside a content namespace.** A `guide`/`teach` reference that resolves to a real, existing file outside `guides/`/`knowledge/` is bundled verbatim but unreachable at runtime (only those two prefixes are served), so it is flagged. Catches the legacy loose-file convention. Only fires when the file actually exists and will be bundled — a reference to a nonexistent file gets `E018` instead. Emitted by `findOrphanContentFiles()`.
- **`E020` — reference collides with a reserved bundle path.** A `guide`/`teach` reference is no longer namespace-guessed, so nothing else stops it from resolving to a path already occupied by the description file, `agent.behavior`, a merge source under `behaviors/`, or the persona. `collectFiles()` now refuses instead of silently overwriting that entry.
- `CONTENT_NAMESPACES` / `isInContentNamespace` / `classifyContentPath`, exported from both the main entry and `@dot-agent/compiler/core` — the single source of truth for "is this bundle path under `guides/` or `knowledge/`", now shared by the packer, `bundleFromDir()`, and `@dot-agent/sdk`'s `loadAgent()` instead of each hand-rolling the same prefix check.

---

## [0.10.1] - 2026-07-14

### Fixed
- **`E018` false positive on the recommended layout.** Any agent whose `guide "x.md"` / `teach "x.md"` targets lived under `guides/` or `knowledge/` — the layout the docs and `dot-agent init` recommend — failed to pack. `collectFiles()` bundled those directories wholesale, then independently re-read every reference from the *agent root*, and threw when the root read missed. Regression from `a96738c`, which added the reference loop for loose files without checking what the directory walk had already collected.
- **Same failure blocked `dot-agent run <dir>`.** `bundleFromDir()` shares `collectFiles()`, so the dev/MCP path was broken too, not just packaging. Nothing about this was visible in the original bug report.
- `E018` now names both candidate paths it tried (`knowledge/x.md` and `x.md`) instead of only reporting the file as missing.

### Changed
- **Breaking (bundle contents): content files are packed only when the behavior links them.** `guides/` and `knowledge/` are no longer swept into the bundle. A file ships only when a `guide "x.md"` or `teach "x.txt"` statement names it, so the bundle is a function of the behavior graph rather than of whatever happens to sit in the directory. Each reference resolves against its namespace directory first (`guides/x.md`, `knowledge/x.md`), then falls back to a file sitting loose next to `agent.behavior`; either way it lands under `<namespace>/` in the bundle. A reference resolving to neither is `E018`.

  The rule follows from runtime reachability: the kernel's `teach` effect hands the host a bare filename, and the MCP server exposes `dot-agent://knowledge/{name}` with **no listing endpoint**, so nothing can discover a file the behavior never mentions. An unreferenced file was dead weight in the ZIP, the `sha256`, and `files.json`, with no path to being read.
- `E014` now also covers `guide`/`teach` paths that escape the agent root, not just `merge` / `behavior` / `persona`.
- Build tooling migrated from `tsup` to `tsdown`; upgraded to TypeScript 7. No output-shape change.
- `@dot-agent/parser-dsl` and `@dot-agent/tree-sitter` pins bumped to `0.10.1` to pick up their own fixes from this release round.

### Added
- **`W015` — unreferenced content file.** A file under `guides/` or `knowledge/` that no `guide`/`teach` statement names is reported and left out of the bundle. This is the safety net for the change above: without it, the linked-only rule would drop files silently. It also catches files that `guide`/`teach` could never reference at all, such as `knowledge/data.csv` — only `.md` and `.txt` are treated as file references.
- `findOrphanContentFiles(dir, mergedBehaviorText)` exported from `src/pack.ts`. Called by both `pack()` (warnings land in `PackResult.warnings`) and `bundleFromDir()` (printed to stderr), so `pack` and `run` report the same thing.
- Test coverage for the `guide`/`teach` bundling path, which previously had none: references under `knowledge/`, loose at the root, nested, colliding root-vs-directory, escaping the root, and missing entirely.

### Documentation
- `docs/reference/lint-codes.md` — registered four codes: the new `W015`, plus `E018`, `E019` and `W014`, which the compiler already emitted but which had never been added to the registry.
- `docs/concepts/pipeline.md` — Layer 4 now documents the linked-only rule and the `W015` step.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
