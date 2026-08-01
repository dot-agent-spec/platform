# Plan-003: Pre-Monorepo Fossil Cleanup and Dependency Security Baseline

| Field | Value |
|---|---|
| Status | Shipped (2026-08-01) — Track E lands with [PR #37](https://github.com/dot-agent-spec/platform/pull/37); the file is kept, as plans are |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Tracking issue | [#29](https://github.com/dot-agent-spec/platform/issues/29) — owns status and the executive summary; this file owns the design and the working record. |
| Related | [#19](https://github.com/dot-agent-spec/platform/issues/19) (closed by Track D) · [#22](https://github.com/dot-agent-spec/platform/issues/22) / [Plan-001](001-adopt-vibe-ops-baseline.md) Track 3 (advanced by Track E) |

---

## Summary

This repository was assembled by flattening eight standalone repositories into one npm-workspaces
monorepo. The flatten moved the code correctly, but left behind per-package artifacts that only made
sense when each package was its own repository root: nested `package-lock.json` files, a git hook, an
`.npmignore`, a workspace glob pointing at a folder that is no longer a package, and documentation links
to repositories that are now archived or deleted. Those fossils are not merely untidy — two of them cause
active harm. The nested lockfiles generate twelve false GitHub Dependabot security alerts describing
package versions this repository does not install, and the git hook silently disabled license-header
enforcement across the whole repo. This plan removes the fossils, fixes the small number of genuine
dependency vulnerabilities hiding behind the false ones, and moves license-header enforcement to CI where
it fails visibly.

## Goals

1. Every fossil listed in **Design** is gone from the working tree, and no new one is introduced.
2. GitHub's Dependabot alert count for this repository reaches zero, with each alert closed by an actual
   fix rather than by dismissal.
3. The two vulnerable packages that reach published consumers — `fast-uri` and `@hono/node-server`, both
   pulled in transitively by `@dot-agent/cli` — resolve to patched versions.
4. License-header enforcement runs in CI on every pull request, replacing the hook that has not worked
   since the flatten.
5. `npm ci && npm run build` and the full test suite pass at the end of every track, not only at the end
   of the plan.

## Scope

### In scope

The mechanical removal of pre-monorepo fossils; the dependency upgrades needed to clear real Dependabot
alerts; repointing documentation links that target archived or deleted repositories; adding a
`.github/dependabot.yml` so future alerts arrive as grouped pull requests; and moving license-header
enforcement into CI.

### Out of scope

- **Unsetting `core.hooksPath`.** The repository-level git setting was originally written by the fossil
  described in Track D, but it is now load-bearing: contributors — including this repository's maintainer
  — keep hooks at `<repo-root>/.githooks/` that depend on it. Issue #19 flags this explicitly. Removing
  the `prepare` script that *writes* the setting does not, and must not, unset the value in existing
  clones.
- **The 18 vulnerabilities' underlying transitive dependency graph.** Where upstream has not published a
  patched version, this plan records the fact rather than vendoring or patching around it.
- **A build-and-test CI workflow.** Track D adds the repository's first `pull_request` workflow, but it
  runs only the license-header check. That no workflow currently runs tests on a pull request is a real
  gap (see `Surprises & Discoveries`); closing it involves matrix and caching decisions that would make a
  small security fix unreviewable, so it is raised separately.
- **The four Plan-001 Track 3 folders not touched here** — `packages/parser-dsl/`, `packages/kernel-dsl/`,
  `packages/compiler/` and `plugins/claude/`. They carry their own link rot and stay on Track 3's
  opportunistic schedule.
- **`apps/agy/` and `plugins/claude/`**, which postdate the flatten and carry no fossils.

## Design

### Two independent problems that look like one

GitHub reports 18 open Dependabot alerts (2 critical, 3 high, 11 moderate, 2 low). That number is
misleading, and the reason is a fossil rather than a security fact.

npm workspaces resolve every dependency through a **single lockfile at the repository root**. Nested
`package-lock.json` files inside workspace packages are ignored entirely by `npm install` and `npm ci`.
Five such files survive the flatten:

```
packages/compiler/package-lock.json         packages/kernel-dsl/package-lock.json
apps/dot-agent-cli/package-lock.json        packages/language-server/package-lock.json
packages/tree-sitter/package-lock.json
```

All five are tracked in git and were last modified in June 2026, before the flatten. Dependabot does not
model npm workspaces; it scans every lockfile it finds. Two of these five — `packages/compiler/` and
`apps/dot-agent-cli/` — contain vulnerable entries, and together they produce **12 of the 18 alerts**,
including *both* criticals and two of the three highs. Those alerts describe software that is not
installed. The clearest illustration:

| Package | Nested lockfile claims | Actually installed |
|---|---|---|
| `vitest` | `< 3.2.6` (critical, CVE-2026-47429) | `4.1.10` — not vulnerable |
| `vite` | `<= 6.4.2` (high, CVE-2026-53571) | `8.1.4` — not vulnerable |

Deleting the five files therefore closes 12 alerts without changing a single installed byte. It also
removes a standing trap: anyone reading `packages/compiler/package-lock.json` to answer "what version of
vitest do we use?" gets an answer that has been wrong for over a month.

The **remaining 6 alerts are genuine**, and they split by *reach*, which matters more than the CVSS
severity label. Severity is assigned by the advisory author with no knowledge of how a project consumes
the dependency; reach is what determines whether a third party is exposed.

- **Reaches published consumers (2).** `fast-uri@3.1.3` (high, CVE-2026-16221) and
  `@hono/node-server@1.19.14` (moderate) both arrive transitively through
  `@modelcontextprotocol/sdk@1.29.0`, which is a production dependency of `@dot-agent/cli` — a package
  this repository publishes to npm. Anyone running `npm install @dot-agent/cli` installs them. These are
  the two that genuinely matter.
- **Development only (4).** Four alerts on `esbuild@0.21.5`, declared in `packages/sdk/package.json`,
  `packages/parser-dsl/package.json`, `apps/vscode-extension/package.json` and the root
  `package.json`. The vulnerability requires an attacker to lure a developer to a malicious website while
  a local esbuild dev server is running. Low practical risk here, but the pin is independently stale:
  `npm ls` already reports `esbuild@0.21.5 deduped invalid: "^0.27.0 || ^0.28.0" from
  node_modules/vitest/node_modules/vite`, so the tree is internally inconsistent regardless of the CVE.

### The remaining fossils

**`dsl/*` is declared as an npm workspace but contains no package.** The root `package.json` declares
`"workspaces": ["packages/*", "apps/dot-agent-cli", "apps/vscode-extension", "dsl/*"]`. The `dsl/` folder
holds the language specification as documentation — `explanation/`, `reference/`, `tutorials/`,
`README.md`, `VERSION` — and no subfolder there has a `package.json`. The glob matches nothing and npm
silently ignores it, so this is a dead declaration rather than a live bug, but it misdescribes the
repository to every tool and reader that parses the manifest.

**`apps/dot-agent-cli/.npmignore` is a denylist in a repo that otherwise uses allowlists.** Six of the
eight publishable packages declare a `files` array; the CLI instead carries an `.npmignore` listing
`src/`, `tests/`, `.githooks/`, `.github/`, `node_modules/`, `*.config.ts`, `tsconfig.json`,
`vitest.config.ts`, `file structure.md`, `plan.md`, `.git` and `.gitignore`. Three of those paths —
`file structure.md`, `plan.md` and `.github/` — no longer exist. A denylist publishes anything a future
author forgets to add to it; an allowlist publishes nothing unless it is named. `@dot-agent/language-server`
is worse still: it has neither a `files` array nor an `.npmignore`, so it currently publishes its `src/`,
`tests/` and `tsconfig.json` to npm. `vscode-dot-agent` needs no `files` array because a VS Code extension
is packaged by `vsce` through `.vscodeignore`, which it has and which is the correct mechanism.

**Documentation links to repositories that no longer serve content.** Twelve links across
`packages/tree-sitter/AGENTS.md`, `packages/language-server/AGENTS.md`, `packages/language-server/README.md`,
`apps/vscode-extension/AGENTS.md` and `apps/vscode-extension/README.md` point at the pre-flatten
standalone repositories. Their current state:

| Target | State |
|---|---|
| `dot-agent-spec/dot-agent-kernel` | **404 — deleted** |
| `dot-agent-spec/dot-agent-tree-sitter` | **404 — deleted** |
| `dot-agent-spec/language-server` | archived |
| `dot-agent-spec/kernel-dsl` | archived |
| `dot-agent-spec/tree-sitter` | archived |
| `dot-agent-spec/vscode-dot-agent` | archived |

One of them is also mislabelled: `packages/language-server/AGENTS.md` renders the link text
`dot-agent-kernel` over a URL pointing at `kernel-dsl`. Every one of these targets now lives inside this
repository, so each link becomes a relative path.

### Why enforcement moves to CI rather than to a working hook

Issue #19 documents the license-header fossil in full and lays out both remedies. The hook approach
requires every clone to run a `prepare` script that writes a **repository-scoped** git setting, which is
precisely the side effect that caused the original defect: a single workspace package silently
reconfigured hooks for the entire monorepo. CI has neither problem — it needs no per-clone setup, it
cannot touch a contributor's git config, and it fails loudly and visibly on the pull request rather than
failing open on a machine nobody is watching.

## Tracks

Each track is one or more **task dossiers** under [`../tasks/`](../tasks/), which own the concrete work
items, the change procedure and the acceptance. This plan keeps the design rationale and the working
record; the tasks are deleted at closure while this file stays.

A dossier named below **without a link** has been closed and deleted — that is the normal end of a task,
not a missing file. Each is readable at the commit that still carried it:

```
git show 2c885e6:project/tasks/fossil-lockfiles-and-runtime-deps.md
git show 2c885e6:project/tasks/npm-publish-allowlists.md
git show 2c885e6:project/tasks/license-header-ci-enforcement.md
git show 30a7ffb:project/tasks/esbuild-and-dependabot-config.md
git show 8b06f75:project/tasks/agents-md-tree-sitter.md
git show 8b06f75:project/tasks/agents-md-language-server.md
git show 8b06f75:project/tasks/agents-md-vscode-extension.md
git show 8b06f75:project/tasks/agents-md-dot-agent-cli.md
```

| Track | Task | What it delivers |
|---|---|---|
| A — Fossils and runtime security | `fossil-lockfiles-and-runtime-deps.md` | Deletes the five nested lockfiles and the dead `dsl/*` glob; patches `fast-uri` and raises `@modelcontextprotocol/sdk` to unblock `@hono/node-server`. Takes the alert count from 18 to 4. |
| B — Packaging | `npm-publish-allowlists.md` | Converts `apps/dot-agent-cli` and `packages/language-server` from denylist/no-list to a `files` allowlist. |
| C — esbuild and Dependabot config | `esbuild-and-dependabot-config.md` | Raises `esbuild` to `^0.28.1` across the four manifests that declare it and re-approves the root's `allowScripts` pin; patches `brace-expansion` and `postcss`; adds `.github/dependabot.yml`, which the repository had never had. |
| D — License enforcement in CI | `license-header-ci-enforcement.md` | Adds a check mode to the script, moves it to the repo root, adds the repository's first `pull_request` workflow, deletes the fossil hook. **Closes #19.** |
| E — Per-folder `AGENTS.md` | `agents-md-tree-sitter.md` · `agents-md-language-server.md` · `agents-md-vscode-extension.md` · `agents-md-dot-agent-cli.md` | The full Plan-001 Track 3 sequence per folder: review → repoint dead links → deliver via `CLAUDE.md`. Closed Plan-001's Track 3 for all four folders. |

### Why Track E is four tasks rather than one sweep

[Plan-001](001-adopt-vibe-ops-baseline.md) Track 3 defines a three-step per-folder sequence — review the
folder's `AGENTS.md`, then repoint or delete its dead links, then add the one-line `CLAUDE.md` that makes
Claude Code load it — and states that the order is load-bearing: adding the `CLAUDE.md` first would start
*delivering* unreviewed guidance into agent context that is currently only sitting inert on disk. A wrong
instruction nothing reads is a smaller problem than one that loads.

Splitting per folder honours that design and lets each folder close independently, which is how Track 3
says the work should arrive — "by whoever is already in that code". It also keeps the review honest: the
checkbox asserts that a review happened, and a single sweeping task across four folders and ~530 lines
invites ticking four boxes off one skim.

The four folders are not symmetric. `apps/dot-agent-cli/` already has its `CLAUDE.md` and no dead links —
[Plan-002](002-dot-agent-as-claude-plugin.md) did that work — so its task is a pure content review, and it
is sequenced **last** because Tracks A, B and D all falsify statements the file currently makes.
`apps/vscode-extension/` is at the other extreme, with six dead links across two files.

## Success criteria

- `gh api repos/dot-agent-spec/platform/dependabot/alerts -q '[.[]|select(.state=="open")]|length'`
  returns `0`.
- `find . -name package-lock.json -not -path "*/node_modules/*"` returns exactly one path: `./package-lock.json`.
- `npm ls fast-uri @hono/node-server` shows `fast-uri@3.1.4` or later and `@hono/node-server@2.0.5` or later.
- `npm ls esbuild` reports no `invalid` marker.
- `npm ci && npm run build` succeeds from a clean clone, and the test suite passes.
- `npm pack --dry-run` in `apps/dot-agent-cli` and `packages/language-server` lists no `src/`, `tests/` or
  `tsconfig.json` entries.
- A pull request adding a headerless source file under `packages/` fails CI on the license-header job.
- `grep -rE "github\.com/dot-agent-spec/(language-server|dot-agent-kernel|vscode-dot-agent|tree-sitter|kernel-dsl|dot-agent-tree-sitter)([^a-z0-9._-]|$)" --include="*.md" .`
  returns no matches outside `node_modules/`.

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Progress

- [x] 2026-07-31 — Scanned the repository for pre-flatten fossils; findings recorded below and in the
  Design section.
- [x] 2026-07-31 — Broke the five tracks into eight task dossiers under [`../tasks/`](../tasks/), folding
  the Plan-001 Track 3 content review into Track E as real work rather than deferring it.
- [x] 2026-07-31 — Track A complete
  (`fossil-lockfiles-and-runtime-deps.md`), four commits
  on `chore/plan-003-fossil-cleanup`: five nested lockfiles deleted; `fast-uri` 3.1.3 → 3.1.5;
  `@modelcontextprotocol/sdk` 1.29.0 → 1.30.0 with `@hono/node-server` 1.19.14 → 2.0.12; dead `dsl/*`
  glob dropped. Full build green, 287 tests passing across the three suites. The Dependabot count is
  still 18 and stays there until this merges — Dependabot scans the **default branch**, not a PR branch.
- [x] 2026-07-31 — Track B complete (`npm-publish-allowlists.md`):
  `apps/dot-agent-cli` 48 → 47 files (one removal), `packages/language-server` 24 → 17 files (110KB →
  81KB). Both diffed file-by-file against a recorded `npm pack --dry-run` baseline; nothing added, no
  runtime file lost. Bundled language server verified by LSP `initialize` over stdio.
- [x] 2026-07-31 — Track C complete
  (`esbuild-and-dependabot-config.md`), three commits on
  `chore/esbuild-and-dependabot`: `esbuild` 0.21.5 → 0.28.1 in the four manifests that declare it, with
  the root's `allowScripts` pin re-approved; `brace-expansion` 5.0.7 → 5.0.9 and `postcss` 8.5.16 → 8.5.25
  (`npm audit` → 0); `.github/dependabot.yml` created. `npm ls esbuild` no longer reports `invalid`. Full
  build green, 287 + 16 tests passing, and the rebuilt extension's bundled server driven headlessly to
  real diagnostics.
- [x] 2026-07-31 — Track D complete
  (`license-header-ci-enforcement.md`, closes #19): script
  gained `--check`, moved to `scripts/`, discovery switched to `git ls-files`; first `pull_request`
  workflow added; fossil hook, `prepare` and the package-local script deleted. 18 files of accumulated
  backlog fixed. `core.hooksPath` untouched, graphify `post-commit` still resolves.
- [x] 2026-07-31 — Track E item for `apps/dot-agent-cli/` partially done: its `AGENTS.md` license
  paragraph, `.githooks/` layout row and self-maintenance trigger corrected in the same commit, since
  Track D falsified them. Remaining for that folder: the general content review
  (`agents-md-dot-agent-cli.md` items 3 and 4) — completed the next day, see below.
- [x] 2026-08-01 — Track E complete, all four folders, on `chore/track-e-nested-agents-md`. Roughly 20
  false claims and 22 dead links corrected across `packages/tree-sitter`, `packages/language-server` and
  `apps/vscode-extension`; `apps/dot-agent-cli` audited clean. Each folder then got its one-line
  `CLAUDE.md`, in that order. The four dossiers are closed and deleted.

## Surprises & Discoveries

- Observation: Two thirds of the repository's Dependabot alerts — including both criticals and two of
  three highs — describe software that is not installed, because Dependabot scans nested
  `package-lock.json` files that npm workspaces ignore.
  Evidence: `packages/compiler/package-lock.json` and `apps/dot-agent-cli/package-lock.json` produce 6
  alerts each. They claim `vitest < 3.2.6` (critical) and `vite <= 6.4.2` (high), while
  `npm ls vitest vite` in the workspace reports `vitest@4.1.10` and `vite@8.1.4`, neither in a vulnerable
  range. Both files were last touched in June 2026; the root lockfile in July.

- Observation: License-header enforcement has been silently inert since the flatten, in a repository
  whose `AGENTS.md` documents the header convention as active policy.
  Evidence: `git config --get core.hooksPath` returns `.githooks`, resolved from the worktree root, where
  only a `post-commit` exists — so the tracked `apps/dot-agent-cli/.githooks/pre-commit` is never
  invoked. Even if reached, its body runs `bash scripts/ensure-license-headers.sh` with git's working
  directory set to the repository root, and no such file exists there; the script lives at
  `apps/dot-agent-cli/scripts/`. No CI workflow matches `license-header` or `ensure-license` either.
  Independently diagnosed in issue #19.

- Observation: The npm-workspaces glob `dsl/*` matches nothing and has presumably matched nothing since
  the flatten, without any tool reporting it.
  Evidence: `dsl/` contains only `explanation/`, `reference/`, `tutorials/`, `README.md`, `VERSION` and a
  `.DS_Store`; no subfolder has a `package.json`. npm neither warns nor errors on a workspace glob with
  no matches.

- Observation: `@dot-agent/language-server` publishes its own source and tests to npm.
  Evidence: its `package.json` declares no `files` array, and the package carries no `.npmignore`, so npm
  falls back to publishing everything not excluded by default. Six of the eight publishable packages here
  do declare `files`.

- Observation: Two of the pre-flatten repositories referenced in package documentation are not merely
  archived but deleted, so the links are hard 404s rather than pointers to a read-only mirror. A third
  link fails differently and more deceptively: its *repository* is alive, but the file is gone.
  Evidence: `gh api repos/dot-agent-spec/dot-agent-kernel` and
  `gh api repos/dot-agent-spec/dot-agent-tree-sitter` both return 404, while `language-server`,
  `kernel-dsl`, `tree-sitter` and `vscode-dot-agent` return `"archived": true`. Separately,
  `apps/vscode-extension/AGENTS.md` links to `dot-agent-spec/dot-agent/blob/main/dsl/language.md`;
  `gh api repos/dot-agent-spec/dot-agent` succeeds and reports the repository active, but
  `gh api repos/dot-agent-spec/dot-agent/contents/dsl/language.md` returns 404.

- Observation: No workflow in this repository runs on `pull_request` or on push to `main`. Every one is
  triggered by a publish tag, so build and test failures are only discovered at release time.
  Evidence: all five files in `.github/workflows/` declare `on: push: tags:` — `publish-kernel-dsl.yml`,
  `publish-parser-dsl.yml`, `publish-tree-sitter.yml`, `publish-ts.yml`, `publish-vscode.yml`. Three of
  them run tests, but only as part of publishing. Consequence for this plan: adding a license-header check
  means creating the repository's *first* PR-triggered workflow, not adding a job to an existing one.

- Observation: The script the fossil hook invokes is a **fixer**, not a checker — it rewrites source files
  in place — and its exclusion patterns only work from a package root, not from the monorepo root.
  Evidence: `ensure-license-headers.sh` inserts a header into any matching file lacking one. Its `find`
  excludes `./dist/*` and `./node_modules/*`, which at the monorepo root do not match `packages/*/dist/`
  or `packages/*/node_modules/`. Run as-is from the root it would scan build output and dependencies. It
  also globs `.ts/.tsx/.js/.jsx` while the root `AGENTS.md` states the policy as "Rust and TypeScript
  source files in `packages/`" — the script and the documented policy have never agreed.

- Observation: `apps/dot-agent-cli/AGENTS.md` already documents the hook defect correctly, and carries a
  self-maintenance trigger that this plan is about to fire. Fixing the hook therefore *breaks* a currently
  accurate document.
  Evidence: line 15 lists ``.githooks/`` as "Present but never invoked"; lines 51–54 explain the
  `core.hooksPath` mechanism and tell the reader to run the script manually; line 77 lists "the hook gets
  wired correctly" as a condition for updating the file. All four statements become false when Track D
  lands. This is why `agents-md-dot-agent-cli.md` is sequenced last.

- Observation: Raising the MCP SDK was necessary but **not sufficient** to move `@hono/node-server` off
  the vulnerable line. npm leaves a dependency alone when the installed version still satisfies the range,
  and `1.19.14` satisfies the first branch of `^1.19.9 || ^2.0.5`.
  Evidence: after `npm install @modelcontextprotocol/sdk@1.30.0`, `npm ls @hono/node-server` still
  reported `1.19.14` even though the SDK now permitted `2.x`. An explicit `npm update @hono/node-server`
  then resolved it to `2.0.12`. No `overrides` entry was needed — the plan had flagged that as the
  fallback, and it turned out to be unnecessary.

- Observation: `apps/dot-agent-cli`'s green test suite proves nothing about the HTTP transport it appears
  to cover, because the test mocks the transport outright — so a major-version bump of the library that
  transport actually loads passes CI untouched.
  Evidence: `tests/mcp-http-session.test.ts:25` calls
  `vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', …)`, so the test exercises this repo's
  own session-routing logic and never loads `@hono/node-server`. The real dependency is at
  `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js:9` —
  `import { getRequestListener } from '@hono/node-server'`. Verified separately with a probe driving the
  real path: `getRequestListener` is still exported by 2.x, still bridges Node to Web Standard, and an
  MCP `initialize` over a real socket returned 200 with a valid session id.

- Observation: `npm run build` cannot complete on a machine without a running Docker daemon, and the
  failure surfaces as a broken *test* suite in unrelated packages rather than as an obvious build error.
  Evidence: `packages/tree-sitter`'s `build:wasm` runs `tree-sitter build --wasm`, which invokes `emcc`
  inside Docker; with the daemon down it fails with "failed to connect to the docker API". Because
  `build:wasm` precedes `tsdown`, `packages/tree-sitter/dist/` is never produced — and since `dist/` is
  gitignored build output, four `apps/dot-agent-cli` test files then fail to *load* with
  `Cannot find module @dot-agent/tree-sitter/dist/index.cjs`, showing as `4 failed | 6 passed` with zero
  failing assertions. Starting Docker and rebuilding restored all 287 tests. Worth knowing before
  diagnosing a "test regression" that is really a missing build artifact.

- Observation: `packages/language-server` has no `src/` and no `tsconfig.json` — it ships **JS source as
  its published artifact**, so the Design section above was wrong about what its missing `files` array was
  leaking.
  Evidence: its `build` script is literally `echo 'language-server ships JS source directly, no build step
  needed'`, `main` is `server.js`, and the tarball's runtime is `server.js`, `parser.js`, `merge-graph.js`
  and `features/*.js` at the package root. The only surplus content was `tests/` (7 files). The corrected
  allowlist therefore names the root `.js` files explicitly rather than a `dist/`.

- Observation: `apps/dot-agent-cli` was publishing `scripts/ensure-license-headers.sh` to npm — the same
  script Track D relocates to the repository root.
  Evidence: it appears in the recorded `npm pack --dry-run` baseline. Had the allowlist simply mirrored
  the old denylist's output, Track D would later have left a dangling entry. Dropped deliberately; it is
  the single content change in that package's tarball (48 → 47 files).

- Observation: `git add` aborts the **entire** add when any one pathspec fails to match, so a
  `git rm`-then-`git add` sequence can produce a commit containing only the deletion, silently.
  Evidence: `git add apps/dot-agent-cli/{package.json,.npmignore} packages/language-server/package.json`
  failed with `pathspec '.npmignore' did not match any files` — because `git rm` had already staged it —
  and the commit that followed contained *only* the `.npmignore` deletion; both `files` allowlists were
  left unstaged. Caught by reading `git show --stat` afterwards, fixed with `--amend`. Always verify what
  landed rather than trusting that a commit followed a successful-looking sequence.

- Observation: Merging Tracks A and B took the alert count 18 → **7**, not the predicted 4. The twelve
  phantom alerts closed as expected, but the fresh scan the merge triggered surfaced three the original
  enumeration never contained — and one of them shows the `scope` field can mislead just as the severity
  label does.
  Evidence: three alerts carry `created_at` of `2026-07-31T18:17`, the merge timestamp of PR #30.
  `brace-expansion` (high) and `postcss` (high) are advisories **published 2026-07-24**, a week before
  this work — genuinely new, not caused by it. The third is a fifth `esbuild` alert, against
  `packages/kernel-dsl/package.json`, previously masked by that package's own nested lockfile: deleting
  the fossil revealed a real declaration underneath it. Track C therefore covers **five** manifests, not
  the four the plan first named.

- Observation: Dependabot labelled `brace-expansion` **`scope: runtime`**, but it reaches nobody. The
  plan already argued severity is a poor triage signal; the dependency *scope* is no better here, because
  a single root lockfile flattens away each workspace's dev/prod distinction.
  Evidence: `npm ls brace-expansion` traces it to `vscode-dot-agent → @vscode/vsce → minimatch →
  brace-expansion`, and `@vscode/vsce` is a **devDependency** — it is the VS Code packaging tool.
  `apps/vscode-extension` also packages with `vsce package --no-dependencies`, so nothing from
  `node_modules` reaches the `.vsix` either. `postcss` is comparable but honestly labelled:
  `vitest → vite → postcss`, development.

- Observation: `tools/wasi-stub/` is **third-party code**, so the license-header sweep had to exclude it
  on licensing grounds rather than stylistic ones — a mechanical fixer run over the whole tree would have
  stamped this repository's copyright onto someone else's work.
  Evidence: its `Cargo.toml` declares `authors = ["Arnaud Golfouse <arnaud.golfouse@laposte.net>"]`,
  `repository = "https://github.com/typst-community/wasm-minimal-protocol"` and
  `version = "0.3.0-patched"` — a vendored, locally patched copy. Three `.rs` files there were among the
  22 the first survey flagged. Excluded by name in `scripts/ensure-license-headers.sh`, with the reason
  written next to the exclusion so a later reader does not "fix" it.

- Observation: The license-header convention was **narrower on paper than in practice**, so matching the
  script to the documented policy would have removed enforcement from files that already complied.
  Evidence: the root `AGENTS.md` said "Rust and TypeScript source files in `packages/`", but a survey
  found 90 files carrying the header across `packages/` **and** `apps/` — including 26 in
  `apps/dot-agent-cli` and 19 in `packages/language-server`. The policy was widened to match reality
  rather than the script narrowed to match the policy.

- Observation: Being unenforced since the flatten cost 18 files, not zero — the convention had been
  eroding quietly the whole time.
  Evidence: `./scripts/ensure-license-headers.sh --check` reported 18 first-party files without a header
  once third-party and generated files were excluded, concentrated in test files, `tsdown.config.ts`
  files and build scripts — exactly the files nobody opens during review. Fixing them was +252 lines with
  nothing removed.

- Observation: Track E was scoped as "repoint three or four dead links per folder" and the folders held
  roughly **twenty false claims** on top of twenty-two dead links — including two nested `AGENTS.md`
  sections describing schemes the repository has never used. Link rot is visible from outside a package;
  a false claim is not, and estimating one from the other underestimates by an order of magnitude.
  Evidence: `packages/tree-sitter/AGENTS.md` carried a whole "Dual-Versioning Strategy" naming a
  `1.0.0-draft` spec version and `spec-vX.Y` git tags — `dsl/VERSION` contains `0.1` and `git tag -l`
  matches no such tag. `packages/language-server/AGENTS.md` named a dependency, `@dot-agent/behavior-parser`,
  that has never existed here. The four dossiers each predicted an XS/S link edit and one M review.

- Observation: The two most valuable corrections were **claims that were true when written and quietly
  became load-bearing**, not ordinary rot.
  Evidence: `parse()` was documented as reparsing incrementally, while `parser.js` deliberately does a full
  reparse because incremental corrupts node byte ranges — the doc actively invited someone to "optimize" it
  back. And `server.js contains only LSP wiring` was written as an invariant; it is violated in three
  places, and stating it as fact is what let the drift pass review. It now records the intent plus its
  three exceptions, pointing at issue #4.

- Observation: An audit report is not evidence. One finding from the Track E sweep — that the grammar
  workflow lives in `CONTRIBUTING.md` — was wrong, and acting on it would have added a dead link inside
  the commit that removes twenty-two.
  Evidence: `CONTRIBUTING.md` has no grammar section; its headings are Toolchain setup, Build, Tests,
  Changing a dependency and Licensing. Caught by checking the anchor before writing the link.

- Observation: The root `package.json` carries an **`allowScripts` block that pins by exact version**, so
  every bump of a dependency with an install script silently invalidates its own approval. Nothing in the
  repository documented this, and the only signal is a warning inside `npm install` output.
  Evidence: bumping esbuild left `"esbuild@0.21.5": true` plus a `"esbuild@0.27.7": true` that nothing had
  resolved to since the block was written in `d40b7a9`, while `npm install` warned that 0.28.1's
  `postinstall: node install.js` was unreviewed. `npm approve-scripts esbuild` collapsed all three into
  one current pin. The field is advisory in npm 11.17 — scripts still run — but `npm help approve-scripts`
  states a future release blocks unreviewed ones, and esbuild's postinstall is what places its native
  binary. A stale allowlist is therefore a build break scheduled for whenever npm flips that switch.

- Observation: An alert whose `manifest_path` is `package-lock.json` has **no manifest to edit** — it
  describes a transitive package hoisted into the root lockfile, and it clears when whatever pulls it in
  is bumped. Reading the field as a file to open sends you looking for a declaration that was never there.
  Evidence: the task dossier counted five manifests for esbuild, listing the root among them; the root has
  never declared esbuild. Four packages do (`parser-dsl`, `kernel-dsl`, `sdk`, `vscode-extension`), and
  alert #8 is filed against `package-lock.json` because `vitest → vite → esbuild` hoists there. It cleared
  with the same bump. The same reading explains alerts #24 and #27 (`postcss`, `brace-expansion`).

- Observation: An LSP `initialize` handshake proves the bundle **loads**, not that it works — the
  externalized WASM chain is only exercised once a document is opened. Track B's verification stopped one
  step short of the thing most likely to break.
  Evidence: driving `dist/server.mjs` to `initialize` returns all nine providers even though nothing has
  parsed yet. Sending `textDocument/didOpen` with `languageId: "behavior"` (not the extension's
  `dot-agent-behavior` id — the server filters on the short form) returns `E004` from the tree-sitter
  grammar and `W012` from the compiler linter, which is what proves the copied `parser-dsl`/`web-tree-sitter`
  packages and the `createRequire` banner resolve at runtime. That is the failure mode a bundler bump has,
  and no unit test covers it.

## Decision Log

- Decision: Triage the Dependabot alerts by *reach* — does the dependency ship to a consumer of a
  published package? — and treat the CVSS severity label as an input to scheduling only.
  Rationale: Severity is assigned by the advisory author with no knowledge of this repository. Applied
  here, it inverts the priority order that matters: the two alerts worth acting on urgently are a `high`
  and a `moderate` that reach anyone installing `@dot-agent/cli`, while both `critical` alerts turn out
  to describe uninstalled software.
  Date / Author: 2026-07-31 / Danilo Borges

- Decision: Move license-header enforcement to CI and delete the hook, rather than repairing the hook at
  the repository root.
  Rationale: A working hook still requires each clone to execute a `prepare` script that writes a
  repository-scoped git setting — the exact side effect that produced the original defect. CI needs no
  per-clone setup, cannot alter a contributor's git config, and fails visibly on the pull request. This
  is the first of the two options issue #19 proposes.
  Date / Author: 2026-07-31 / Danilo Borges

- Decision: Leave the existing `core.hooksPath` value alone.
  Rationale: Although a fossil wrote it, the value is now load-bearing for hooks kept at
  `<repo-root>/.githooks/` — in this maintainer's clone it is what runs the graphify `post-commit`.
  Running `git config --unset core.hooksPath` as part of the fix would silently disable those. Deleting
  the `prepare` line stops the setting from being *written* by a workspace install, which is the actual
  defect.
  Date / Author: 2026-07-31 / Danilo Borges

- Decision: Split the work into separate commits per track rather than one housekeeping commit, and
  sequence the esbuild bump last.
  Rationale: The tracks carry very different risk. Deleting an ignored lockfile cannot change a build;
  raising a pre-1.0 esbuild across four manifests can. Separate commits keep a bisect meaningful and let
  the risky change be reverted without losing the rest.
  Date / Author: 2026-07-31 / Danilo Borges

- Decision: Break the five tracks into eight task dossiers, and fold the Plan-001 Track 3 content review
  into Track E as real work — one task per folder — rather than repointing links and deferring the review.
  Rationale: An earlier draft of this plan scoped Track E to link repointing only, and explicitly declined
  to tick the Track 3 checkboxes on the grounds that the review had not happened. That was honest but left
  the four folders in the worst of both states: touched, but not closed, with the next reader unable to
  tell which parts had been checked. Doing the review properly closes them. One task per folder — rather
  than one sweeping task — matches Track 3's own per-folder design, lets each close independently, and
  keeps the checkbox meaningful: a single task across four folders and ~530 lines invites ticking four
  boxes off one skim. It also shrinks this plan, which now holds rationale and the working record while
  the tasks hold the procedure.
  Date / Author: 2026-07-31 / Danilo Borges

- Decision: Enable Dependabot **version** updates, not only security ones, and never add an `ignore` block
  to quiet the resulting major-version pull requests.
  Rationale: The plan's own most expensive finding was not a CVE — esbuild sat seven minors behind until
  vitest's bundled vite required a range the pin no longer satisfied, and no advisory reports that. Version
  updates are the only thing that prevents a repeat, so they are worth their noise once grouped. The
  `ignore` prohibition is the non-obvious half: ignore conditions apply to security updates as well as
  version updates, so the natural way to silence major PRs would also suppress an advisory whose only fix
  is a major bump, silently and exactly when it matters. Recorded as a comment in
  [`.github/dependabot.yml`](../../.github/dependabot.yml) because that is where someone will be tempted.
  Date / Author: 2026-07-31 / Danilo Borges

- Decision: On `@hono/node-server`, stop and report rather than reaching for `overrides` automatically.
  Rationale: The SDK bump is expected to resolve it to the patched `2.0.5`, but `^1.19.9 || ^2.0.5`
  permits npm to stay on `1.x`. Pinning a transitive dependency of a *published* package through
  `overrides` carries its own maintenance cost and is a maintainer call, not an implementation detail to
  be applied silently while clearing an alert.
  Date / Author: 2026-07-31 / Danilo Borges

## Outcomes & Retrospective

### Against the five goals

1. **Fossils gone.** Yes. One root `package-lock.json`, the five nested ones deleted, the dead `dsl/*`
   workspace glob dropped, the `.githooks/` fossil and its `prepare` script removed. `npm pack --dry-run`
   in `apps/dot-agent-cli` lists 47 files with no `src/` or `tests/`.
2. **Alert count to zero.** Yes — `0` open, every one closed by a fix and none by dismissal. The number
   moved 18 → 7 → 0, and the middle figure is the interesting one: see below.
3. **`fast-uri` and `@hono/node-server` patched.** Yes: `fast-uri@3.1.5`, `@hono/node-server@2.0.12`,
   both reached by raising `@modelcontextprotocol/sdk` rather than by an `overrides` pin, which was the
   thing the Decision Log said not to do silently.
4. **License-header enforcement in CI.** Yes, and it is the repository's first `pull_request`-triggered
   workflow. `#19` closed.
5. **Build and tests green at the end of every track.** Yes, and Track C added a check the goal did not
   ask for, because a green suite would not have caught a bad bundler artifact: the extension's bundled
   server is now driven over a real stdio LSP session to actual diagnostics.

### Where the plan was wrong, and in which direction

Two predictions failed, both by underestimating.

**"18 alerts → 4."** Reality was 7. Two advisories published mid-flight, and a fifth `esbuild` manifest
that had been *masked* by the very nested lockfile Track A deleted. Deleting a fossil made a real problem
visible, which is the argument for deleting fossils.

**Track E scoped at "three or four dead links per folder."** It was 22 links and roughly 20 false claims,
including two whole sections describing schemes this repository has never used. The estimate came from
what a link checker can see from outside a package; nothing mechanical sees a false claim. Any future
per-folder review should be scoped from the second number, not the first.

### What is still open

- Plan-001's Track 3 has **five folders left**: `packages/parser-dsl`, `kernel-dsl`, `compiler`,
  `plugins/claude`, and the zero-byte `dogfood/mentor-agent/AGENTS.md`. This plan closed four of nine.
- The `github-actions` Dependabot ecosystem is deliberately unconfigured; the workflows pin action
  versions nothing watches. Named in `.github/dependabot.yml`, not fixed.
- `apps/vscode-extension`'s snippets offer `on complete`, `on failed` and `on fallback`, none of which the
  grammar accepts. **Kept deliberately** — [RFC-0015](../rfcs/0015-cross-agent.md) proposes `on complete`,
  so these are ahead of the grammar rather than behind it.

### Routing

Of 25 `Surprises & Discoveries` entries, three were promoted out of this file and the rest stay here as
the working record — which is the correct outcome for an entry that is evidence rather than instruction.

| Entry | Went to |
|---|---|
| `allowScripts` pins install-script approval by exact version | [CONTRIBUTING.md](../../CONTRIBUTING.md) → *Changing a dependency*, together with the negative result that `--allow-scripts-pending` exits 0 either way |
| An LSP `initialize` proves the bundle loads, not that it works | [`apps/vscode-extension/AGENTS.md`](../../apps/vscode-extension/AGENTS.md) → *Build and release* |
| A `manifest_path` of `package-lock.json` means a hoisted transitive | **Not promoted, deliberately.** True of any npm-workspaces repository, so by the routing table it is not this repository's knowledge |

Three became guards rather than prose, and each was proven to fail before being trusted:
`scripts/ensure-license-headers.sh --check` (Track D), `.github/dependabot.yml` (Track C — verified in
production: it opened one grouped PR for five minor/patch bumps and a separate one for the major, exactly
as configured), and `scripts/verify-license-text.sh` (from the license sweep that ran alongside).

**One promotion was refused on evidence.** The `allowScripts` trap looked like it wanted a CI guard rather
than a paragraph — the promotion test prefers guards. Testing it against a deliberately restored stale pin
showed `npm approve-scripts --allow-scripts-pending` prints the pending package and **still exits 0**. A
check built on it would have passed forever while detecting nothing, so the prose stands in for a guard
that cannot be written cheaply. Prose over a guard is the wrong default; it is right here only because the
guard was tried and found inert.

### Demotion

Nothing new. Track D already performed this plan's one demotion — the root `AGENTS.md` License rules
section shrank when the CI check replaced the prose describing what a correct header looks like, leaving
the file one line shorter than it started. The guards added since (`dependabot.yml`,
`verify-license-text.sh`) make no existing instruction line redundant: neither replaces a sentence anyone
had written.

The root `AGENTS.md` remains **over its 150-line budget at 174**, which this plan did not cause and did
not fix. It is Plan-001's to resolve, and Track E's remaining five folders are where the relocated content
would land.

---

## Open questions — answered at closure

- **Path-scoped rule instead of the `CLAUDE.md`?** No, and the reasoning changed once the review was done.
  The root `AGENTS.md` and Plan-001's Track 3 came from the *same commit*, so they are not in conflict —
  the root file's criterion is about **content**, not mechanism: a guardrail belongs in a `paths:` rule, a
  nested `AGENTS.md` survives for package authoring detail. After the review, what remains in these four
  files is overwhelmingly the second kind, so `CLAUDE.md` is the right delivery. The one candidate for
  promotion to a rule — *"never add LSP feature logic to `extension.js`"* — was left in place because it
  is only meaningful next to the file-responsibilities table it sits beside; extracting it into a rule
  would strand it from its context. Revisit if a second guardrail of that shape appears.
- **Did the license-header check pass on the current tree?** No — there was a backlog of 18 first-party
  files, concentrated in test files, `tsdown.config.ts` and build scripts. Track D chose to fix the
  backlog rather than narrow the check (+252 lines, nothing removed), so the gate was green on `main` from
  its first run. The prediction that a backlog might exist was right; the estimate of "may be large" was
  not — 18 files across a repository this size is small.

## Related

- [Plan-001: Adopt the vibe-ops Governance Baseline](001-adopt-vibe-ops-baseline.md) — Track 3 owns the
  per-package `AGENTS.md` link rot that Track E above partially addresses.
- [Issue #19](https://github.com/dot-agent-spec/platform/issues/19) — the license-header hook fossil,
  diagnosed independently and in more depth than restated here; closed by Track D.
- [Issue #22](https://github.com/dot-agent-spec/platform/issues/22) — tracking issue for Plan-001.
- [DA00-05](../adr/DA00-05-monorepo-flatten.md) — the monorepo flatten decision that created the fossils
  this plan removes.
