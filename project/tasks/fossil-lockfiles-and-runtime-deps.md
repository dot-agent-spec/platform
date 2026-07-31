<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Remove Fossil Lockfiles and Patch Runtime Dependencies

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track A |

---

## Context

npm workspaces resolve every dependency through the single `package-lock.json` at the repository root;
nested lockfiles inside workspace packages are ignored by both `npm install` and `npm ci`. Five nested
lockfiles survived the monorepo flatten ([DA00-05](../adr/DA00-05-monorepo-flatten.md)) and are still
tracked in git.

GitHub Dependabot does not model npm workspaces — it scans every lockfile it finds. Two of the five
(`packages/compiler/` and `apps/dot-agent-cli/`) contain vulnerable entries and together generate **12 of
the repository's 18 open alerts**, including both criticals and two of three highs. Those alerts describe
software that is not installed: the lockfiles claim `vitest < 3.2.6` and `vite <= 6.4.2`, while
`npm ls vitest vite` reports `vitest@4.1.10` and `vite@8.1.4`.

The 2 alerts that genuinely reach third parties are handled here too. Both arrive transitively via
`@modelcontextprotocol/sdk@1.29.0`, a **production** dependency of `@dot-agent/cli`, so every
`npm install @dot-agent/cli` installs them.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Delete the five nested `package-lock.json` files | compiler, cli, tree-sitter, kernel-dsl, language-server | XS |
| 2 | P0 | Patch `fast-uri` to 3.1.4 | root lockfile (transitive) | XS |
| 3 | P0 | Raise `@modelcontextprotocol/sdk` to 1.30.0 to unblock `@hono/node-server` | apps/dot-agent-cli | S |
| 4 | P1 | Drop the dead `dsl/*` workspace glob | root `package.json` | XS |

---

## Work items

### 1. Delete the five nested lockfiles — P0

**What:** `git rm` these files:

```
packages/compiler/package-lock.json        packages/kernel-dsl/package-lock.json
apps/dot-agent-cli/package-lock.json       packages/language-server/package-lock.json
packages/tree-sitter/package-lock.json
```

**Why:** They generate 12 false security alerts, and they answer version questions incorrectly — anyone
reading `packages/compiler/package-lock.json` to learn which vitest this repo uses gets an answer that has
been wrong since the flatten. All five were last modified in June 2026; the root lockfile in July.

**Change:** Delete only. Do not regenerate them and do not add them to `.gitignore` — a workspace package
must not carry a lockfile at all. Confirmed unused by CI: every `npm ci` in `.github/workflows/` runs at
the repository root, and the `working-directory:` entries in those workflows apply to build steps only.

### 2. Patch `fast-uri` to 3.1.4 — P0

**What:** Move `fast-uri` from `3.1.3` to `3.1.4` in the root `package-lock.json`.

**Why:** CVE-2026-16221 (high) — host confusion via a literal backslash authority delimiter. It reaches
consumers of the published `@dot-agent/cli` through `@modelcontextprotocol/sdk` → `ajv@8.20.0` →
`fast-uri`.

**Change:** `npm update fast-uri` at the root. `ajv` requires the `3.x` line, so do **not** jump to
`fast-uri@4.x` — the patched `3.1.4` is the correct target. Verify with `npm ls fast-uri`.

### 3. Raise `@modelcontextprotocol/sdk` to 1.30.0 — P0

**What:** Bump the dependency in `apps/dot-agent-cli/package.json` from `1.29.0` to `1.30.0`.

**Why:** `@hono/node-server@1.19.14` has a path-traversal advisory (moderate) whose first patched version
is `2.0.5` — a major-version jump. SDK `1.29.0` pins the `1.x` line, which has no patched release, so the
alert cannot be cleared without moving the SDK. SDK `1.30.0` widens the constraint to
`"@hono/node-server": "^1.19.9 || ^2.0.5"`, allowing the patched `2.0.5` to resolve.

**Change:** Bump, reinstall, then verify with `npm ls @hono/node-server`.

> **Stop and report if it resolves to `1.x`.** The `^1.19.9 || ^2.0.5` constraint *permits* npm to stay on
> the `1.x` line. If it does, the remaining lever is an `overrides` entry in the root `package.json` —
> but do not apply it unilaterally; surface the result and let the maintainer decide, since an `overrides`
> pin on a transitive dependency of a published package is a decision with its own maintenance cost.

Also confirm the SDK bump does not change the CLI's MCP behaviour: run the CLI's own test suite, which
covers HTTP session routing (`apps/dot-agent-cli/tests/server-mcp.test.ts`).

### 4. Drop the dead `dsl/*` workspace glob — P1

**What:** Remove `"dsl/*"` from the `workspaces` array in the root `package.json`, leaving
`["packages/*", "apps/dot-agent-cli", "apps/vscode-extension"]`.

**Why:** `dsl/` holds the language specification as documentation — `explanation/`, `reference/`,
`tutorials/`, `README.md`, `VERSION` — and no subfolder has a `package.json`. The glob matches nothing.
npm neither warns nor errors on an unmatched workspace glob, so it fails silently while misdescribing the
repository to every tool and reader that parses the manifest.

**Change:** Edit the array. `npm ci` must still succeed and resolve the same package set afterwards —
compare `npm ls --workspaces --depth 0` before and after.

---

## Implementation order

```
P0:  1 (delete lockfiles) → 2 (fast-uri) → 3 (MCP SDK; STOP if hono stays on 1.x)
P1:  4 (dsl/* glob)
```

Items 1 and 4 cannot affect the installed tree and are safe to land together. Item 3 is the only one that
changes a published package's dependency graph, so it gets its own verification pass.

## Acceptance

- `find . -name package-lock.json -not -path "*/node_modules/*"` returns exactly `./package-lock.json`.
- `npm ls fast-uri` shows `3.1.4` or later; `npm ls @hono/node-server` shows `2.0.5` or later, **or** the
  result is reported to the maintainer per item 3.
- Dependabot open-alert count drops from 18 to 4:
  `gh api repos/dot-agent-spec/platform/dependabot/alerts -q '[.[]|select(.state=="open")]|length'`
- `npm ci && npm run build` succeeds from a clean clone; the full test suite passes.
