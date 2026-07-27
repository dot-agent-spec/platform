<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: dot-agent as a Claude Skill (marketplace plugin)

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-16 |
| Author | Danilo |
| Sources | Issue [#13](https://github.com/dot-agent-spec/platform/issues/13) (tracker); [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (decision) + its [log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (full context, rationale, settled decisions); murici `lib/runtime/dot-agent-injector.ts` |

---

## Context

Goal: a **generic skill/plugin** that loads and runs **any `.agent`**, distributable on the
marketplace ("download and run"). The user sends "load this agent and follow its flow, let's start"
and Claude begins **following the agent's directives**. Fridge Assistant is the test case, not the target.

Full design rationale, the three-layer decoupling, the role-framing bug this solves, the 7 settled
decisions, and the usage taxonomy all moved to
[DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (the decision) and its
[long-form log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (full context) —
this task doc now only tracks work items and status. `dsl/reference/comportment.md` is the canonical,
transport-neutral comportment spec; `apps/dot-agent-cli/skills/run/SKILL.md` and every host plugin's
skill mirror it.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Evolve the CLI skill: single Mode A comportment + "how to behave with what you receive" — **done**, Fridge E2E tested (commit `fdca20b`) | apps/dot-agent-cli (skill) | M |
| 2 | P1 | Plugin manifest: `mcpServers` auto-registration — **done** (`plugins/claude/`); `UserPromptSubmit` hook for `tick_prompt` deferred, see [DA00-07 log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md) decision 4 | new plugin | M |
| 3 | P2 | Assemble the marketplace plugin (Mode A skill + Mode B skill + `marketplace.json`) — **done** | new plugin | L |
| 4 | P3 | Rust runtime (drop-in behind the same wire contract) | packages/kernel-dsl (+ host) | L |
| 5 | Roadmap | `lspServers` for `.description`/`.behavior` authoring diagnostics | new plugin or separate authoring plugin | M |
| 6 | Roadmap | Background monitor for engine-driven transitions (Channels as fallback) | new plugin + apps/dot-agent-cli | M |

---

## Work items

### 1. Evolve the CLI skill — P0 — done

**What:** Reconciled the CLI skill's two contradictory stances — the "MCP interaction loop"
(autonomous driver) and "Agent Simulation / Emulation Mode" (proxy/echo) — into a single **Mode A**
comportment, plus a **"how to behave with what you receive"** section (embody the persona; treat FSM
output as your system-level director for this state, never as user input or a command list; converse
with the human; signal intents silently).

**Result:** `dsl/reference/comportment.md` is the canonical, transport-neutral spec;
`skills/run/SKILL.md` mirrors it. Tested end-to-end against Fridge Assistant, live and
human-in-the-loop — found and fixed 7 comportment gaps (state-bleed across dwells, silent no-op on
unhandled `send_offtopic`, offtopic-vs-unmatched-intent conflation, grounding elasticity, trust
boundary for third-party `.agent` authors, end-of-flow handling, multi-hop routing). Commit `fdca20b`.

### 2. Plugin manifest: MCP auto-registration — P1 — done

**What:** Wrote the plugin's `plugin.json` (`plugins/claude/`) declaring `mcpServers` for the two
agent-agnostic servers (`dot-agent-dev`, `dot-agent-helper`), so they auto-start and auto-register on
enable — replacing the manual `dot-agent-cli configure` step and the `claude mcp add` workaround that
doesn't take effect mid-session.

**Why:** `claude mcp add` requiring a session restart is exactly what forced the HTTP-transport
workaround during the Fridge E2E test — bundling the servers in the plugin manifest removes the problem
instead of working around it.

**Result:** `plugins/claude/.claude-plugin/plugin.json` + `skills/run/SKILL.md` (mirrors the CLI
skill). `mcpServers.command` is the PATH-resolved `dot-agent`; the skill's Step 0 installs it on first
use if missing (see the [DA00-07 log](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md)
decision 2). No `hooks` yet: a `UserPromptSubmit` hook to drive `tick_prompt` (decision 4, same log) was
scoped for v1 and then deferred — `tick_prompt` is a runtime tool that only
does something once an agent is loaded (see item 3's `Runtime` holder), and a shell hook still has no
way to know that state or call a specific tool on a specific connection. `after N prompts` stays a
documented degradation on this surface until a proper tick channel is designed (candidate: a `dot-agent
tick` subcommand + a local channel the running runtime honors).

**Note (superseded by item 3):** at P1 the per-agent runtime server (`send_intent`/`tick_prompt`) still
required a chosen `.agent` before it could start, so this plugin could declare only the two
agent-agnostic servers above — nothing here could actually run a user's agent yet. Item 3 closed that
gap.

### 3. Assemble the marketplace plugin — P2 — done

**What:** Made the plugin able to load and drive *any* `.agent`, added the Mode B autonomous-test
skill, and published both through a root `.claude-plugin/marketplace.json`.

**Why:** P1 shipped a plugin whose only two MCP servers were agent-agnostic (scaffolding + the DSL
helper) — the actual "load this agent and follow its flow" use case had no working path, because the
per-agent runtime server (`dot-agent run <src> --mcp`) can't be launched mid-session and attached to
the way an already-declared `mcpServers` entry can. Claude Code fixes a server's tool list at connect
time; a server that only exists once an agent is already chosen can never be reached from a skill.

**Change:**
- **CLI (`apps/dot-agent-cli`):** `mcp-run.ts`'s tools/resources now close over a mutable `Runtime`
  holder (`{ session?, bundle? }`) instead of a fixed session, so they register once at boot — reporting
  "no agent loaded" until a new `load_agent(source)` tool fills the holder. A second `load_agent` call
  replaces whatever was loaded, which doubles as "restart the flow" without a new process.
  `dot-agent-dev` (4 authoring tools, no agent capability) was folded into one server with the runtime
  and renamed `dot-agent` — `dot-agent-helper` stays separate since it is itself a loaded agent.
- **Plugin:** `plugin.json`'s `dot-agent-dev` entry renamed to `dot-agent`; `README.md`/`AGENTS.md`/both
  `SKILL.md` copies updated to describe `load_agent` instead of the non-working "launched on demand"
  claim; new `skills/test/SKILL.md` (Mode B) that points back at the Mode A skill for
  comportment instead of duplicating it, adds only the one behavioral delta (synthesize the human's
  turn) and a subagent-isolation caveat (a subagent sharing the main thread's connection would evict its
  loaded agent by calling `load_agent`).
- **Marketplace:** root `.claude-plugin/marketplace.json`, `"source": "./plugins/claude"` — installable
  via `/plugin marketplace add dot-agent-spec/platform`.
- **No runtime is bundled** — per [DA00-07](../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md)
  decision 2 the plugin keeps depending on the single globally-installed `dot-agent` CLI, which the
  skill's Step 0 installs on first use. Nothing vendored, nothing to keep in sync with the published
  package beyond the version gate below.

**Release gate:** the plugin's Step 0 installs `@dot-agent/cli` from npm, so `load_agent` only exists
for real users once that package is published with this change — tracked as a follow-up, not done as
part of this item.

### 4. Rust runtime — P3 (roadmap)

**What:** Reimplement the runtime host in Rust behind the same `(state, intent) → (state, effects)`
wire contract.

**Why:** Independence from Node and better performance, without touching any `.agent` or skill.

**Change:** Drop-in swap of the Layer 2 entrypoint; the plugin manifest's `mcpServers.command` just
points at a different bundled executable — no other change.

### 5. `lspServers` for `.description`/`.behavior` authoring — roadmap

**What:** Declare `lspServers` pointing at our own `.behavior`/`.description` language-server (already
exists in the monorepo for the VS Code extension), so Claude gets live diagnostics and go-to-def while
authoring an `.agent`.

**Why:** Distinct from every other item here — this is the *authoring* lane (writing a new `.agent`),
not the *running* lane (driving an existing one). May end up in this same plugin or a separate
authoring-focused one; not decided yet.

### 6. Push notification for engine-driven transitions — roadmap

**What:** When the FSM moves on its own (a global `on event` or an `after N prompts` timer, without
the driving LLM signalling anything), surface that immediately instead of only on the next
`dot-agent://state` re-read. Two candidate mechanisms, in preference order:

- **Background monitor** (preferred): have the runtime append a line to a log file whenever it applies
  an engine-driven transition, and ship a `monitors/monitors.json` entry that `tail -F`s it. No special
  flag or org allowlist needed, unlike Channels — but requires a small runtime change (emit the log
  line) and the delivery-timing semantics (does it interrupt the current turn, or surface on the next
  one?) aren't fully documented; verify empirically before committing to this as the mechanism.
- **Channels** (fallback): MCP server declares `claude/channel` and pushes
  `notifications/claude/channel` directly. No runtime log-file plumbing needed, but research preview —
  requires `--dangerously-load-development-channels` or org allowlisting, a dependency outside our
  control.

**Why not v1 either way:** the current re-read-on-every-turn approach already works (documented in
`comportment.md`) — this is a polish, not a fix, and the preferred mechanism needs a spike to confirm
its delivery semantics before it's worth building on.

---

## Implementation order

```
P0: Evolve CLI skill (single Mode A comportment + comportment.md) + test with Fridge      — done
P1: Plugin manifest (mcpServers auto-registration)                                        — done
P2: Assemble marketplace plugin (load_agent runtime + Mode A + Mode B + marketplace.json) — done
    (npm publish of @dot-agent/cli with this change is a separate release gate, not yet done)
P3: Rust runtime (drop-in, later)

Roadmap (unscheduled): lspServers for .agent authoring; background monitor (or Channels) for engine-driven transitions
Deferred: Mode D SDK/host docs; v2 multi-management (skills embedding their own .agent)
```