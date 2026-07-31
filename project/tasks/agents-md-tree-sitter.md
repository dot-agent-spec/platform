# Task: Review `packages/tree-sitter/AGENTS.md` and Deliver It

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track E · closes the `packages/tree-sitter/` item of [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 |

---

## Context

`packages/tree-sitter/AGENTS.md` is 178 lines and has **no sibling `CLAUDE.md`**, so Claude Code never
loads it — the guidance sits inert on disk. It also carries three links to repositories that the monorepo
flatten ([DA00-05](../adr/DA00-05-monorepo-flatten.md)) left behind.

[Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 prescribes a three-step sequence per folder
and states that **the order is load-bearing**: review the content, *then* repoint the dead links, *then*
add the one-line `CLAUDE.md`. Adding the `CLAUDE.md` first would start delivering unreviewed and partly
wrong guidance into agent context, where a wrong instruction that loads is worse than one that does not.
Do not reorder these items.

This package is the canonical grammar source — the `.wgsl`-style caveat does not apply, but note that
`packages/tree-sitter/` owns two grammars (`tree-sitter-description/` and `tree-sitter-behavior/`), so
guidance that says "the grammar" without saying which is ambiguous.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Review the 178 lines against the current package | packages/tree-sitter | M |
| 2 | P0 | Repoint three dead repository links | packages/tree-sitter | XS |
| 3 | P0 | Add the one-line `CLAUDE.md` | packages/tree-sitter | XS |

---

## Work items

### 1. Review the content against the package as it exists — P0

**What:** Read `packages/tree-sitter/AGENTS.md` end to end and verify each factual claim against the
current source.

**Why:** The file predates the flatten. Anything it asserts about layout, build commands, or sibling
packages was written when this package was its own repository. A stale instruction file reads as
authority — the root `AGENTS.md` makes this point directly: *"a fact hardcoded in an instruction file rots
silently, and a rotted file is worse than a missing one."*

**Change:** For each claim, confirm or correct it. Specifically check:

- Build and test commands — do they still work from the monorepo root and from the package directory?
- Any path referencing a sibling package; pre-flatten these were external, now they are relative.
- Whether it describes both grammars accurately, or silently assumes one.
- Whether anything it says is already said by the root `AGENTS.md` or by
  [`.agents/rules/doc-sync.md`](../../.agents/rules/doc-sync.md). Content with a canonical home elsewhere
  should link, not restate — the root file already carries the repo-wide conventions.

Delete what is redundant rather than reformatting it. The target is a shorter, true file.

### 2. Repoint three dead repository links — P0

**What:** In the reference table at the end of the file (around lines 175–177), replace three links:

| Current link text | Current target | State | Repoint to |
|---|---|---|---|
| `vscode-dot-agent` | `github.com/dot-agent-spec/vscode-dot-agent` | archived | `../../apps/vscode-extension/` |
| `language-server` | `github.com/dot-agent-spec/language-server` | archived | `../language-server/` |
| `dot-agent-kernel` | `github.com/dot-agent-spec/dot-agent-kernel` | **404 — deleted** | `../kernel-dsl/` |

**Why:** One target is deleted outright and returns 404; the other two are archived read-only mirrors of
code that now lives in this repository. Every target is a sibling folder here.

**Change:** Use **relative paths**, not full URLs. `AGENTS.md` is read from a working tree, so a relative
path resolves for the reader and survives the repository being renamed or moved. (The opposite rule
applies to `README.md`, which is rendered on npm where relative repo paths do not resolve — but this
package's README is not in scope for this item.)

Note the third row's link text is also wrong: the WASM execution engine is `kernel-dsl`, and calling it
`dot-agent-kernel` preserves a name that no longer exists anywhere.

### 3. Add the one-line `CLAUDE.md` — P0

**What:** Create `packages/tree-sitter/CLAUDE.md` containing exactly `@AGENTS.md`.

**Why:** Claude Code loads `CLAUDE.md`, not a nested `AGENTS.md`. Without it, none of the reviewed
guidance reaches an agent working in this folder.

**Change:** One line, matching the root `CLAUDE.md` convention. Do this **only after items 1 and 2 are
complete** — this is the step that starts delivering the file into context.

> Before writing it, check whether this content should be a **path-scoped rule** instead. The root
> `AGENTS.md` notes that anything which must fire *when work touches a folder* belongs in a
> `paths:`-scoped rule under `.agents/rules/`, while a nested `AGENTS.md` + `CLAUDE.md` pair suits
> authoring detail a reader looks up on purpose. If this file is mostly guardrails rather than reference,
> raise it rather than defaulting to the `CLAUDE.md`.

---

## Implementation order

```
P0:  1 (review) → 2 (repoint) → 3 (CLAUDE.md)
```

Strictly sequential. Item 3 must not land before items 1 and 2 — see Context.

## Acceptance

- No link in `packages/tree-sitter/AGENTS.md` targets `github.com/dot-agent-spec/<anything but platform>`.
- Every relative path in the file resolves from `packages/tree-sitter/`.
- `packages/tree-sitter/CLAUDE.md` exists and is one line.
- The `packages/tree-sitter/` checkbox in [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 is
  ticked, with the review recorded — the box asserts a review happened, so it may only be ticked once
  item 1 is genuinely done.
