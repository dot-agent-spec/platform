<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

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
  separately in `project/tasks/reference-doc-drift.md`; those are documentation corrections against the
  grammar and the kernel, independent of this plan's delivery.

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

For Track 8, from the repository root, each of the two folders has a `CLAUDE.md` whose only content is
`@AGENTS.md`, and `<vibe-ops-plugin-dir>/scripts/check-agents-md.sh` reports no `links` failure under
`apps/dot-agent-cli/` or `plugins/claude/`.

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
  - [x] `apps/dot-agent-cli/src/mcp-run.ts`: tools and resources close over a mutable `Runtime` holder
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
- [ ] **Track 4 — publish `@dot-agent/cli`.** Not done. This is what stands between the plugin working in
      the repository and working for anyone else.
- [ ] **Track 5 — Rust runtime.** Roadmap, unscheduled.
- [ ] **Track 6 — `lspServers` for authoring.** Roadmap, unscheduled.
- [ ] **Track 7 — engine-driven transitions.** Roadmap, unscheduled; needs the delivery-semantics spike
      before either mechanism is chosen.
- [ ] **Track 8 — instruction-file debt.** Not started.
  - [ ] `apps/dot-agent-cli/` — review `AGENTS.md` (115 lines) against the current CLI surface, then add
        `CLAUDE.md` containing `@AGENTS.md`.
  - [ ] `apps/dot-agent-cli/templates/AGENTS.md` — zero bytes; delete unless that folder genuinely needs one.
  - [ ] `plugins/claude/` — review `AGENTS.md` (48 lines), then add `CLAUDE.md` containing `@AGENTS.md`.

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

- **Observation:** A `UserPromptSubmit` hook cannot drive `tick_prompt`, even though both exist and the
  pairing looks obvious.
  **Evidence:** `tick_prompt` only does something once an agent is loaded — that is, once the `Runtime`
  holder is filled — and a shell hook has no way to know that state or to call a specific tool on a
  specific connection. `after N prompts` therefore remains a documented degradation on this surface until a
  proper tick channel exists.

- **Observation:** The two `SKILL.md` copies this plan created are byte-identical but not symlinked, and
  nothing in the repository checks that they still match.
  **Evidence:** an unrelated sync of `apps/dot-agent-cli/helper-src/` found both copies telling the driving
  LLM to navigate to a `generate` intent that the helper actually names `gen`. The duplication did not
  cause that drift, but it does mean every fix must land twice with no failure if it lands once — the
  reviewer only noticed because the subagent prompt had been updated to say "edit both, then `diff` them".
  The `.agents/` ↔ `.claude/` symlink convention used everywhere else in this repo is not available here:
  the plugin folder has to be self-contained to be installable from the marketplace. So the copy stays,
  and the guard has to be a check rather than a link.

## Decision Log

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

## Related

- [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) — the decision, and its
  [long-form log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
- [Plan-001](001-adopt-vibe-ops-baseline.md) — Track 8 here closes that plan's Track 3 items for
  `apps/dot-agent-cli/` and `plugins/claude/`.
- `project/tasks/reference-doc-drift.md` — documentation corrections in `docs/reference/kernel-dsl.md` and
  `dsl/reference/description.md`, surfaced by a sync review of `apps/dot-agent-cli/helper-src/`. It touches
  a folder this plan owns but is independent work with its own acceptance, so it stays a task.
- Tracking issue [#13](https://github.com/dot-agent-spec/platform/issues/13).
- `murici` `lib/runtime/dot-agent-injector.ts` — prior art for injecting agent directives into a host,
  cited by the source task.
