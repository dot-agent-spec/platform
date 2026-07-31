<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Raise esbuild and Configure Grouped Dependabot Updates

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track C |

---

## Context

Four of the repository's genuine Dependabot alerts are against `esbuild@0.21.5`, declared as a
devDependency in `packages/sdk/package.json`, `packages/parser-dsl/package.json`,
`apps/vscode-extension/package.json` and the root `package.json`.

As a security matter these are the least urgent alerts the repository has: the advisory requires an
attacker to lure a developer to a malicious website while a local esbuild dev server is listening, and
nothing here runs one in normal use. The stronger reason to act is that the pin is already broken
independently of any CVE — `npm ls` reports:

```
esbuild@0.21.5 deduped invalid: "^0.27.0 || ^0.28.0" from node_modules/vitest/node_modules/vite
```

vitest's bundled vite requires a range the declared version does not satisfy, so the dependency tree is
internally inconsistent today.

This is the only task in [Plan-003](../plans/003-pre-monorepo-fossil-cleanup.md) carrying real regression
risk. esbuild is pre-1.0, where a minor bump is a breaking change by convention, and it sits under the
build of three packages. It is sequenced last for that reason.

The task also adds the Dependabot configuration the repository has never had, so future advisories arrive
as one grouped pull request instead of one per advisory.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P1 | Raise `esbuild` to `^0.28.1` in **five** manifests | root, sdk, parser-dsl, kernel-dsl, vscode-extension | M |
| 2 | P1 | Patch `brace-expansion` and `postcss` | root lockfile (transitive) | XS |
| 3 | P2 | Add `.github/dependabot.yml` with grouped security updates | repo root | S |

> **Updated after Tracks A and B merged.** Two corrections from the post-merge Dependabot rescan:
> `packages/kernel-dsl/package.json` also declares `esbuild ^0.21.5` — it was masked by that package's
> own nested lockfile until Track A deleted it — so item 1 covers five manifests rather than four. And
> two advisories published 2026-07-24 surfaced that the original enumeration never had; they are item 2.

---

## Work items

### 1. Raise `esbuild` to `^0.28.1` — P1

**What:** Change the `esbuild` devDependency from `^0.21.5` to `^0.28.1` in all four manifests.

**Why:** Two advisories and one broken constraint. Choosing `0.28.1` rather than the advisory's minimum
patched `0.25.0` satisfies all three at once:

| Constraint | Requires |
|---|---|
| Dev-server request advisory (moderate) | `>= 0.25.0` |
| Windows arbitrary-file-read advisory (low) | `>= 0.28.1` |
| vitest's bundled vite | `^0.27.0 \|\| ^0.28.0` |

Stopping at `0.25.0` would clear the moderate alerts but leave both the low alert and the `invalid`
marker in place — a second pass over the same four files for no benefit.

**Change:** Bump all four together; a split bump would leave the workspace resolving two esbuild majors.
Then, because this is a pre-1.0 bump across seven minors:

1. `npm ci` from clean — not an incremental install.
2. `npm run build` across all workspaces.
3. Full test suite.
4. Rebuild `apps/vscode-extension` and confirm the packaged extension still activates and its bundled
   language server starts. The extension bundles its build output rather than consuming it from npm, so a
   build-tool regression there is invisible to the unit tests.

If the build breaks, read esbuild's changelog for the specific minor that broke it and record the finding
in the plan's `Surprises & Discoveries` before working around it.

### 2. Patch `brace-expansion` and `postcss` — P1

**What:** `npm update brace-expansion postcss` at the repository root — `brace-expansion` 5.0.7 → 5.0.8,
`postcss` 8.5.16 → 8.5.18. Both are patch bumps of transitive dependencies; neither is declared directly
by any manifest here.

**Why:** Both advisories were published 2026-07-24 and surfaced on the rescan triggered by merging
Tracks A and B. Both are labelled **high**, and neither reaches a consumer — which is the point worth
recording rather than the fix, which is trivial:

- `postcss` is honestly labelled `development`: `vitest → vite → postcss`.
- `brace-expansion` is labelled **`scope: runtime`, and that label is wrong in practice.** It arrives via
  `vscode-dot-agent → @vscode/vsce → minimatch → brace-expansion`, and `@vscode/vsce` is a
  *devDependency* — the VS Code packaging tool. `apps/vscode-extension` additionally packages with
  `vsce package --no-dependencies`, so nothing from `node_modules` reaches the `.vsix`. Dependabot reads
  the root lockfile, where a workspace's dev/prod split is flattened away, so it cannot tell.

Fix them because they are free, not because they are urgent. If either bump turns out not to be free —
if npm wants to move a major to satisfy it — stop and report rather than forcing it; the reach does not
justify the risk.

### 3. Add `.github/dependabot.yml` — P2

**What:** Create `.github/dependabot.yml` enabling grouped security updates for the npm ecosystem at the
repository root.

**Why:** The repository has no Dependabot configuration, so alerts accumulate in the UI with no automated
remediation path and no batching. Ungrouped, the 18 alerts this plan is clearing would have arrived as 18
separate pull requests.

**Change:** One `package-ecosystem: npm` entry with `directory: "/"` — the root, because npm workspaces
resolve through the root lockfile and per-package directory entries would recreate exactly the
per-package-scan confusion that the nested lockfiles caused. Use a `groups` block so security updates
batch into a single PR.

Two notes for whoever writes it:

- Set a conservative `open-pull-requests-limit`; the default of 5 is reasonable for a repository this
  size.
- Version updates (as opposed to *security* updates) are noisier and are not required by this plan. If
  enabled, group them separately from security updates so an urgent patch is never queued behind a
  routine bump.

---

## Implementation order

```
P1:  1 (esbuild, five manifests) - clean install, build, test, extension smoke test
P1:  2 (brace-expansion, postcss) - trivial, independent
P2:  3 (dependabot.yml) - independent, may land first
```

Item 2 touches no build input and can land at any point. Item 1 must be its own commit so it can be
reverted alone if the build regresses.

## Acceptance

- `npm ls esbuild` reports no `invalid` marker.
- `npm ci && npm run build` succeeds from a clean clone; the full test suite passes.
- The rebuilt VS Code extension activates and its bundled language server responds.
- `.github/dependabot.yml` exists and is accepted by GitHub — confirm the Dependabot tab reports no
  configuration parse error after the file lands on the default branch.
- Combined with the other Plan-003 tasks, the open Dependabot alert count reaches `0`.
