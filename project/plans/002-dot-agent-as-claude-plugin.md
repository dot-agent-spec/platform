---
vibe-ops-template: plan@3
---

# Plan-002: dot-agent as a Claude Code Plugin

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-30 |
| Author | Danilo |
| Tracking issue | [#13](https://github.com/dot-agent-spec/platform/issues/13) — owns status and the executive summary; this file owns the design and the working record |
| Related | [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) — the decision, and its Related section carries a `git show` breadcrumb to the long-form log that held the full context, rationale and settled decisions until `project/pre-release/` was retired on 2026-08-13 |

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
[DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md), whose Related section breadcrumbs the
long-form log that carried it before `project/pre-release/` was retired. Preserved from the
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

- [x] **Track 1 — Comportment: one Mode A specification.** `dsl/reference/comportment.md` written as the
      canonical transport-neutral spec, mirrored by the CLI skill, and tested end to end against a real
      agent with a human in the loop — which is what found the seven gaps reading it had not.
- [x] **Track 2 — Plugin manifest: MCP auto-registration.** The two agent-agnostic servers declared in
      `plugin.json`, so nothing has to be added mid-session.
- [x] **Track 3 — The marketplace plugin: run *any* agent.** A mutable `Runtime` holder plus
      `load_agent(source)`, which is the shape the connect-time tool list forces; the marketplace entry at
      the repository root; both skill folders renamed to their verbs.
- [ ] **Track 4 — Release gate: publish `@dot-agent/cli`.** Blocked on two gates, not one: a version bump
      (the published `0.11.1` predates `load_agent`) **and** merging the marketplace manifest to `main`,
      because `marketplace add` clones the default branch. Neither alone makes the cold start work.
- [ ] **Track 5 — Rust runtime.** Roadmap, unscheduled.
- [ ] **Track 6 — `lspServers` for authoring.** Roadmap, unscheduled.
- [ ] **Track 7 — Surfacing engine-driven transitions.** Roadmap, unscheduled; needs the
      delivery-semantics spike before either mechanism is chosen.
- [x] **Track 8 — Instruction-file debt in the folders this plan touches.** Done. The review found the
      files were wrong about more than their links, and one fix — a `CLAUDE.md` at the plugin root — had
      to be reverted for a reason that exists only in a plugin folder.
- [ ] Run `/vibe-ops:close-plan` — the file is kept, as plans are.

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

Pulled in from [Plan-001](./shipped/001-adopt-vibe-ops-baseline.md) Track 3, which asks that a plan touching one of
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
  [DA00-08](../adr/DA00-08-cli-installs-native-host-plugins.md).
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
  **Rationale:** The folder is the distribution — no build step, no manifest allowlist, so it is copied
  byte for byte into every user's plugin cache, and `claude plugin validate` warns that a `CLAUDE.md` at a
  plugin root is not loaded as project context. The file would ship to every user *and* still not load. A
  rule outside it
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
  [Plan-001](./shipped/001-adopt-vibe-ops-baseline.md) spent its whole length removing; git history holds the
  original at `git show 68ac4db4270fa9fb31f21cbe2c1b71b28c0edef3:project/tasks/DA00-07-dot-agent-claude-skill.md`.
  **Date / Author:** 2026-07-30 / Danilo

- **Decision:** Drop the HTTP endpoint for the runtime entirely, rather than deferring it.
  **Rationale:** It existed as a workaround for `claude mcp add` not taking effect mid-session. Declaring
  the servers in the plugin manifest removes the need, and keeping a second transport alive would mean
  maintaining two paths to the same runtime for no remaining reason.
  **Date / Author:** preserved from the source task

- **Decision:** Defer the `UserPromptSubmit` hook that would drive `tick_prompt`, after scoping it for v1.
  **Rationale:** `tick_prompt` only does something once an agent is loaded — that is, once the `Runtime`
  holder is filled — and a shell hook has no way to know that state or to address a specific tool on a
  specific connection, so the pairing that looks obvious cannot be built at all. `after N prompts`
  therefore remains a documented degradation on this surface until a proper tick channel exists. The
  candidate replacement is a `dot-agent tick` subcommand plus a local channel the running runtime honors.
  Recorded as decision 4 in the
  [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
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

### Routing, 2026-08-14

Migrating this plan to `plan@3` drops `## Progress` and `## Surprises & Discoveries`, and the jump's own
rule is that a section goes only once every entry has a destination. Sixteen entries; **three promoted**,
all of them facts about the host rather than about this repository, which is why they went to the
workspace's cross-repository base rather than to any file here:

- The tool list is fixed at connect time — with the three consequences that follow: a server that does not
  exist yet is unreachable from a skill, `claude mcp add` needs a restart, and a plugin's MCP tools carry
  a `plugin_<name>_` segment. The last one caught a real bug: both `SKILL.md` copies hardcoded the bare
  form, which worked only on a machine still carrying a legacy `~/.claude.json` entry that this plan's own
  cleanup removes. `claude plugin details` reporting "MCP servers (0)" over working servers went with it.
- A plugin's skill folder name becomes the command name, so a folder named after the plugin ships
  `/dot-agent:dot-agent`. Invisible until installed, and it generalises to every host adapter.
- `CLAUDE_CONFIG_DIR` isolates the host's plugin state but not a CLI deriving its own path from
  `homedir()`, and `pluginUsage` mutates during a session so diffing `~/.claude.json` never comes back
  clean.

**Discharged rather than promoted**, because a surface here already carries them: the plugin-root
`CLAUDE.md` constraint (the Decision Log entry above, plus `.agents/rules/plugin-claude.md` and the
`pairing` exclusion in `vibeops.config.ts`); the local-path plugin cache not refreshing (already a
workspace entry); and the two `SKILL.md` copies drifting behind a guard that never loaded, which is the
finding Track 8 exists to answer and Plan-001 Track 3 generalised.

**Dropped, out loud:** the `uri`-overwrite bug and the zero-byte template file were one-off defects, now
fixed; `apps/dot-agent-cli/AGENTS.md` not being about the CLI was repo state, corrected; the cold-start
failure and the install-then-cleanup ordering are live findings that belong to **Track 4**, not to a
knowledge base, and the track above now names both gates explicitly so neither is lost with this section.

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
  [DA00-07-plugin-packaging-across-llm-cli-hosts.md).
- [DA00-08](../adr/DA00-08-cli-installs-native-host-plugins.md) — `configure --claude` installs the plugin
  instead of writing its config, and its
  [DA00-08-cli-installs-native-host-plugins.md).
  [platform#27](https://github.com/dot-agent-spec/platform/issues/27) tracks it upstream.
- [Plan-001](./shipped/001-adopt-vibe-ops-baseline.md) — Track 8 here closes that plan's Track 3 items for
  `apps/dot-agent-cli/` and `plugins/claude/`.
- [platform#20](https://github.com/dot-agent-spec/platform/issues/20) — documentation corrections in
  `docs/reference/kernel-dsl.md` and `dsl/reference/description.md`, surfaced by a sync review of
  `apps/dot-agent-cli/helper-src/`. Touched a folder this plan owns but was independent work with its own
  acceptance; closed as its own task (`project/tasks/reference-doc-drift.md`, now deleted — breadcrumb on
  the issue), not folded into this plan.
- Tracking issue [#13](https://github.com/dot-agent-spec/platform/issues/13).
- `murici` `lib/runtime/dot-agent-injector.ts` — prior art for injecting agent directives into a host,
  cited by the source task.
