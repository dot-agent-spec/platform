---
vibe-ops-template: plan@3
---

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
  gap — every workflow here is triggered by a publish tag, so build and test failures surface only at
  release time — and closing it involves matrix and caching decisions that would make a small security fix
  unreviewable, so it is raised separately.
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

- [x] **Track A — Fossils and runtime security.** 2026-07-31. Five nested lockfiles deleted, the dead
      `dsl/*` glob dropped, `fast-uri` and `@modelcontextprotocol/sdk` raised. The alert count stayed at
      18 until the merge, because Dependabot scans the default branch and not a PR branch.
- [x] **Track B — Packaging.** 2026-07-31. Both packages moved to a `files` allowlist, each diffed
      file-by-file against a recorded `npm pack --dry-run` baseline: nothing added, no runtime file lost.
- [x] **Track C — esbuild and Dependabot config.** 2026-07-31. Raised across the four manifests that
      declare it, the root's `allowScripts` pin re-approved, and `.github/dependabot.yml` created — the
      repository had never had one.
- [x] **Track D — License enforcement in CI.** 2026-07-31, closes #19. The script gained `--check` and
      moved to the repository root, discovery switched to `git ls-files`, the first `pull_request`
      workflow was added and the fossil hook deleted. 18 files of accumulated backlog fixed.
- [x] **Track E — Per-folder `AGENTS.md`.** 2026-08-01, all four folders. Roughly 20 false claims and 22
      dead links corrected; `apps/dot-agent-cli` audited clean. Closed Plan-001's Track 3 for these four.
- [x] Run `/vibe-ops:close-plan` — the retrospective, the demotion check and the routing were performed
      on 2026-08-14 while migrating this plan to `plan@3`. The file is kept, as plans are.

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

Of 25 `Surprises & Discoveries` entries, three were promoted out of this file at closure and the rest
stayed as the working record — which is the correct outcome for an entry that is evidence rather than
instruction.

**A second pass on 2026-08-14 collected exactly what the first one had nowhere to put**, and the section
itself is now gone: migrating this plan to `plan@3` drops `Surprises & Discoveries`, and the jump's own
rule is that a section is deleted only once every entry has a destination. Four entries were promoted to
the workspace's cross-repository learnings base — Dependabot's three misreadings of a workspaces repo, the
`allowScripts` exact-version expiry, `git add` aborting on one failed pathspec, and the two cases where
npm silently declines to act. The `manifest_path` row below predicted this: it was declined here for being
true of any npm-workspaces repository, which is precisely the category that belongs one level up. The rest
were dropped out loud — measurements, one-off repo state, or facts a surface here already carries.

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
