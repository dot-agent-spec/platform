<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Convert npm Publishing to Allowlists

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track B |

---

## Context

Six of the eight publishable packages control their npm tarball with a `files` **allowlist** in
`package.json`: nothing ships unless it is named. Two do not, and both are pre-flatten leftovers from when
each package was its own repository:

- `apps/dot-agent-cli/` carries an `.npmignore` **denylist** — the inverse policy. It lists `src/`,
  `tests/`, `.githooks/`, `.github/`, `node_modules/`, `*.config.ts`, `tsconfig.json`, `vitest.config.ts`,
  `file structure.md`, `plan.md`, `.git` and `.gitignore`. Three of those paths (`file structure.md`,
  `plan.md`, `.github/`) no longer exist.
- `packages/language-server/` has **neither** a `files` array nor an `.npmignore`, so npm falls back to
  publishing everything not excluded by default — including `src/`, `tests/` and `tsconfig.json`.

A denylist publishes anything a future author forgets to add to it. The failure is silent and only visible
after the version is public and immutable.

`apps/vscode-extension/` is deliberately excluded from this task: a VS Code extension is packaged by
`vsce` through `.vscodeignore`, which it has and which is the correct mechanism. Do not add a `files`
array there.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Replace `.npmignore` with a `files` allowlist | apps/dot-agent-cli | S |
| 2 | P0 | Add a `files` allowlist | packages/language-server | S |

---

## Work items

### 1. Replace the CLI's `.npmignore` with a `files` allowlist — P0

**What:** Delete `apps/dot-agent-cli/.npmignore` and add a `files` array to
`apps/dot-agent-cli/package.json`.

**Why:** Aligns the CLI with the six packages that already use allowlists, and removes three dead path
entries. More importantly it inverts the default: today a new top-level folder ships unless someone
remembers to exclude it.

**Change:** Derive the allowlist from what the current tarball actually contains rather than from
assumption — the CLI ships more than a `dist/` (it has `helper-src/` and `templates/`, which are runtime
data, not build output). The procedure:

1. `cd apps/dot-agent-cli && npm pack --dry-run` and record the full file list **before** any change.
2. Write a `files` array covering every entry from that list that belongs in the package.
3. Re-run `npm pack --dry-run` and diff against the recorded list.

The diff must show **only** removals, and only of `src/`, `tests/`, `tsconfig.json`, `*.config.ts` and
`vitest.config.ts`. Any removal outside that set means the allowlist is too narrow — a missing runtime
file breaks the published CLI at first run, and that is exactly the failure mode this task exists to
prevent.

> Note: `LICENSE`, `README.md` and `package.json` are always included by npm regardless of `files`, so
> they need no entry.

### 2. Add a `files` allowlist to the language server — P0

**What:** Add a `files` array to `packages/language-server/package.json`.

**Why:** The package currently publishes its own source, tests and `tsconfig.json` to npm. Beyond the
tarball bloat, shipping `src/` alongside `dist/` invites a consumer or a bundler to resolve the wrong one.

**Change:** Same procedure as item 1 — record `npm pack --dry-run` first, write the allowlist, diff. The
language server is bundled into `apps/vscode-extension`, so after the change rebuild the extension and
confirm the bundled server still starts. Per
[`.agents/rules/doc-sync.md`](../../.agents/rules/doc-sync.md), a change to a `packages/` boundary obliges
the matching doc update — check whether the package README documents its published contents.

---

## Implementation order

```
P0:  1 and 2 are independent and may land together in one commit.
```

Both change what is published to npm, so neither is verified by the test suite — the acceptance below is
the verification.

## Acceptance

- `npm pack --dry-run` in `apps/dot-agent-cli` and `packages/language-server` lists no `src/`, `tests/`,
  `tsconfig.json` or `*.config.ts` entry.
- The same command lists every runtime file the pre-change tarball contained — verified by diff against
  the recorded baseline, not by inspection.
- `apps/dot-agent-cli/.npmignore` no longer exists.
- `apps/vscode-extension/.vscodeignore` is untouched and the extension still bundles a working language
  server.
