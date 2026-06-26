<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Monorepo flatten

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-26 |
| Author | Danilo Borges |
| Decision | [DA00-05: Monorepo flatten](../adr/DA00-05-monorepo-flatten.md) |

Flatten `dot-agent-spec` into a genuine git monorepo by removing nested `.git` directories from all packages and apps, fixing the `vscode-extension` tarball hack, and archiving the individual GitHub repos.

---

## Priority overview

| # | Phase | Item | Effort |
|---|---|---|---|
| 0 | P0 | Audit — verify no unpushed commits in sub-repos | XS |
| 1 | P0 | Decouple org-spec | XS |
| 2 | P0 | Absorb packages/tree-sitter | XS |
| 3 | P0 | Absorb packages/parser-dsl | XS |
| 4 | P0 | Absorb packages/kernel-dsl | XS |
| 5 | P0 | Absorb packages/compiler | XS |
| 6 | P0 | Absorb packages/language-server | XS |
| 7 | P0 | Absorb packages/sdk | XS |
| 8 | P0 | Absorb apps/dot-agent-cli | XS |
| 9 | P0 | Absorb apps/vscode-extension | XS |
| 10 | P0 | Fix vscode-extension deps (tarballs → workspace links) | S |
| 11 | P0 | Verify build (npm + cargo) | S |
| 12 | P1 | Archive 8 individual GitHub repos | S |
| 13 | P1 | Update CI and publish pipelines | M |

---

## Work items

### Phase 0 — Audit (prerequisite for everything)

- [x] Check for unpushed commits in each sub-repo: `git log --oneline origin/HEAD..HEAD` in each folder
- [x] Confirm remote and state of the root repo: `git remote -v` + `git status` at `dot-agent-spec` root

### Phase 1 — Decouple org-spec

- [x] Remove `org-spec/` from the local working tree
- [x] Add `org-spec/` to the root `.gitignore`

### Phase 2 — Absorb packages (dependencies before dependents)

- [x] `packages/tree-sitter` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `packages/parser-dsl` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `packages/kernel-dsl` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `packages/compiler` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `packages/language-server` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `packages/sdk` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `apps/dot-agent-cli` — absorbed via `git filter-repo` + merge (history preserved)
- [x] `apps/vscode-extension` — absorbed via `git filter-repo` + merge (history preserved)

### Phase 3 — Fix the build

- [ ] Update `apps/vscode-extension/package.json`: replace all `file:/tmp/*.tgz` deps with `"*"`
- [ ] `npm install` at root — verify workspace symlinks under `node_modules/@dot-agent/`
- [ ] `cargo build --workspace` — verify all crates compile
- [ ] `npm run test --workspaces` — verify all tests pass

### Phase 4 — Archive individual GitHub repos

- [x] Add a redirect notice to each repo's README before archiving (point to the monorepo)
- [x] Archive `dot-agent-spec/compiler`
- [x] Archive `dot-agent-spec/kernel-dsl`
- [x] Archive `dot-agent-spec/language-server`
- [x] Archive `dot-agent-spec/parser-dsl`
- [x] Archive `dot-agent-spec/sdk`
- [x] Archive `dot-agent-spec/tree-sitter`
- [x] Archive `dot-agent-spec/dot-agent-cli`
- [x] Archive `dot-agent-spec/vscode-dot-agent`

### Phase 5 — CI and publish (post-flatten)

- [ ] Update npm publish pipelines to run from the monorepo root
- [ ] Update cargo publish pipelines to run from the monorepo root
- [ ] Update the root `README.md` to reflect the single-repo structure

---

## Implementation order

```
Phase 0  — audit (blocks everything)
Phase 1  — org-spec (no dependencies)
Phase 2  — absorb in dependency order: tree-sitter → parser-dsl → kernel-dsl
           → compiler → language-server → sdk → dot-agent-cli → vscode-extension
Phase 3  — fix build (gates Phase 4)
Phase 4  — archive repos (can be done in parallel per repo)
Phase 5  — CI/publish (after all of the above)
```
