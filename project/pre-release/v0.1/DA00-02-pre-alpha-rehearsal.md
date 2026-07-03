<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Log: Pre-alpha rehearsal of the coordinated release pipeline

| Field | Value |
|---|---|
| ADR | [DA00-02: two-axis versioning](../../adr/DA00-02-two-axis-versioning.md) |
| Date | 2026-07-03 |
| Task | `project/tasks/DA01-01-update-version-and-packages.md` (item 8) |

---

## Why this log exists

Nothing had ever been published through the current monorepo's coordinated pipeline
(`scripts/release.mjs` → git tag → `publish-*.yml` → OIDC → npm/crates.io/Marketplace). Before
committing every package to the real, permanent `0.10.0` jump ([DA00-02](../../adr/DA00-02-two-axis-versioning.md)),
all seven npm packages, the `tree-sitter` crate, and the VS Code extension were bumped in lockstep
to the throwaway pre-release number `0.5.0-alpha.1` (`vscode` used its own Marketplace convention,
`0.5.1`) and pushed for real. This is the record of what broke and what it took to get every
package published clean.

## Outcome

All eight targets published successfully by the end of the rehearsal:

| Target | Registry | Result |
|---|---|---|
| `@dot-agent/tree-sitter` | npm (`alpha` tag) + crates.io | ✅ |
| `@dot-agent/parser-dsl` | npm (`alpha` tag) | ✅ |
| `@dot-agent/kernel-dsl` | npm (`alpha` tag) | ✅ |
| `@dot-agent/compiler` | npm (`alpha` tag) | ✅ |
| `@dot-agent/sdk` | npm (`alpha` tag) | ✅ |
| `@dot-agent/language-server` | npm (`alpha` tag) | ✅ |
| `@dot-agent/cli` | npm (`alpha` tag) | ✅ |
| `vscode-dot-agent` | VS Code Marketplace + Open VSX | ✅ (pre-release) |

`latest` on every npm package was untouched throughout — everything landed under the `alpha`
dist-tag, exactly as designed.

## Bugs found and fixed

Nine distinct, real bugs surfaced only by actually running the pipeline — none were visible from
reading the workflow files or from local `npm test`/`npm run build`:

1. **GitHub silently drops tag-push events past 3 per `git push`.** Pushing all 8 tags in one
   command triggered almost none of their workflows. Fix: push tags one at a time (or in batches
   of ≤3).
2. **Corrupted root `package-lock.json`.** Four `@dot-agent/*` entries under
   `apps/vscode-extension/node_modules` resolved to `file:/tmp/dot-agent-*.tgz` — leftovers from an
   `npm install --workspaces=false` mistake in an earlier session, committed by accident. `npm ci`
   requires those exact files to exist, so every workflow's install step failed with `ENOENT` on a
   fresh checkout. Fixed by a clean `rm -rf node_modules package-lock.json && npm install`.
3. **npm's install-script allowlist silently skipped `tree-sitter-cli`'s install step**, which
   `generate`/`test` depend on. Approved it and the other legitimately pending scripts (`esbuild`,
   `keytar`, `@vscode/vsce-sign`, `fsevents`) via `npm approve-scripts`, committing the resulting
   `allowScripts` block in the root `package.json`.
4. **`packages/tree-sitter`'s scripts hardcoded `../node_modules/.bin/tree-sitter`**, a relative
   path that only worked by accident depending on where npm happened to hoist the binary. Broke
   outright after the lockfile regeneration changed the hoist location; an `npx tree-sitter`
   attempt broke differently (npx appears to alter the effective cwd tree-sitter resolves
   `grammar.js` against). Fixed to a bare `tree-sitter` — `npm run` already puts every ancestor
   `node_modules/.bin` on `PATH`.
5. **`publish-ts.yml` never built the internal dependency chain.** `compiler` imports types from
   `parser-dsl`; `sdk` and `cli` import from `compiler` (`cli` also from `sdk`); `sdk` needs
   `kernel-dsl`'s WASM at runtime. None of that chain is prebuilt on a bare checkout, so tsup's
   `dts` step failed on every target except `language-server` (whose build is a deliberate no-op).
   Fixed by always building `tree-sitter → parser-dsl → kernel-dsl → compiler → sdk` before the
   tag's own target, regardless of which package triggered the run.
6. **`publish-kernel-dsl.yml` called a script that doesn't exist** (`build:release` instead of the
   real `build`) — would have failed on every kernel-dsl publish, rehearsal or real.
7. **`kernel-dsl` never shipped `pkg/`.** `dist/index.js` loads its WASM via
   `new URL('../pkg/..._bg.wasm', import.meta.url)` — a path relative to `dist/index.js` itself,
   assuming `pkg/` sits next to `dist/` at runtime. `package.json`'s `files` only listed `"dist/"`,
   so a real `npm install` of this package would never receive the WASM binary at all and `init()`
   would throw `ENOENT` on first use. Invisible in-repo because `dist/` and `pkg/` are siblings on
   disk regardless of what `files` says. `parser-dsl` already had this right
   (`files: ["dist/", "pkg/"]`) — `kernel-dsl` just missed it. Also fixed the workflow's
   `Verify build artifacts` step, which checked for a root-level `index.js` and a `scripts/`
   directory neither of which exist anymore, and added a check that `files` actually includes
   `pkg/` so this can't silently regress.
8. **`publish-vscode.yml`'s Open VSX step never ran when the Marketplace step above it failed** —
   `continue-on-error: true` only protects the *job's* outcome, it doesn't make GitHub execute a
   later step after a sibling step failed. Fixed with `if: always()`.
9. **`VSCE_PAT` initially lacked Marketplace permission** for the `dot-agent` publisher
   (`Access Denied ... Make changes to ... an existing extension`) — external Azure DevOps PAT
   scope issue, fixed by regenerating the token with the correct scope. Not a code bug, but the
   reason the very first `vscode@0.5.1` run needed a manual "re-run failed jobs" after the token
   was fixed.

Two more real bugs were found and fixed in the same session but *before* the tags were first
pushed (caught by running the full test suite ahead of the bump, not by the rehearsal's CI runs
themselves):

- `packages/sdk`'s test fixture still used `schemaVersion` instead of `dslVersion`, a regression
  from the provenance-stamping work (`DA01-01-dsl-spec-versioning.md`) that `packages/compiler`'s
  own test suite didn't catch since only its fixtures had been updated.
- `bundleFromDir()` in `packages/compiler/src/bundle.ts` packed the raw `consolidate()` output
  (still containing dead `merge "..."` directive lines) instead of `collectFiles()`'s already-
  stripped version.

## What this validates

Every mechanical piece [DA00-02](../../adr/DA00-02-two-axis-versioning.md) depends on now has a
real, green run behind it: the `<pkg>@<version>` tag format, the `alpha`/`latest` npm dist-tag
split, OIDC trusted publishing on both npm and crates.io, and the VS Code Marketplace/Open VSX
publish step. The real `0.10.0` jump should be mechanically identical to this rehearsal — bump,
tag, push (one at a time), watch CI.

## Not addressed here (deliberately out of scope)

- Five more stray per-package `package-lock.json` files exist elsewhere in the monorepo
  (`apps/dot-agent-cli`, `packages/{compiler,kernel-dsl,language-server,tree-sitter}`) beyond the
  root one fixed here.
- `scripts/release.mjs` still lacks the `"*"` → exact-version dependency-pinning logic called for
  in `DA01-03-cli-run-refactor-mcp-server.md` §3.3.
- The example bundles under `examples/`, `dogfood/mentor-agent/`, and `apps/dot-agent-cli`'s own
  README/`file structure.md` still reference the old `schemaVersion` field name — they are not
  part of any published package, but would fail `parseAboutme` against the current compiler if
  loaded. Regenerate via `dot-agent pack` when convenient.
