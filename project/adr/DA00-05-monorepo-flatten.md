<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DA00-05: Monorepo flatten — absorb all packages into the root repo

| Field | Value |
|---|---|
| Status | Done |
| Date | 2026-06-26 |
| Concluded | 2026-06-26 |
| Deciders | Danilo Borges |

---

## Context

`dot-agent-spec` declares both an npm workspace and a Cargo workspace, yet every package and app has its own `.git` with an independent GitHub remote. This creates concrete friction:

**Workspace links do not work.** `apps/vscode-extension` references internal packages via `file:/tmp/*.tgz` (manually generated tarballs) because npm workspace links do not cross nested git repository boundaries. Every change to `compiler`, `language-server`, or `parser-dsl` requires a manual rebuild and tarball generation before any local test in the extension.

**Cross-package refactors are expensive.** A change spanning `parser-dsl`, `compiler`, and `kernel-dsl` produces three commits across three repos with no atomicity guarantee.

**Fragmented history.** `git log`, `git bisect`, and cross-package causality tracking are impossible from a single vantage point.

Repos with a nested `.git` today:
`packages/tree-sitter`, `packages/parser-dsl`, `packages/kernel-dsl`, `packages/compiler`, `packages/language-server`, `packages/sdk`, `apps/dot-agent-cli`, `apps/vscode-extension`, `org-spec`.

`org-spec` maps to `dot-agent-spec/.github` — the GitHub organization repo that serves the public org profile (`CODE_OF_CONDUCT`, `CONTRIBUTING`, `SECURITY`, `profile/README.md`). GitHub requires it to be a separate repository with exactly that name; it cannot be absorbed.

## Decision

We will remove the nested `.git` from every package and app, making `dot-agent-spec` a genuine git monorepo. `org-spec` will be removed from the local working tree and added to `.gitignore`. The individual GitHub repos will be archived after the flatten.

## Options considered

- **Keep status quo (independent repos)** — the tarball hack in `vscode-extension` grows with every new interface change. Cross-package refactors require manual coordination across repos. Does not scale to v0.2 and beyond.

- **Convert to git submodules** — improves traceability but does not fix the workspace link. `vscode-extension` would still depend on tarballs or a manual link script. Submodules add clone/pull friction for contributors.

- **True monorepo (chosen)** — fixes workspace links (npm and Cargo are already configured with `"*"` and `{ path = "../..." }`), eliminates the tarball hack, enables atomic cross-package commits, and simplifies CI. History was preserved via `git filter-repo --to-subdirectory-filter` + `git merge --allow-unrelated-histories` for all 8 packages — `git log`, `git blame`, and `git bisect` work per-path within the monorepo.

## Consequences

- **Gain:** `npm install` at the root resolves `@dot-agent/*` via workspace symlinks across all packages, including `vscode-extension`. The tarball hack is gone.
- **Gain:** Cross-package commits are atomic; `git log` covers the full stack.
- **Gain:** Per-path history is preserved (`git log packages/parser-dsl/` shows 12 historical commits; `git log apps/vscode-extension/` shows 15).
- **Gain:** CI runs from a single repo with unified publish workflows in `.github/workflows/`.
- **Loss:** Open PRs/issues in individual repos stay in the archived repos and do not migrate automatically.
- **New constraint:** `org-spec` is managed exclusively on GitHub with no local tracked copy. Changes to `CODE_OF_CONDUCT`, `CONTRIBUTING`, etc. must be made directly on the `dot-agent-spec/.github` remote.

## Outcome

Implemented 2026-06-26. Monorepo is at `https://github.com/dot-agent-spec/platform` (branch `dsl`).

- 8 packages absorbed with full history via `git filter-repo` + merge
- 225 tests passing across all workspaces post-flatten
- 2 bugs found and fixed during integration: `kernel-dsl/scripts/build-wasm.sh` WORKSPACE_ROOT path; `apps/dot-agent-cli` init scaffold W011 self-transition
- All `package.json` metadata standardized (OIDC publish, `dot-agent.ai` homepage, monorepo `repository.directory`)
- 8 individual GitHub repos archived with redirect notices
- 5 CI publish workflows created, triggered by tags (`compiler@x.y.z`, etc.), npm auth via OIDC trusted publishing

## Related

- [DA00-01: Traceability scheme](DA00-01-traceability-scheme.md)
