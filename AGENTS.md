# dot-agent — Agent Guidelines

AI collaboration guide for maintaining and evolving this repository.

---

## What this repo is

`dot-agent-spec` is the specification and implementation repository for the dot-agent ecosystem. It contains:

- Language specification (`dsl/`) — syntax, semantics, and design of `.description` and `.behavior`
- Implementation packages (`packages/`) — compiler, parser, kernel, SDK, language server
- Developer-facing apps (`apps/`) — CLI, VS Code extension
- Editor/agent-host plugins (`plugins/`) — e.g. the native Claude Code plugin
- Governance records (`project/`) — RFCs, ADRs, plans, tasks, and pre-v1.0 decision logs
- Annotated examples (`examples/`) — canonical `.description` + `.behavior` pairs

This is a **real monorepo** — `packages/*` and `apps/*` are plain workspace folders, not git submodules.
There is no separate `git submodule update --init` step; clone and work directly. **`npm run build` needs
Docker running** (`packages/tree-sitter` runs `emcc` in a container); without it `dist/` is missing and
unrelated CLI tests fail to *load*, which reads as a test regression and is not one.

---

## Repository layout

Each `packages/*`, `apps/*` and `plugins/*` folder has its own `AGENTS.md` and README — read it before
changing anything there. The table further down lists them with their status.

```
dot-agent-spec/
├── README.md · LICENSE · CONTRIBUTING.md
├── ROADMAP.md                      ← language roadmap, version policy, freeze/editions model
├── GOVERNANCE.md                   ← decision process (RFC / ADR / plan / task)
├── AGENTS.md                       ← this file · CLAUDE.md is one line: @AGENTS.md
├── .agents/                        ← canonical agent config (rules, skills, agents) — see below
├── .claude-plugin/marketplace.json ← Claude Code marketplace entry, points at plugins/claude
├── project/                        ← governance records; lifecycles in .agents/rules/governance.md
│   ├── templates/                  ← copy-ready: rfc, adr, plan, task
│   ├── adr/                        ← decisions, DA<minor>-<seq> scheme
│   ├── rfcs/                       ← design proposals (+ implemented/ and rejected/, frozen)
│   ├── plans/                      ← permanent design records for multi-phase work
│   ├── tasks/                      ← work orders, deleted once done
│   ├── pre-release/v0.1/           ← long-form logs for DA decisions
│   └── implementation-status.md    ← per-feature tracker across the layers
├── dsl/                            ← language spec, Diátaxis (reference · explanation · how-to · tutorials)
├── docs/                           ← implementation docs, Diátaxis (reference · explanation · how-to)
├── packages/                       ← tree-sitter · parser-dsl · kernel-dsl · compiler · sdk · language-server
│                                     (+ transpiler-* — aspirational, RFC-0018)
├── apps/                           ← dot-agent-cli · vscode-extension · agy
├── plugins/claude/                 ← native Claude Code plugin: /dot-agent:run (Mode A) + /dot-agent:test
│                                     (Mode B); mcpServers dot-agent + dot-agent-helper
├── dogfood/                        ← dated DSL usability snapshots — NOT spec truth, see rules/dogfood.md
└── examples/                       ← canonical .description + .behavior pairs (CI-tested)
```

---

## Source of truth

| What | Where |
|---|---|
| Language syntax and semantics | `dsl/reference/` |
| Language design decisions | `dsl/explanation/` |
| Package / plugin implementation | `packages/*/`, `plugins/*/` (code is canonical) |
| Package internals docs | `packages/*/docs/` |
| Architecture overview | `docs/explanation/architecture/map.md` |
| Feature status across layers | `project/implementation-status.md` |
| Proposed changes | `project/rfcs/` (Draft status — not canonical) |
| Pending work | `project/tasks/` (ephemeral) · `project/plans/` (permanent) |
| Architecture decisions (settled) | `project/adr/` |
| Decision process | `GOVERNANCE.md` (what/why) · `.agents/rules/governance.md` (operational) |
| Definition of done for a layer change | `.agents/rules/doc-sync.md` |
| Roadmap & version policy | `ROADMAP.md` |

**When code and docs diverge, the code wins.** Docs describe intent; code is what runs.

Changing a layer obliges you to move its docs with it — which docs, for which change, is
`.agents/rules/doc-sync.md`, which loads automatically when you touch `packages/`, `dsl/`, `docs/` or
`examples/`. New syntax is gated by an RFC before the grammar is touched.

---

## Agent config — `.agents/` is canonical, `.claude/` mirrors it

Agent configuration has **one canonical home: `.agents/`**. `.claude/` holds thin *relative* symlinks back
into it, so Claude Code and the Antigravity/gemini side read the same bytes with no second copy to drift.
Never put the real file under `.claude/` — the gemini side reads `.agents/` and would never see it.

```bash
ln -s ../../.agents/rules/<name>.md  .claude/rules/<name>.md    # rule   (needs a description:)
ln -s ../../.agents/skills/<name>    .claude/skills/<name>      # skill
ln -s ../../.agents/agents/<name>.md .claude/agents/<name>.md   # subagent
```

The mechanics, the Windows fallback and the `test -L` check are documented once, upstream, in
[vibe-ops `references/instruction-surfaces.md`](https://github.com/entelekheia-ai/vibe-ops/blob/main/references/instruction-surfaces.md) —
they are identical in every repository using this convention and are not restated here.

**What lives here:** rules `governance` (`project/**`), `doc-sync` (`packages|dsl|docs|examples/**`),
`dogfood` (`dogfood/**`), `graphify`, `context-mode`, `antigravity-rtk-rules`; skills `/publish` and
`/sync-implementation-status`; subagent `cli-helper-agent-sync`.

**A nested `AGENTS.md` is not a delivery mechanism.** Claude Code loads `CLAUDE.md`, not an `AGENTS.md`
buried in a subfolder — a guardrail written there is read only by someone who already opened the folder,
which is too late. Anything that must fire *when work touches a folder* is a **path-scoped rule**
(`paths: ["glob"]`). A nested `AGENTS.md` survives only for authoring detail a reader looks up on
purpose, like `project/rfcs/AGENTS.md`, or for a package's own docs.

**Governance tooling is the [`vibe-ops`](https://github.com/entelekheia-ai/vibe-ops) plugin, not a local
copy.** Records are opened with `/vibe-ops:new-{adr,rfc,plan,task}` and closed with
`/vibe-ops:close-{plan,task}`; they read *this* repo's `project/templates/` and numbering, so the
convention stays owned here. **Do not fork those skills into `.agents/skills/`** — a local copy is what
rotted the previous `/new-adr`, which searched a pre-`project/` path for a numbering scheme this repo had
abandoned, and failed silently because a scaffold that finds nothing starts at 1.

**Model tiering for subagents and skills:** match the tier to the task — strongest for judgment-heavy
work, mid for structured execution, cheap for mechanical; `inherit` when unsure, and never change the
`model` of an *existing* subagent. Rationale and reversal plan:
[DA00-03](project/adr/DA00-03-model-tiering-for-agent-routing.md).

**Every skill and subagent carries a self-improvement loop.** A `## Self-improvement loop — keep this
file alive` section at the end, and running it is part of the task, not an optional epilogue. Copy the
shape from [`.agents/agents/cli-helper-agent-sync.md`](.agents/agents/cli-helper-agent-sync.md) or
[`.agents/skills/sync-implementation-status/SKILL.md`](.agents/skills/sync-implementation-status/SKILL.md).
The rules that matter:

- **A fact hardcoded in an instruction file rots silently, and a rotted file is worse than a missing one
  — it reads as authority.** `sync-implementation-status` carried a node-name discrepancy map whose five
  entries were *all* stale; it would have mis-mapped grammar nodes on every run. Deleting a stale local
  copy and pointing at the live source is the highest-value edit in a self-improvement pass. Same failure
  as the forked `/new-adr` above.
- Prefer correcting a stale assumption over appending a paragraph — these files should stay the same
  length after ten runs and just get more accurate.
- Keep session-specific detail (line numbers, versions, today's diff) out; it belongs in the report and
  the commit message.
- Never touch frontmatter in a self-improvement pass — same principle as not changing an existing
  subagent's model.
- Say in the report whether the file changed, so it shows up in `git diff`. Never a silent self-rewrite.

---

## Package, app & plugin table

| Directory | Purpose | Status |
|-----------|---------|--------|
| `packages/tree-sitter/` | WASM grammar — canonical grammar source | ✅ Active |
| `packages/parser-dsl/` | Rust/WASM — parses `.behavior` + `.description` | ✅ Active |
| `packages/kernel-dsl/` | Rust/WASM — FSM execution engine | ✅ Active |
| `packages/compiler/` | TypeScript — linter, AST analysis, ZIP packaging | ✅ Active |
| `packages/sdk/` | TypeScript — browser dispatch layer | ✅ Active |
| `packages/language-server/` | Node.js — LSP server | ✅ Active |
| `apps/dot-agent-cli/` | Developer CLI | ⚠️ Pending v2 update |
| `apps/vscode-extension/` | VS Code LSP client | ⚠️ Pending v2 update |
| `apps/agy/` | Antigravity CLI runtime plugin | 🚧 In Progress |
| `plugins/claude/` | Native Claude Code plugin (skills + mcpServers) | 🚧 In Progress |

`apps/zed-agent/` was removed — historical reference only in git history. The `transpiler-*` packages are
aspirational (RFC-0018).

---

## Language rule

All documentation in this repository must be written in English.

## License rules

- `.md`, `.description` and `.behavior` files need **no header** — the root `LICENSE` covers them
- Source files (`.ts .tsx .js .jsx .mjs .cjs .rs`, anywhere) carry the Apache 2.0 header. Fix with
  `./scripts/ensure-license-headers.sh` (`--check` only reports); CI runs it on every PR. **Never go back
  to a git hook** — `core.hooksPath` is repo-scoped, so one package installing it reconfigures the whole
  monorepo ([#19](https://github.com/dot-agent-spec/platform/issues/19))
- **`tools/wasi-stub/` is third-party and must never carry our copyright**; `pkg/`, `bindings/` and
  `generated-*` are tool output. The script excludes all four
