# dot-agent — Agent Guidelines

`dot-agent-spec` is the specification **and** the implementation of the dot-agent ecosystem: a language
for describing agent behaviour (`.description` + `.behavior`), the toolchain that compiles it, and the
runtime that executes it.

This is a **real monorepo** — `packages/*` and `apps/*` are plain workspace folders, not submodules, so
there is no `git submodule update --init` step. `npm run build` needs **Docker running**, and its absence
surfaces as *test* failures rather than a build error, which is the wrong place to look — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Layout — only what a directory listing does not say

The tree is otherwise self-explanatory, and this repository carries a generated code-graph index under
`graphify-out/`: prefer querying it for structural questions ("what calls this", "what does this package
depend on") over browsing the source. It covers the tracked source and markdown, **not** `target/`,
`node_modules/` or generated WASM.

| Path | What is not obvious about it |
|---|---|
| `dsl/` | The **language** spec — syntax and semantics as an author meets them. Not implementation docs. |
| `docs/` | The **implementation** docs. Both trees are Diátaxis-shaped, which is exactly why they are easy to confuse. |
| `packages/*/docs/` | A package's internals, and canonical for them — closer to the code than `docs/` is. |
| `project/` | Governance records. Lifecycles, numbering and which command closes which are in [`.agents/rules/governance.md`](.agents/rules/governance.md), which loads on its own inside this folder. |
| `dogfood/` | Dated write-once snapshots of how the DSL *felt* to author on one day. **Never spec truth** — [`.agents/rules/dogfood.md`](.agents/rules/dogfood.md) says why. |
| `examples/` | CI-tested against the current grammar, so a change that breaks one is a real break, not a stale fixture. |
| `plugins/claude/` | Shipped **byte for byte** into every user's plugin cache — no build, no allowlist. Nothing personal or machine-specific may land here, and it must not get a `CLAUDE.md`. |
| `.claude-plugin/marketplace.json` | Stays at the root while the plugin it points at lives in `plugins/claude`. The repository is the marketplace. |

Most `packages/*`, `apps/*` and `plugins/*` folders carry their own `AGENTS.md` and README — read the
one for the folder you are changing.

## Source of truth

**When code and docs diverge, the code wins.** Docs describe intent; code is what runs.

| What | Where |
|---|---|
| Language syntax and semantics | `dsl/reference/` |
| Language design decisions | `dsl/explanation/` |
| Package / plugin implementation | `packages/*/`, `plugins/*/` — the code itself |
| Architecture overview | `docs/explanation/architecture/map.md` |
| Feature status across layers | `project/implementation-status.md` |
| Which packages are not yet current | [`ROADMAP.md`](ROADMAP.md) § Where each package stands |
| Proposed changes | `project/rfcs/` — Draft status is **not** canonical |
| Decision process | [`GOVERNANCE.md`](GOVERNANCE.md) (what and why) · `.agents/rules/governance.md` (operational) |
| Definition of done for a layer change | `.agents/rules/doc-sync.md` |

## How this repo works — the parts that bite

- **Changing a layer obliges you to move its docs with it.** Which docs, for which change, is
  [`.agents/rules/doc-sync.md`](.agents/rules/doc-sync.md), which loads automatically on `packages/`,
  `dsl/`, `docs/` and `examples/`. Doc drift across the layers is this repository's main failure mode.
- **New syntax is gated by an RFC before the grammar is touched**, and a grammar change propagates to
  every layer below it. This is the one change class where design comes first by rule.
- **Never reinstate a git hook for licence headers.** `core.hooksPath` is repo-scoped, so one package
  installing a hook reconfigures the whole monorepo
  ([#19](https://github.com/dot-agent-spec/platform/issues/19)).
- **A nested `AGENTS.md` is not a delivery mechanism.** Claude Code loads `CLAUDE.md`; an `AGENTS.md`
  buried in a subfolder is read only by someone who already opened it, which is too late for a guardrail.
  Anything that must fire *when work touches a folder* is a path-scoped rule (`paths: ["glob"]`). A nested
  file survives only for authoring detail a reader looks up on purpose, like `project/rfcs/AGENTS.md`.

## Licence

- `.md`, `.description` and `.behavior` need **no header** — the root [`LICENSE`](LICENSE) covers them.
- Source files (`.ts .tsx .js .jsx .mjs .cjs .rs`) carry `// SPDX-License-Identifier: Apache-2.0` and
  nothing else. Attribution is collective in [`AUTHORS`](AUTHORS), and CI rejects any other header form —
  rationale, exclusions and the fix command are in [CONTRIBUTING.md](CONTRIBUTING.md).

All documentation in this repository is written in English, whatever language the conversation is in.

## Agent config — `.agents/` is canonical, `.claude/` mirrors it

Agent configuration has **one canonical home: `.agents/`**. `.claude/` holds thin *relative* symlinks back
into it, so Claude Code and the Antigravity/gemini side read the same bytes with no second copy to drift.
Never put the real file under `.claude/` — the gemini side reads `.agents/` and would never see it.

```bash
ln -s ../../.agents/rules/<name>.md  .claude/rules/<name>.md    # rule   (needs a description:)
ln -s ../../.agents/skills/<name>    .claude/skills/<name>      # skill
ln -s ../../.agents/agents/<name>.md .claude/agents/<name>.md   # subagent
```

The mechanics, the Windows fallback and the `test -L` check are documented once upstream, in
[vibe-ops `references/instruction-surfaces.md`](https://github.com/entelekheia-ai/vibe-ops/blob/main/references/instruction-surfaces.md),
and are not restated here. What each rule and skill does is its own frontmatter's job; `ls .agents/rules`
answers the rest. Authoring one — the self-improvement loop, model tiering, and why the governance skills
must not be forked in — is [`.agents/rules/instruction-file-hygiene.md`](.agents/rules/instruction-file-hygiene.md),
scoped to `.agents/**`.

**Governance records are opened and closed with the
[`vibe-ops`](https://github.com/entelekheia-ai/vibe-ops) plugin**, never by hand and never with a local
fork of its skills. They read *this* repository's `project/templates/` and numbering, so the convention
stays owned here.

## Keeping this file current

A stale entry map is a primary source of hallucination — an agent will confidently use a path that no
longer exists. Updating this file is **part of any task that changes the repository's shape**, not a
follow-up. Fold the edit into the work and mention it.

Triggers specific to this repository:

- A top-level folder or a `packages/*` / `apps/*` / `plugins/*` folder appears, is archived, or changes
  what it is authoritative for.
- A rule or skill is added under `.agents/` — check it is bridged into `.claude/` by symlink, not copied.
- An invariant above stops being true, or a new one is discovered the hard way.
- A package stops being current, or becomes current: that goes to `ROADMAP.md`, not here.
- The graph's coverage changes, which would make the layout section's scope claim wrong.

Adjust the one affected line and keep entries to one line, pointing at the source of truth rather than
restating it.
