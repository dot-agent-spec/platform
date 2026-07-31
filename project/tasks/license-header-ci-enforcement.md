<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Move License-Header Enforcement to CI

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track D · closes [#19](https://github.com/dot-agent-spec/platform/issues/19) |

---

## Context

`apps/dot-agent-cli/` still carries the git-hook setup it had as a standalone repository:
`"prepare": "git config core.hooksPath .githooks"` in its `package.json`, plus a tracked
`apps/dot-agent-cli/.githooks/pre-commit` that runs `bash scripts/ensure-license-headers.sh`.

Issue [#19](https://github.com/dot-agent-spec/platform/issues/19) diagnoses two independent defects and is
the authoritative write-up; the short version is that the hook has never run since the flatten.
`core.hooksPath` is **repository-scoped** and resolves from the worktree root, so the `prepare` script
points the entire monorepo at `<repo-root>/.githooks/` and the tracked hook inside the CLI is never
invoked. Even if it were, git runs hooks with the working directory at the repository root, where
`scripts/ensure-license-headers.sh` does not exist — the script lives at `apps/dot-agent-cli/scripts/`.

Meanwhile the root [`AGENTS.md`](../../AGENTS.md) presents the header convention as active policy. The
convention is documented and unenforced.

Two constraints shape the fix:

**Do not unset `core.hooksPath`.** Issue #19 says this explicitly and it is repeated here because it is
the one irreversible mistake available in this task. A fossil wrote the value, but it is now load-bearing
— contributors keep hooks at `<repo-root>/.githooks/` that depend on it. Deleting the `prepare` line stops
the setting from being *written* by a workspace install, which is the actual defect. Running
`git config --unset core.hooksPath` would silently disable working hooks in existing clones.

**The repository has no pull-request CI.** Every workflow in `.github/workflows/` is triggered by a
publish tag (`on: push: tags:`). Nothing runs on `pull_request` or on push to `main`, so this task
creates the repository's **first** PR-triggered workflow rather than adding a job to an existing one.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Give the script a check mode that does not write | scripts/ | S |
| 2 | P0 | Move the script to the repository root and fix its scan scope | root, apps/dot-agent-cli | S |
| 3 | P0 | Add a `pull_request` workflow running the check | .github/workflows/ | S |
| 4 | P0 | Delete the fossil hook and the `prepare` line | apps/dot-agent-cli | XS |

---

## Work items

### 1. Give the script a check mode — P0

**What:** Add a non-writing mode to `ensure-license-headers.sh` that reports offending files and exits
non-zero, leaving the existing fixer behaviour available for local use.

**Why:** The script as written is a **fixer**, not a checker — it rewrites files in place to insert the
header. A CI job must not rewrite the repository; it must fail and tell the author what to run.

**Change:** Add a `--check` flag. In check mode: collect files missing the header, print each path, exit
`1` if the list is non-empty. Without the flag, keep today's fix-in-place behaviour unchanged so it stays
usable as `./scripts/ensure-license-headers.sh` before committing.

### 2. Move the script to the repository root and fix its scan scope — P0

**What:** Move `apps/dot-agent-cli/scripts/ensure-license-headers.sh` to `scripts/ensure-license-headers.sh`
and correct the paths it excludes.

**Why:** The script's `find` excludes only `./dist/*` and `./node_modules/*`, which were the right patterns
when it ran from a package root. Run from the monorepo root those patterns match nothing useful:
`packages/*/dist/` and `packages/*/node_modules/` are **not** excluded, so the check would scan build
output and dependencies and fail on thousands of third-party files.

**Change:** Move the file, then widen the exclusions to `*/dist/*`, `*/node_modules/*` and `*/.git/*`, and
reconcile what it scans with the policy in [`AGENTS.md`](../../AGENTS.md):

- The policy says **"Rust and TypeScript source files in `packages/` use Apache 2.0 headers"**. The script
  currently matches `.ts`, `.tsx`, `.js`, `.jsx` — it does not cover Rust, and it covers `.js`/`.jsx`
  files the policy does not mention.
- Decide the scanned set deliberately and make the script match the documented policy, rather than
  inheriting whatever the pre-flatten script happened to glob. If the policy is what changes instead,
  update `AGENTS.md` in the same commit so the two cannot drift again.
- Generated files must be excluded explicitly — `packages/*/pkg/` (wasm-bindgen output) and any `bindings/`
  produced by `ts-rs` are written by tooling and cannot carry a hand-added header.

Run the check mode over the current tree **before** wiring it into CI and record how many files fail. A
large number means the convention was already being violated while unenforced, and that backlog has to be
either fixed or explicitly scoped out — do not land a CI gate that fails on `main` from its first run.

### 3. Add a `pull_request` workflow — P0

**What:** Create `.github/workflows/license-headers.yml` running the script's check mode on
`pull_request` and on push to `main`.

**Why:** CI needs no per-clone setup, cannot alter a contributor's git config, and fails visibly on the
pull request. This is the first of the two options issue #19 proposes.

**Change:** A single job: checkout, run `./scripts/ensure-license-headers.sh --check`. No Node.js setup and
no `npm ci` — the script is POSIX shell and needs neither, which keeps the repository's first PR workflow
fast and hard to break.

> **Adjacent gap, deliberately not closed here.** Because no workflow runs on `pull_request` today, build
> and test failures reach `main` unnoticed and surface only at publish time. Adding a build/test PR
> workflow is the obvious companion to this one, but it is a larger change with its own matrix and caching
> decisions, and bundling it here would make a four-line security fix unreviewable. Raise it separately.

### 4. Delete the fossil hook and the `prepare` line — P0

**What:** Delete `apps/dot-agent-cli/.githooks/pre-commit` (and the now-empty `.githooks/` directory), and
remove the `"prepare": "git config core.hooksPath .githooks"` line from
`apps/dot-agent-cli/package.json`.

**Why:** A workspace package writing repository-scoped git config is a side effect nobody installing a
single workspace expects, and the hook it installs has never worked.

**Change:** Delete both. **Do not touch the value of `core.hooksPath`** — see Context. Note in the PR
description that existing clones keep whatever value they already have, which is intended.

---

## Implementation order

```
P0:  1 (check mode) → 2 (move + scope) → run check over current tree, triage the failures
                    → 3 (workflow) → 4 (delete fossil)
```

Item 4 is last on purpose: deleting the hook before the CI gate exists would leave a window with no
enforcement at all — though in practice that window has been open since the flatten.

## Acceptance

- `./scripts/ensure-license-headers.sh --check` exits `0` on the current tree, or its failures are
  triaged and fixed in the same pull request.
- A pull request adding a headerless source file under `packages/` **fails** the new job; the same PR with
  the header added **passes**. Verify both directions — a check that never fails is indistinguishable from
  no check, which is the exact defect being fixed.
- `apps/dot-agent-cli/.githooks/` and the `prepare` line are gone.
- `git config --get core.hooksPath` returns the same value it did before the change.
- Issue [#19](https://github.com/dot-agent-spec/platform/issues/19) closes with the pull request.
