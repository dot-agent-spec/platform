<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Review `packages/language-server/AGENTS.md` and Deliver It

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track E · closes the `packages/language-server/` item of [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 |

---

## Context

`packages/language-server/AGENTS.md` is 175 lines with **no sibling `CLAUDE.md`**, so Claude Code never
loads it. It carries one dead repository link that is also **mislabelled**, and the package `README.md`
carries a second dead link.

[Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 prescribes a three-step sequence per folder
and states that **the order is load-bearing**: review the content, *then* repoint the dead links, *then*
add the one-line `CLAUDE.md`. Adding the `CLAUDE.md` first would start delivering unreviewed guidance into
agent context. Do not reorder these items.

This package has a known open issue that the review should not silently absorb:
[#4](https://github.com/dot-agent-spec/platform/issues/4) — merge-graph resolution scattered across three
call sites, no multi-root workspace support. If `AGENTS.md` describes that area, it should describe it as
it *is*, and the issue stays open regardless.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Review the 175 lines against the current package | packages/language-server | M |
| 2 | P0 | Fix the mislabelled dead link in `AGENTS.md` | packages/language-server | XS |
| 3 | P0 | Repoint the dead link in `README.md` (absolute URL) | packages/language-server | XS |
| 4 | P0 | Add the one-line `CLAUDE.md` | packages/language-server | XS |

---

## Work items

### 1. Review the content against the package as it exists — P0

**What:** Read `packages/language-server/AGENTS.md` end to end and verify each factual claim against the
current source.

**Why:** The file predates the flatten, so anything it says about layout, build commands or sibling
packages was written when this package was a standalone repository. Per the root
[`AGENTS.md`](../../AGENTS.md), a rotted instruction file is worse than a missing one because it reads as
authority.

**Change:** Confirm or correct each claim. Specifically check:

- Build, test and launch commands, from the monorepo root and from the package directory.
- How the server is consumed: it is **bundled into `apps/vscode-extension`** rather than installed from
  npm by it, which is a detail an agent will get wrong by default.
- Any path referencing a sibling package — external before the flatten, relative now.
- Redundancy against the root `AGENTS.md` and
  [`.agents/rules/doc-sync.md`](../../.agents/rules/doc-sync.md); content with a canonical home elsewhere
  should link rather than restate.

Delete redundancy rather than reformatting it. The target is a shorter, true file.

### 2. Fix the mislabelled dead link in `AGENTS.md` — P0

**What:** Around line 175, the reference table renders:

```
| WASM execution engine | [dot-agent-kernel](https://github.com/dot-agent-spec/kernel-dsl) |
```

Replace it with a relative path to `../kernel-dsl/` and correct the link **text** to `kernel-dsl`.

**Why:** Two defects in one row. The target repository is archived, and the visible label names
`dot-agent-kernel` — a repository that no longer exists at all (it 404s). A reader who trusts the label
searches for the wrong thing; a reader who follows the link lands on a read-only mirror.

**Change:** Use a relative path — `AGENTS.md` is read from a working tree, where a relative path resolves
and survives a repository rename.

### 3. Repoint the dead link in `README.md` — P0

**What:** `packages/language-server/README.md` line 39 links `@dot-agent/tree-sitter` to
`https://github.com/dot-agent-spec/tree-sitter`, an archived repository.

**Why:** The grammar now lives at `packages/tree-sitter/` in this repository.

**Change:** Unlike `AGENTS.md`, this file is a **README** — it is rendered on npmjs.com, where a relative
repository path does not resolve. Use an **absolute URL into the monorepo**
(`https://github.com/dot-agent-spec/platform/tree/main/packages/tree-sitter`), or link the npm package
page. This is the one place in this task where the relative-path rule is inverted; applying the
`AGENTS.md` rule here would produce a link that is broken for every reader on npm.

### 4. Add the one-line `CLAUDE.md` — P0

**What:** Create `packages/language-server/CLAUDE.md` containing exactly `@AGENTS.md`.

**Why:** Claude Code loads `CLAUDE.md`, not a nested `AGENTS.md`. Without it the reviewed guidance never
reaches an agent working in this folder.

**Change:** One line. Do this **only after items 1–3 are complete** — this is the step that starts
delivering the file into context.

> Before writing it, check whether this content belongs in a **path-scoped rule** instead. The root
> `AGENTS.md` reserves the nested `AGENTS.md` + `CLAUDE.md` pair for authoring detail looked up on
> purpose, and routes anything that must fire *when work touches a folder* into a `paths:`-scoped rule
> under `.agents/rules/`.

---

## Implementation order

```
P0:  1 (review) → 2 (AGENTS.md link) → 3 (README link) → 4 (CLAUDE.md)
```

Items 2 and 3 are independent of each other but both precede item 4. Strictly sequential otherwise.

## Acceptance

- No link in `packages/language-server/AGENTS.md` or `README.md` targets
  `github.com/dot-agent-spec/<anything but platform>`.
- The WASM-engine row's link text and target agree, and both name `kernel-dsl`.
- `README.md` uses an absolute URL; `AGENTS.md` uses relative paths.
- `packages/language-server/CLAUDE.md` exists and is one line.
- The `packages/language-server/` checkbox in [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3
  is ticked — only once item 1 is genuinely done, since the box asserts a review happened.
