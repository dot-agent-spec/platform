<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Release and Freeze tree-sitter & parser-dsl — DA01-01

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-25 |
| Author | Danilo Borges |
| Sources | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |
| Depends on | `DA01-01-grammar-unfreeze.md` |

---

## Context

This task coordinates the minor version update (`0.+1`), publishing, and re-freezing for the `packages/tree-sitter` and `packages/parser-dsl` packages. These two packages were unfrozen for grammar relaxations and AST mapper changes as part of `DA01-01`. 

Because other tasks must be completed before the final `0.10.0` release alignment (under two-axis versioning [DA00-02](../adr/DA00-02-two-axis-versioning.md)), this unfreeze window will only bump these two core packages:
- `packages/tree-sitter`: `0.4.1` -> `0.5.0`
- `packages/parser-dsl`: `0.1.0` -> `0.2.0`

## Pre-Release Checklist (Manual Housekeeping)

Before executing the automated release script, ensure the following repository governance tasks are complete:

- [ ] **Documentation & Examples:** Verify that `docs/` and `dsl/` are updated. Re-validate canonical `examples/` against the new keyword-driven `tree-sitter-behavior` parser.
- [ ] **RFC/DA & ADR Status:** Update `DA01-01` to `Implemented` status. Check the Design Log to determine if a permanent Architecture Decision Record (ADR) needs to be extracted (e.g., for the new semantic whitespace rule).
- [ ] **Task Cleanup:** Delete completed implementation tasks (`DA01-01-grammar-unfreeze.md`, etc.) from `project/tasks/` and commit the deletions. *This release file should be the only DA01-01 task file remaining.*
- [ ] **Workspace & Submodules:** Ensure `git status` is clean, all submodule changes for `tree-sitter` and `parser-dsl` are committed within their repos, and the superproject points to their correct hashes. Synchronize all `Cargo.lock` and `package-lock.json` files.

---

## Release Execution (Automated)

The version bumping (Cargo & NPM), test validation, release builds, publish actions, task file deletion, and git tagging are orchestrated by the interactive script.

**Steps:**

1. From the repository root, run the script:
   ```bash
   node scripts/release.mjs
   ```
2. During the interactive prompts, supply the following:
   - **Packages:** `tree-sitter, parser-dsl`
   - **New version:** As per the context, tree-sitter will be `0.5.0` and parser-dsl will be `0.2.0` (you may need to run the script twice or adjust the script to accept differing versions, or bump them individually). 
   - **Task Markdown:** `project/tasks/DA01-01-update-version-and-packages.md` (so the script deletes it before the final commit).
3. **Manual Follow-up:** Open [implementation-status.md](../../docs/explanation/architecture/implementation-status.md) and update the `Package freeze status` table to mark `tree-sitter` and `parser-dsl` as `🧊 Frozen` with their updated versions (`0.5.0` and `0.2.0` respectively).
