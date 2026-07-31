# Task: Review `apps/vscode-extension/AGENTS.md` and Deliver It

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-07-31 |
| Author | Danilo Borges |
| Sources | [plans/003-pre-monorepo-fossil-cleanup.md](../plans/003-pre-monorepo-fossil-cleanup.md) — Track E · closes the `apps/vscode-extension/` item of [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 |

---

## Context

`apps/vscode-extension/AGENTS.md` is 97 lines with **no sibling `CLAUDE.md`**, so Claude Code never loads
it. [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 singles this folder out as **"the worst
link rot"** in the repository: four archived-repository links in its reference table, one more in its
prose, and one more in the `README.md`. Two of the six targets are deleted outright and return 404; one
points at a file that no longer exists in a repository that does.

Track 3 prescribes a three-step sequence per folder and states that **the order is load-bearing**: review
the content, *then* repoint the dead links, *then* add the one-line `CLAUDE.md`. Do not reorder.

The package is also marked **⚠️ Pending v2 update** in the root [`AGENTS.md`](../../AGENTS.md) package
table. Expect the file to describe a state the code has moved past, and treat "this looks out of date" as
the default hypothesis rather than the exception.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Review the 97 lines against the current extension | apps/vscode-extension | M |
| 2 | P0 | Repoint four dead links in the `AGENTS.md` reference table | apps/vscode-extension | S |
| 3 | P0 | Repoint the prose link in `AGENTS.md` and the one in `README.md` | apps/vscode-extension | XS |
| 4 | P0 | Add the one-line `CLAUDE.md` | apps/vscode-extension | XS |

---

## Work items

### 1. Review the content against the extension as it exists — P0

**What:** Read `apps/vscode-extension/AGENTS.md` end to end and verify each factual claim against the
current source.

**Why:** The file predates the flatten *and* the package is flagged as pending a v2 update, so it is the
most likely of the four Track 3 folders to assert something false. Per the root `AGENTS.md`, a rotted
instruction file reads as authority.

**Change:** Confirm or correct each claim. Specifically check:

- The **"never add LSP feature logic to `extension.js`"** rule near line 26 — confirm the file it names
  still exists under that name and that the rule still reflects the architecture. A guardrail naming a
  file that has been renamed is unenforceable and misleading.
- How the language server is obtained: it is **bundled into the extension's build output**, not installed
  from npm. The root `AGENTS.md` and this repository's release history both stress that the extension
  bundles build output; an agent will assume the npm path by default.
- Build, package and debug commands, from the monorepo root and from the package directory.
- **How a change to the bundle gets verified**, which the file should say and probably does not. Track C
  established that an LSP `initialize` handshake returns all nine providers before anything has parsed, so
  it proves `dist/server.mjs` *loads* and nothing more. The externalized `@dot-agent/parser-dsl` /
  `web-tree-sitter` packages and the `createRequire` banner — the parts `scripts/build.mjs` goes out of its
  way to arrange, and the parts a bundler change actually breaks — only run once a document is opened.
  Driving `textDocument/didOpen` with `languageId: "behavior"` (the short id the server filters on, not the
  extension's selector) and asserting real diagnostics come back is the check that means something. See
  Plan-003's `Surprises & Discoveries`.
- Redundancy against the root `AGENTS.md` — delete rather than reformat.

### 2. Repoint four dead links in the reference table — P0

**What:** The table around lines 94–97 contains four links:

| Current link text | Current target | State | Repoint to |
|---|---|---|---|
| `language.md` | `dot-agent-spec/dot-agent/blob/main/dsl/language.md` | **404 — file gone** | `../../dsl/` |
| `language-server` | `dot-agent-spec/language-server` | archived | `../../packages/language-server/` |
| `dot-agent-tree-sitter` | `dot-agent-spec/dot-agent-tree-sitter` | **404 — deleted** | `../../packages/tree-sitter/` |
| `dot-agent-kernel` | `dot-agent-spec/dot-agent-kernel` | **404 — deleted** | `../../packages/kernel-dsl/` |

**Why:** Three of the four are hard 404s. The first is a distinct failure from the others: the repository
`dot-agent-spec/dot-agent` still exists and is active, but `dsl/language.md` is not in it — so the link
looks plausible and fails only when followed.

**Change:** Use **relative paths** — `AGENTS.md` is read from a working tree. Note the first row needs a
judgement call rather than a mechanical swap: the language specification is now the `dsl/` folder with
its Diátaxis split (`reference/`, `explanation/`, `tutorials/`), not a single `language.md`. Point at the
folder, or at the specific reference page the row is actually about, and update the link text so it stops
naming a file that does not exist.

Two of the link texts are also stale names: `dot-agent-tree-sitter` and `dot-agent-kernel` are now
`tree-sitter` and `kernel-dsl`. Fix the labels, not just the targets.

### 3. Repoint the prose links — P0

**What:** Two more links to the archived `dot-agent-spec/language-server`, outside the reference table:

- `apps/vscode-extension/AGENTS.md` line 9 — in the "thin LSP client" paragraph.
- `apps/vscode-extension/README.md` line 9 — the same sentence, rewritten for users.

**Why:** Both point at an archived repository whose code now lives at `packages/language-server/`.

**Change:** The two files take **different link styles**, and this is the item most likely to be got
wrong by treating them as one edit:

- `AGENTS.md` → relative path (`../../packages/language-server/`), because it is read from a working tree.
- `README.md` → **absolute URL** into the monorepo, because a VS Code extension README is rendered on the
  Marketplace, where a relative repository path does not resolve.

### 4. Add the one-line `CLAUDE.md` — P0

**What:** Create `apps/vscode-extension/CLAUDE.md` containing exactly `@AGENTS.md`.

**Why:** Claude Code loads `CLAUDE.md`, not a nested `AGENTS.md`.

**Change:** One line. Do this **only after items 1–3 are complete** — it is the step that starts
delivering the file into context, and this folder's file is the one most likely to still contain
something false.

> Check first whether this content belongs in a **path-scoped rule** instead. The `extension.js` guardrail
> in item 1 is exactly the kind of thing the root `AGENTS.md` says must fire *when work touches the
> folder*, which is a `paths:`-scoped rule under `.agents/rules/`, not a `CLAUDE.md` a reader opens on
> purpose. This folder may warrant splitting: rule for the guardrail, `AGENTS.md` for the reference.

---

## Implementation order

```
P0:  1 (review) → 2 (table links) → 3 (prose links) → 4 (CLAUDE.md)
```

Strictly sequential. Item 4 must not land before 1–3.

## Acceptance

- No link in `apps/vscode-extension/AGENTS.md` or `README.md` targets
  `github.com/dot-agent-spec/<anything but platform>`, and none targets `dsl/language.md`.
- Link **text** no longer names `dot-agent-tree-sitter`, `dot-agent-kernel` or `language.md`.
- `AGENTS.md` uses relative paths; `README.md` uses absolute URLs.
- `apps/vscode-extension/CLAUDE.md` exists and is one line — or a path-scoped rule was created instead,
  with the reason recorded in the plan's `Decision Log`.
- The `apps/vscode-extension/` checkbox in [Plan-001](../plans/001-adopt-vibe-ops-baseline.md) Track 3 is
  ticked — only once item 1 is genuinely done.
