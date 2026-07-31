# Plan-002: dot-agent as a Claude Code Plugin

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-30 |
| Author | Danilo |
| Tracking issue | [#13](https://github.com/dot-agent-spec/platform/issues/13) — owns status and the executive summary; this file owns the design and the working record |
| Related | [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (the decision) + its [long-form log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (full context, rationale, settled decisions) |

> Migrated from `project/tasks/DA00-07-dot-agent-claude-skill.md` on 2026-07-30. The work predates this
> file; content below is preserved from the task, not rewritten. The reason for the move is in the
> Decision Log.

---

## Summary

Ship a **generic Claude Code plugin that loads and runs any `.agent`**, distributable on the marketplace
so the experience is "download and run". A user says "load this agent and follow its flow, let's start"
and Claude begins following the agent's directives — embodying the persona the `.agent` describes rather
than narrating it. Fridge Assistant is the test case, not the target: nothing in the plugin is specific to
any one agent.

## Goals

1. A user can install one plugin and drive an arbitrary `.agent` without editing configuration or
   restarting a session.
2. The comportment an LLM must adopt when driving an agent is specified once, transport-neutrally, and
   every host's skill mirrors that one specification rather than restating it.
3. The plugin depends on a single globally-installed `dot-agent` CLI — nothing vendored, nothing to keep
   in sync with the published package.
4. Swapping the runtime implementation (Node to Rust) requires no change to any `.agent`, any skill, or
   the plugin manifest beyond the executable it points at.

## Scope

### In scope

`apps/dot-agent-cli/` (the skill, the MCP server, `load_agent`), `plugins/claude/` (the manifest and both
skills), `dsl/reference/comportment.md` as the canonical comportment spec, and the root
`.claude-plugin/marketplace.json`.

### Out of scope

- **Mode D — SDK and host-embedding documentation.** Deferred; it is a different audience (someone
  embedding the runtime in their own product) from the plugin's audience (someone running an agent inside
  a CLI host).
- **v2 multi-management — skills that embed their own `.agent`.** Deferred. Today a skill drives an agent
  chosen at runtime; a skill that *ships* one is a different distribution shape and is not designed yet.
- **An HTTP endpoint for the runtime.** Explicitly dropped, not deferred — see the Decision Log.
- **Reference-doc drift in `docs/reference/kernel-dsl.md` and `dsl/reference/description.md`.** Tracked
  separately, independent of this plan's delivery — closed via
  [platform#20](https://github.com/dot-agent-spec/platform/issues/20) (the task dossier that tracked it,
  `project/tasks/reference-doc-drift.md`, is deleted per the task lifecycle; breadcrumb on the issue).

## Design

The full rationale — the three-layer decoupling, the role-framing bug this solves, the seven settled
decisions and the usage taxonomy — is in
[DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) and its
[long-form log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md). Preserved from the
source task: that split is deliberate, and this file tracks work and state rather than re-arguing the
decision.

The load-bearing shape, stated here so this file stands alone: `dsl/reference/comportment.md` is the
**canonical, transport-neutral comportment spec** — what an LLM must do with what the FSM hands it.
`apps/dot-agent-cli/skills/run/SKILL.md` and every host plugin's skill mirror it rather than defining
their own. Underneath, the runtime exposes a `(state, intent) → (state, effects)` wire contract, which is
what makes the Rust reimplementation a drop-in rather than a rewrite.

One constraint drove most of the delivery: **Claude Code fixes an MCP server's tool list at connect
time**, so a server that only comes into existence once an agent has been chosen can never be reached
from a skill. That is why the runtime is a single always-registered server holding a mutable `Runtime`
slot filled by a `load_agent` tool, rather than a server launched per agent.

## Tracks

### Track 1 — Comportment: one Mode A specification — **done**

Reconcile the CLI skill's two contradictory stances — the "MCP interaction loop" (autonomous driver) and
"Agent Simulation / Emulation Mode" (proxy/echo) — into a single **Mode A** comportment, plus a "how to
behave with what you receive" section: embody the persona, treat FSM output as your system-level director
for this state rather than as user input or a command list, converse with the human, signal intents
silently.

### Track 2 — Plugin manifest: MCP auto-registration — **done**

Declare the agent-agnostic MCP servers in `plugins/claude/.claude-plugin/plugin.json` so they auto-start
and auto-register on enable, replacing the manual `dot-agent-cli configure` step and the `claude mcp add`
workaround that does not take effect mid-session.

### Track 3 — The marketplace plugin: run *any* agent — **done**

Make the plugin able to load and drive an arbitrary `.agent`, add the Mode B autonomous-test skill, and
publish both through a root `.claude-plugin/marketplace.json`.

### Track 4 — Release gate: publish `@dot-agent/cli`

The plugin's Step 0 installs `@dot-agent/cli` from npm, so `load_agent` only exists for real users once
that package is published carrying it. Until then the plugin is complete in the repository and inert in
the wild. Use the `/publish` skill; the exact-pin cascade across `@dot-agent/*` is documented there.

### Track 5 — Rust runtime — roadmap

Reimplement the runtime host in Rust behind the same `(state, intent) → (state, effects)` wire contract,
for independence from Node and better performance. A drop-in swap of the Layer 2 entrypoint: the manifest's
`mcpServers.command` points at a different executable and nothing else changes.

### Track 6 — `lspServers` for `.description`/`.behavior` authoring — roadmap

Declare `lspServers` pointing at the `.behavior`/`.description` language server that already exists in
this monorepo for the VS Code extension, so Claude gets live diagnostics and go-to-definition while
*authoring* an `.agent`. This is the authoring lane, distinct from every other track here, which is the
running lane. It may end up in this plugin or a separate authoring-focused one; not decided.

### Track 7 — Surfacing engine-driven transitions — roadmap

When the FSM moves on its own — a global `on event`, or an `after N prompts` timer, with the driving LLM
signalling nothing — surface it immediately instead of only on the next `dot-agent://state` re-read. Two
candidate mechanisms, in preference order:

- **Background monitor** (preferred): the runtime appends a line to a log file whenever it applies an
  engine-driven transition, and the plugin ships a `monitors/monitors.json` entry that `tail -F`s it. No
  special flag or org allowlist needed, but it requires a small runtime change and its delivery-timing
  semantics — does it interrupt the current turn, or surface on the next? — are not documented. Verify
  empirically before committing to it.
- **Channels** (fallback): the MCP server declares `claude/channel` and pushes
  `notifications/claude/channel` directly. No log-file plumbing, but it is a research preview requiring
  `--dangerously-load-development-channels` or org allowlisting — a dependency outside our control.

Neither is v1: re-reading state every turn already works and is documented in `comportment.md`. This is
polish, and the preferred mechanism needs a spike first.

### Track 8 — Instruction-file debt in the folders this plan touches

Pulled in from [Plan-001](001-adopt-vibe-ops-baseline.md) Track 3, which asks that a plan touching one of
those folders close its item rather than leave it for a sweep that never comes. This plan owns
`apps/dot-agent-cli/` and `plugins/claude/`, so it owns their instruction-file debt: neither has a sibling
`CLAUDE.md`, so neither `AGENTS.md` has ever loaded — 115 and 48 lines of guidance sitting inert.
`apps/dot-agent-cli/` additionally holds a zero-byte `templates/AGENTS.md`. Per Plan-001, review the
content first, then add the `CLAUDE.md`: delivering stale guidance is worse than not delivering it.

## Success criteria

A user with no prior setup can install the plugin from the marketplace, invoke `/dot-agent:run` on an
arbitrary `.agent` path, and reach the agent's first state without editing a config file or restarting the
session. A second `load_agent` call in the same session restarts the flow without a new process.

For Track 8, `<vibe-ops-plugin-dir>/scripts/check-agents-md.sh` reports no `links` failure under
`apps/dot-agent-cli/` or `plugins/claude/`, and each folder's guidance reaches context by the mechanism
that folder allows: a sibling `CLAUDE.md` containing `@AGENTS.md` for `apps/dot-agent-cli/`, and a
`paths`-scoped rule under `.agents/rules/` for `plugins/claude/`, whose contents ship to users verbatim.
`claude plugin validate plugins/claude` passes with no warnings.

---

## Progress

- [x] **Track 1 — Mode A comportment.** `dsl/reference/comportment.md` written as the canonical
      transport-neutral spec; `apps/dot-agent-cli/skills/run/SKILL.md` mirrors it. Tested end to end
      against Fridge Assistant, live and human-in-the-loop. Commit `fdca20b`.
- [x] **Track 2 — plugin manifest.** `plugins/claude/.claude-plugin/plugin.json` declares `mcpServers` for
      the two agent-agnostic servers; `plugins/claude/skills/run/SKILL.md` mirrors the CLI skill.
      `mcpServers.command` is the PATH-resolved `dot-agent`, which the skill's Step 0 installs on first use
      if missing.
- [x] **Track 3 — marketplace plugin.** Done; superseded Track 2's note that nothing could yet run a
      user's agent.
  - [x] `apps/dot-agent-cli/src/commands/mcp-run.ts`: tools and resources close over a mutable `Runtime` holder
        (`{ session?, bundle? }`) instead of a fixed session, so they register once at boot and report "no
        agent loaded" until `load_agent(source)` fills it. A second `load_agent` replaces what was loaded,
        which doubles as "restart the flow" without a new process.
  - [x] `dot-agent-dev` (4 authoring tools, no agent capability) folded into that one server and renamed
        `dot-agent`. `dot-agent-helper` stays separate, being itself a loaded agent.
  - [x] Plugin `README.md`, `AGENTS.md` and both `SKILL.md` copies updated to describe `load_agent`
        instead of the non-working "launched on demand" claim.
  - [x] `plugins/claude/skills/test/SKILL.md` (Mode B) added, pointing back at the Mode A skill for
        comportment instead of duplicating it; adds only the behavioral delta (synthesize the human's turn)
        and the subagent-isolation caveat.
  - [x] Root `.claude-plugin/marketplace.json` with `"source": "./plugins/claude"` — installable via
        `/plugin marketplace add dot-agent-spec/platform`.
  - [x] Both skill folders renamed — `skills/dot-agent` → `skills/run`, `skills/dot-agent-test` →
        `skills/test`, in the plugin and in the CLI's mirrored copy — after installing the plugin locally
        showed the invocation names were wrong. See *Surprises & Discoveries*.
  - [x] `plugins/claude/README.md` rewritten against the `/vibe-ops:authoring-readme` checklist: it had no
        Install or Quickstart section at all (the install command lived only in the root README, so the
        plugin's own README did not stand alone) and had drifted into architecture narrative. Commit
        `9ac88b4`.
- [x] **`configure --claude` narrowed to MCP only** (2026-07-30). The Claude skill-copy branch is gone;
      the command now names the plugin install commands instead. `configure.ts`, `cli.ts` help text and
      `configure.test.ts` updated together. Fixed alongside it: a `uri`-overwrite bug and two callback
      return-type errors that `tsc --noEmit` had been reporting and the `tsdown` build never checked.
- [x] **`configure --claude` now installs the plugin instead of writing MCP config for it** (2026-07-30,
      same day, superseding the bullet above). A code-review comment on the "MCP only" state above led to
      inspecting a real `~/.claude.json`: the CLI's own past writes had drifted two renames behind (a
      `dot-agent` entry carrying the helper's args), and Claude Code's own docs confirm plugin and
      user-config MCP servers don't de-duplicate — so the "MCP only" write was not a harmless fallback, it
      was the sole source of the drift it existed to clean up. `configure.ts`'s `claude` target now shells
      out via the new `src/host-command.ts` to `claude plugin marketplace add`/`install` (idempotent) and
      deletes any legacy `dot-agent`/`dot-agent-helper`/`dot-agent-dev` entries it finds — never writes new
      ones. `--skill`/`--mcp` no longer apply to `--claude`. Decision, evidence and rejected alternatives:
      [ADR-DA00-08](../adr/DA00-08-cli-installs-native-host-plugins.md) +
      [its log](../pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md).
- [x] **`configure --claude` verified end-to-end against a live `~/.claude.json`** (2026-07-31). Backed
      up first, then ran the built branch (via `npm link`): the three legacy `dot-agent`/`dot-agent-helper`/
      `dot-agent-dev` entries disappeared from `mcpServers`, nothing else in the file changed, the plugin
      installed and reconnected cleanly, and a second run was a no-op. This also settled the question
      [ADR-DA00-08's log](../pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md) left open —
      see *Surprises & Discoveries* for the tool-namespace finding and the `SKILL.md` bug it caught.
      Covers the **warm** path only: this machine already had the marketplace, so `addMarketplace()` never
      ran. See the next entry.
- [x] **Cold-start path exercised separately, and it fails** (2026-07-31). Re-ran the same command with
      `CLAUDE_CONFIG_DIR` pointed at an empty directory, so the host saw no `dot-agent-spec` marketplace
      and took the `!existing → addMarketplace()` branch against the real GitHub remote. It exits 1:
      `origin/main` carries neither `.claude-plugin/` nor `plugins/`. Two findings in *Surprises &
      Discoveries* — the broken cold start, and that its failure aborts before the legacy cleanup runs.
      The real `~/.claude.json` was byte-identical either side of the run.
- [ ] **Track 4 — publish `@dot-agent/cli`.** Not done. This is what stands between the plugin working in
      the repository and working for anyone else. Gated first on the maintainer's own manual test of the
      installed plugin — as of 2026-07-30 the plugin has only ever run on this machine against an
      `npm link`ed CLI, never against a registry install. **Second gate, found 2026-07-31:** merging this
      branch to `main`, because `marketplace add` clones the default branch and `main` carries no
      `.claude-plugin/marketplace.json`. Publishing the npm package alone would not make the cold start
      work — and neither would the merge alone. The publish **requires a version bump**: `0.11.1` is
      already on npm (2026-07-16) and its published `dist/` contains no `load_agent` (verified by
      unpacking the tarball), while `apps/dot-agent-cli/package.json` still reads `0.11.1`. Until a bumped
      build ships, a merged `main` gets a user a plugin whose servers start and whose skill names a tool
      that does not exist.
- [ ] **Track 5 — Rust runtime.** Roadmap, unscheduled.
- [ ] **Track 6 — `lspServers` for authoring.** Roadmap, unscheduled.
- [ ] **Track 7 — engine-driven transitions.** Roadmap, unscheduled; needs the delivery-semantics spike
      before either mechanism is chosen.
- [x] **Track 8 — instruction-file debt.** Done. `check-agents-md.sh` reports no `links` failure under
      either folder.
  - [x] `apps/dot-agent-cli/` — the review found the file was not about the CLI at all, so it was
        rewritten rather than corrected (see Surprises). `CLAUDE.md` added.
  - [x] `apps/dot-agent-cli/templates/AGENTS.md` — deleted. It was not an instruction file: `templates/`
        is the scaffold `init` copies, so the empty file was landing in every new user project.
  - [x] `plugins/claude/` — reviewed, accurate and current, all six links resolve; left unchanged. The
        `CLAUDE.md` first added here was **removed**: a plugin root ships verbatim to users and is not
        loaded as project context (see Surprises). Replaced by `.agents/rules/plugin-claude.md`, scoped to
        `plugins/claude/**` and `apps/dot-agent-cli/skills/**` so it also fires on the mirrored `SKILL.md`.
        `claude plugin validate` now passes with no warnings.
  - [x] `apps/dot-agent-cli/README.md` — rewritten through `/vibe-ops:authoring-readme` once vibe-ops
        0.5.0 made the skill invocable. It carried five false claims, including an install command for a
        package that 404s and a library example built on an API `run()` never had. Not instruction-file
        debt, but the same folder and the same failure mode, so it belongs to this track.
  - [x] `apps/dot-agent-cli/file structure.md` — 483 lines of `aboutme.json` design analysis that had
        nothing to do with the CLI. Moved out of this repository entirely, to the workspace's own
        `project/research/`, renamed to describe its contents and given a provenance header noting that
        `schemaVersion` was superseded by `dslVersion` (DA00-02). Body preserved unedited.

## Surprises & Discoveries

- **Observation:** Testing the comportment spec live against a real agent found seven gaps that reading it
  had not.
  **Evidence:** the Fridge Assistant end-to-end run, human-in-the-loop, surfaced and fixed: state-bleed
  across dwells; a silent no-op on unhandled `send_offtopic`; conflation of off-topic with unmatched-intent;
  grounding elasticity; the trust boundary for third-party `.agent` authors; end-of-flow handling; and
  multi-hop routing. Commit `fdca20b`.

- **Observation:** `claude mcp add` requires a session restart to take effect, which is what forced an
  HTTP-transport workaround during the Fridge end-to-end test.
  **Evidence:** the workaround existed only because a server added mid-session was unreachable. Bundling
  the servers in the plugin manifest removed the problem instead of working around it — which is why
  Track 2 exists in the shape it does.

- **Observation:** Claude Code fixes an MCP server's tool list at connect time, so a server that only
  exists once an agent has been chosen can never be reached from a skill.
  **Evidence:** Track 2 shipped a plugin whose only two servers were agent-agnostic — scaffolding plus the
  DSL helper — so the actual "load this agent and follow its flow" use case had no working path at all.
  `dot-agent run <src> --mcp` cannot be launched mid-session and attached the way an already-declared
  `mcpServers` entry can. This is the constraint that produced the mutable-`Runtime`-plus-`load_agent`
  design rather than a per-agent server.

- **Observation:** Naming a skill folder after the plugin makes the skill unusable to *say*. Only visible
  once installed.
  **Evidence:** Claude Code namespaces a plugin's skills as `/<plugin>:<skill>`. With the plugin named
  `dot-agent` and its default skill folder also named `dot-agent`, the skill invoked as
  `/dot-agent:dot-agent`, and Mode B as `/dot-agent:dot-agent-test`. Renaming the folders to `run` and
  `test` gives `/dot-agent:run` and `/dot-agent:test`. Nothing in the repository surfaces this — the
  folder name reads fine on disk and the manifest never restates it. **This generalizes:** per
  [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) a Codex or Antigravity adapter will
  face the same trap, so name a host plugin's skill folders for the *verb* they perform, never for the
  plugin.

- **Observation:** A local-path plugin's installed cache does not refresh when its files change. `claude
  plugin update` reports success and changes nothing.
  **Evidence:** After renaming the skill folders, the installed copy under
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` still held the old names.
  `claude plugin marketplace update` did not help, and `claude plugin update` reported "already at the
  latest version (0.1.0)" without copying anything — the mechanism is gated on the version in
  `plugin.json`, not on file contents. `uninstall` followed by `install` forces a fresh copy. Relevant to
  anyone iterating on this plugin locally: bump the version or reinstall, or you will be testing stale
  files while believing you are testing your edits.

- **Observation:** `claude plugin details` reports "MCP servers (0)" even for a plugin whose MCP tools are
  demonstrably working.
  **Evidence:** It reported zero for this plugin *and* for an unrelated third-party plugin whose tools
  were in active use in the same session, while a raw JSON-RPC `initialize` + `tools/list` handshake
  against the spawned process confirmed the server registers correctly. It is a display limitation of that
  subcommand — do not use it to diagnose a registration problem, and do not re-investigate this.

- **Observation:** A `UserPromptSubmit` hook cannot drive `tick_prompt`, even though both exist and the
  pairing looks obvious.
  **Evidence:** `tick_prompt` only does something once an agent is loaded — that is, once the `Runtime`
  holder is filled — and a shell hook has no way to know that state or to call a specific tool on a
  specific connection. `after N prompts` therefore remains a documented degradation on this surface until a
  proper tick channel exists.

- **Observation:** The guard against the two `SKILL.md` copies drifting was already written down, in a file
  that never loads. Track 8 is not hygiene — it is why the guard failed.
  **Evidence:** `plugins/claude/AGENTS.md` has said "the two copies are kept byte-identical, verify with
  `diff`" since Track 2. An unrelated sync of `apps/dot-agent-cli/helper-src/` still found both copies
  telling the driving LLM to navigate to a `generate` intent the helper actually names `gen`. The rule was
  correct, current, and unread — the folder has no `CLAUDE.md`, so Claude Code never loaded it. What did
  catch it was the same rule restated in the `cli-helper-agent-sync` subagent prompt, which does load. The
  `.agents/` ↔ `.claude/` symlink convention cannot fix the duplication itself: the plugin folder has to
  stand alone to be installable from the marketplace. So the copy stays and the guard has to be a check —
  and it has to live somewhere that loads.

- **Observation:** `apps/dot-agent-cli/AGENTS.md` was not about `apps/dot-agent-cli`.
  **Evidence:** Track 8 assumed 115 lines needing review against the current CLI surface. What was there
  was a generic "Agent Dependencies" registry — a template for tracking dependencies between agents, with
  invented example agents (`doctor`, `assistant`), an aspirational capability list (`SlackBot`,
  `PaymentGateway`), and orchestration rules describing nothing in the codebase. Nothing named a real
  command, flag or module. The one procedural section was actively wrong: it said releases publish by
  creating a GitHub Release, when `publish-ts.yml` triggers on a pushed `cli@*` tag. It was rewritten from
  scratch rather than corrected. This is the sharpest argument for Plan-001's ordering rule — had the
  `CLAUDE.md` been added first, the repository would have started delivering that fiction into every
  session touching the CLI.

- **Observation:** The `CLAUDE.md` Track 8 added to `plugins/claude/` was the one place it could not go.
  **Evidence:** `claude plugin validate plugins/claude` warns "CLAUDE.md at the plugin root is not loaded
  as project context." A plugin folder has no build step and no manifest allowlist — `plugin.json` carries
  no packaging field at all — so the folder is copied byte for byte into every user's
  `~/.claude/plugins/cache/`. Verified against two installed plugins that ship one anyway: `context-mode`
  puts both a `CLAUDE.md` and an `.npmignore` in the cache, and our own `vibe-ops` ships a `CLAUDE.md` too.
  Track 8's fix was therefore right for `apps/dot-agent-cli/` and wrong here, for a reason that only exists
  in the plugin folder: the file would ship to users *and* still not load. Replaced with
  `.agents/rules/plugin-claude.md`, `paths`-scoped to `plugins/claude/**` and
  `apps/dot-agent-cli/skills/**` — outside the shipped folder, and it loads when the work touches either
  copy, which is what the previous entry said the guard needed.

- **Observation:** The "no agent loaded" reply on the templated resources returns an empty `uri`.
  **Evidence:** `mcp-run.ts` built it as `{ uri: uri.href, ...noAgent().contents[0] }`, and the `text()`
  helper it spreads sets `uri: ''` — the spread comes second, so it overwrites the real URI. `tsc --noEmit`
  had been flagging it as TS2783 the whole time; the build runs `tsdown`, which does not typecheck, so
  nothing surfaced it. That is the exact path a session hits before `load_agent` — the plugin's first
  interaction. Fixed by reversing the spread order, together with two TS2322s in the session-init callbacks.
  **Worth generalizing:** `npm test` passing says nothing about types here.

- **Observation:** A zero-byte file counted as instruction-file debt was actually a shipped artifact.
  **Evidence:** `apps/dot-agent-cli/templates/AGENTS.md` looked like one more nested `AGENTS.md` to clear.
  `templates/` is the scaffold `init` copies, and `init.ts` walks it with `readdir` rather than an explicit
  file list — so the empty file was being written into every project created with `dot-agent init`.
  Deleting it was right for a reason unrelated to the one it was listed under. Worth checking what a folder
  *is* before acting on what its filenames suggest.

- **Observation:** A plugin-provided MCP server's tools are namespaced under a `plugin_<plugin-name>_`
  prefix — `mcp__plugin_dot-agent_dot-agent__load_agent`, not the bare `mcp__dot-agent__load_agent` a
  directly-configured (non-plugin) server of the same name would get. This resolves the question
  [ADR-DA00-08's log](../pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md) left open —
  a plugin server and a same-named user-config server don't collide at the tool-name level at all; they
  are simply two distinct, differently-prefixed tool families. Matches the `chrome-devtools` /
  `plugin_chrome-devtools-mcp_chrome-devtools` pair observed independently on the same machine.
  **Evidence:** Live end-to-end test of `configure --claude` (2026-07-31): after cleanup, only
  `plugin:dot-agent:dot-agent` and `plugin:dot-agent:dot-agent-helper` were connected, both fully
  functional (7 resources each, the former also carrying the four authoring tools — `dot-agent-dev`'s
  tools didn't disappear, they live at `mcp__plugin_dot-agent_dot-agent__*` now, same server as before,
  different qualified name).
  **This caught a real bug:** both `SKILL.md` copies (`plugins/claude/skills/run/`,
  `apps/dot-agent-cli/skills/run/`) hardcoded the bare form, `mcp__dot-agent__load_agent` — correct only
  for a machine that still had a legacy, directly-written `~/.claude.json` entry masking the mismatch.
  Once `configure --claude` starts *removing* that entry (this same PR), every user is left with only the
  plugin-qualified name, and the skill's own instruction to itself would have named a tool that doesn't
  exist. Fixed by hardcoding the correct qualified name in both copies instead — pinning it is fine here
  precisely because the plugin's `name` field (and therefore the prefix) is fixed for the sanctioned
  install path, and a skill can't be invoked at all without the plugin that ships it being enabled.

- **Observation:** The cold-start path — the one every user who is not the maintainer takes — fails today,
  and Track 4's gate is therefore wider than "publish `@dot-agent/cli`": the marketplace manifest has to
  reach `main` too.
  **Evidence:** `configure --claude` on a machine with no `dot-agent-spec` marketplace runs `claude plugin
  marketplace add dot-agent-spec/platform --sparse .claude-plugin plugins`, which clones the repository's
  **default branch**. `origin/main` carries neither `.claude-plugin/` nor `plugins/` — both live only on
  the unmerged branch this work is on — so the host exits 1 with *"Marketplace file not found at
  …/marketplaces/dot-agent-spec-platform/.claude-plugin/marketplace.json"*. Reproduced 2026-07-31 against
  the real GitHub remote with `CLAUDE_CONFIG_DIR` pointed at an empty directory. Nothing about this is
  visible from the maintainer's machine: `installHostPlugin` skips `addMarketplace()` whenever a
  marketplace of that name already exists, and a contributor's local `directory`-source entry satisfies
  that check forever. Neither can the unit tests see it — they stub the `claude` binary, so it is a
  repository-state problem their mocks define away.

- **Observation:** A failed marketplace/plugin install leaves the legacy `~/.claude.json` entries in
  place. The install and the cleanup are not independent halves.
  **Evidence:** `configurePluginTarget` awaits `installHostPlugin(target)` before
  `removeLegacyMcpEntries(...)`, so a throw from the first skips the second entirely — observed in the
  cold-start reproduction above, which exited 1 having removed nothing. This ordering is the *safe* one
  and should stay: stripping a user's only working dot-agent MCP config when its replacement failed to
  install would leave them with neither. But it is currently a property of statement order that nothing
  states and no test pins, and the migration story in
  [ADR-DA00-08](../adr/DA00-08-cli-installs-native-host-plugins.md) reads as though the cleanup is
  unconditional.

- **Observation:** `CLAUDE_CONFIG_DIR` isolates the host's plugin state, which makes the cold-start branch
  testable on a machine that already has the marketplace — but it does **not** isolate what this CLI
  writes.
  **Evidence:** Pointed at an empty directory, `claude plugin marketplace list` returns `[]` and the host
  creates its own `.claude.json`/`plugins/` tree there, so the `!existing → addMarketplace()` branch runs
  for real. `legacyConfigPath` is `join(homedir(), '.claude.json')` and ignores the variable, so the
  legacy cleanup still targets the real file. Harmless in that run — the entries were already gone, and
  `removeLegacyMcpEntries` writes nothing when it finds nothing (verified: identical `shasum` either
  side) — but anyone reusing this isolation trick on a machine that still has legacy entries would have
  them deleted for real while believing the whole run was sandboxed.

- **Observation:** "Nothing outside `mcpServers` changed" cannot be verified by diffing the rest of
  `~/.claude.json` on a machine with a live session.
  **Evidence:** Claude Code mutates `pluginUsage.<plugin>.usageCount` and `.lastUsedAt` on its own while a
  session runs — the counter moved 39370 → 39385 between two consecutive reads with no `configure` and no
  `claude` invocation in between. The obvious check, `diff <(jq 'del(.mcpServers)' backup) <(jq
  'del(.mcpServers)' live)`, therefore never comes back empty and reads as though the command touched
  unrelated state. Exclude `pluginUsage` as well when re-running this verification.

## Decision Log

- **Decision:** `dot-agent configure --claude` installs the native Claude Code plugin (shells out to
  `claude plugin marketplace add`/`install`) and deletes any dot-agent MCP entries a previous CLI run left
  in `~/.claude.json`, instead of writing those entries itself. `--skill`/`--mcp` no longer apply to
  `--claude`. `gemini`/`murici` are unaffected — they still write files directly, having no plugin format.
  **Rationale:** A plugin manifest is declarative and strictly additive — it can never remove a config
  entry a different tool wrote. Config `configure` wrote therefore only ever aged (verified: a real
  `~/.claude.json` on this machine sat two CLI-layout renames behind), and Claude Code doesn't de-duplicate
  a plugin server against a same-named user-config one, so the write was never a harmless fallback. Full
  reasoning, live evidence and the framings rejected first (CLI-as-migration-mechanism,
  detect-via-undocumented-internal-file, guidance-only):
  [ADR-DA00-08](../adr/DA00-08-cli-installs-native-host-plugins.md) +
  [its log](../pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md).
  **Date / Author:** 2026-07-30 / Danilo

- **Decision:** `dot-agent configure --claude` no longer installs a skill file. Claude Code gets the skills
  from the plugin; the command keeps only its MCP-registration half and reports the plugin install commands
  when a skill is asked for. Other hosts are untouched — gemini/AGY still get the copied file, murici still
  has no skill concept.
  **Rationale:** Resolves the third open question by removing the Claude branch rather than renaming its
  destination. A copied `~/.claude/skills/dot-agent/SKILL.md` is a second, unversioned copy of a file the
  plugin already delivers — a third drift surface next to the two the plan already tracks — and it is
  invoked as a bare `/dot-agent`, colliding conceptually with `/dot-agent:run` while carrying the same
  content. Renaming the destination would have kept every one of those problems and only fixed the path.
  **Date / Author:** 2026-07-30 / Danilo

- **Decision:** Guidance for `plugins/claude/` lives in a `paths`-scoped rule under `.agents/rules/`, never
  in a `CLAUDE.md` inside the plugin folder.
  **Rationale:** The folder is the distribution — see the corresponding *Surprises* entry. A rule outside it
  ships nothing to users and actually loads when work touches the folder, which a nested `CLAUDE.md` at a
  plugin root does neither of. This constrains every future host plugin under `plugins/`, not just this one.
  **Date / Author:** 2026-07-30 / Danilo

- **Decision:** Migrate `project/tasks/DA00-07-dot-agent-claude-skill.md` into this plan and delete the
  task file.
  **Rationale:** The document had three items shipped and three on an open-ended roadmap, so it would never
  reach the single "done, delete it" moment a task lifecycle requires — a task still holding open roadmap
  items long after its first item shipped is a plan wearing the wrong template. It had also grown a
  priority table, per-item Result sections and an implementation order, which is a plan's living record
  improvised inside a task. Keeping both files would reintroduce exactly the two-copies-drift problem
  [Plan-001](001-adopt-vibe-ops-baseline.md) spent its whole length removing; git history holds the
  original at `git show 68ac4db:project/tasks/DA00-07-dot-agent-claude-skill.md`.
  **Date / Author:** 2026-07-30 / Danilo

- **Decision:** Drop the HTTP endpoint for the runtime entirely, rather than deferring it.
  **Rationale:** It existed as a workaround for `claude mcp add` not taking effect mid-session. Declaring
  the servers in the plugin manifest removes the need, and keeping a second transport alive would mean
  maintaining two paths to the same runtime for no remaining reason.
  **Date / Author:** preserved from the source task

- **Decision:** Defer the `UserPromptSubmit` hook that would drive `tick_prompt`, after scoping it for v1.
  **Rationale:** See the corresponding entry under *Surprises & Discoveries* — a shell hook cannot know
  whether an agent is loaded or address a specific tool on a specific connection. The candidate replacement
  is a `dot-agent tick` subcommand plus a local channel the running runtime honors. Recorded as decision 4
  in the [DA00-07 log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
  **Date / Author:** preserved from the source task

- **Decision:** Bundle no runtime with the plugin; depend on the single globally-installed `dot-agent` CLI,
  which the skill's Step 0 installs on first use.
  **Rationale:** Nothing vendored means nothing to keep in sync with the published package beyond the
  version gate in Track 4. Recorded as decision 2 in
  [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
  **Date / Author:** preserved from the source task

## Outcomes & Retrospective

Tracks 1 through 3 are shipped; the plugin loads and drives an arbitrary `.agent` inside this repository.
Track 4 is the one thing between that and it working for anyone else, and it is deliberately not bundled
into Track 3 — a repository-complete feature and a released feature are different states, and conflating
them is how something ships that nobody can install.

Preserved from the source task as its own finding: Track 2 shipped a plugin that could not actually run a
user's agent, and the note recording that was written into the task before Track 3 closed the gap. It is
kept here rather than tidied away, because the shape of the mistake — declaring the servers that were easy
to declare and discovering only afterwards that the one that mattered could not be declared at all — is
the reason the connect-time constraint above is worth remembering.

---

## Open questions

- Does a background monitor's log line interrupt the current turn or surface on the next one? Track 7
  cannot choose its mechanism until this is answered empirically.
- Should the `lspServers` authoring lane (Track 6) live in this plugin or a separate authoring-focused
  one? Running an agent and authoring one are different audiences with different context budgets.
- Gemini/AGY still receive a copied `SKILL.md` at `~/.gemini/config/skills/dot-agent/SKILL.md`, which is
  now the only host where the CLI installs a skill file. Whether that host grows a plugin mechanism worth
  adapting to — the generalization [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md)
  anticipates — is open; until then it stays a copy, and it is a fourth surface the comportment text can
  drift on.

*(Resolved: whether `configure --claude` should keep installing a skill — see the Decision Log.)*

## Related

- [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) — the decision, and its
  [long-form log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
- [DA00-08](../adr/DA00-08-cli-installs-native-host-plugins.md) — `configure --claude` installs the plugin
  instead of writing its config, and its
  [long-form log](../pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md).
  [platform#27](https://github.com/dot-agent-spec/platform/issues/27) tracks it upstream.
- [Plan-001](001-adopt-vibe-ops-baseline.md) — Track 8 here closes that plan's Track 3 items for
  `apps/dot-agent-cli/` and `plugins/claude/`.
- [platform#20](https://github.com/dot-agent-spec/platform/issues/20) — documentation corrections in
  `docs/reference/kernel-dsl.md` and `dsl/reference/description.md`, surfaced by a sync review of
  `apps/dot-agent-cli/helper-src/`. Touched a folder this plan owns but was independent work with its own
  acceptance; closed as its own task (`project/tasks/reference-doc-drift.md`, now deleted — breadcrumb on
  the issue), not folded into this plan.
- Tracking issue [#13](https://github.com/dot-agent-spec/platform/issues/13).
- `murici` `lib/runtime/dot-agent-injector.ts` — prior art for injecting agent directives into a host,
  cited by the source task.
