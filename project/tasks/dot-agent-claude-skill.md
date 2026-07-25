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
| Status | Planned |
| Created | 2026-07-16 |
| Author | Danilo |
| Sources | Issue [#13](https://github.com/dot-agent-spec/platform/issues/13) (tracker); design interview 2026-07-16; murici `lib/runtime/dot-agent-injector.ts`; existing CLI skill `apps/dot-agent-cli/.../skills/dot-agent/SKILL.md` |

---

## Context

Goal: a **generic skill/plugin** that loads and runs **any `.agent`**, distributable on the
marketplace ("download and run"). The user sends "load this agent and follow its flow, let's start"
and Claude begins **following the agent's directives**. Fridge Assistant is the test case, not the target.

The design rests on a **three-layer decoupling**, where the `.agent` bundle is the stable contract
between layers, so runtime and transport decisions do not block each other:

```
Layer 1 — FORMAT   (.agent bundle)       ← stable contract, already exists
Layer 2 — RUNTIME  (executes the .agent) ← Node+WASM, bundled straight into the plugin; Rust later
Layer 3 — DRIVING  (Claude ↔ runtime)    ← MCP, bundled + auto-registered by the plugin manifest
```

**The core problem this task solves — role framing.** When the current CLI skill was run under
`agy`, the LLM collapsed roles: it read the FSM's `guide`/`teach` output as *commands for itself to
execute*, instead of using the FSM as a dynamic script to interact with the human. This is a
**driving-surface framing bug, not a kernel bug**. Murici already fixes it in
`lib/runtime/dot-agent-injector.ts`: `<PERSONA>`/`<RULES>` go into the system prompt at max salience,
and FSM state (`goal`/`guide`/`teach`/`allowed_intents`) is injected as a *simulated tool result*
(`get_current_state`) — never as the user speaking; the model's only lever on the FSM is a
`trigger_intent` tool whose `intent_name` is enum-constrained to valid intents. The organizing
metaphor: **an FSM is a dynamically state-selected SKILL.md** — each state is the active section of
the instructions. Comportment is **independent of transport and of surface**, so the same
`comportment.md` serves murici (host), the CLI skill (MCP), and the marketplace plugin (MCP, bundled).

**Not just a CLI wrapper.** The first pass at this plugin was "SKILL.md that shells out to the CLI" —
functional, but it leaves Claude Code capabilities unused that solve real problems we already hit
during the Fridge E2E test. See the platform's [plugin
reference](https://code.claude.com/docs/en/plugins#develop-more-complex-plugins):

- **`mcpServers` in `plugin.json`** auto-starts and auto-registers the MCP server the moment the
  plugin is enabled — no `claude mcp add` (which doesn't take effect mid-session, see the tick_prompt
  item below) and no manual `dot-agent-cli configure` step.
- **A `UserPromptSubmit` hook** fires once per turn, before Claude sees the message, and can shell out
  deterministically — this is the mechanism for `tick_prompt` (see item 2), turning a "the LLM must
  remember" liability into a guarantee.
- **`lspServers`** gives Claude live diagnostics/go-to-def while editing `.description`/`.behavior`
  files, if pointed at our own language-server — an authoring-side capability, orthogonal to running
  an agent (see the roadmap item).
- **Background monitors** (`monitors/monitors.json`: `name` + a persistent `command` + `description`)
  run a shell command (e.g. `tail -F`) and deliver each stdout line to Claude as a notification during
  the session — no special flag or org allowlist, unlike Channels. Auto-starts with the plugin. Same
  delivery mechanism as the built-in Monitor tool. The gap: the runtime doesn't currently emit anything
  a monitor could tail when the engine drives its own transition (`on event`, `after N prompts`) — see
  the roadmap item.
- **Channels** (`claude/channel` MCP capability) push a message into Claude's context without polling,
  but are research preview (`--dangerously-load-development-channels` or org allowlisting) — a fallback
  if monitors turn out not to fit, not the first choice.

### Settled decisions (with rationale)

1. **Execution substrate:** real deterministic FSM via the runtime — **not** static markdown.
   Guardrails (e.g. "only suggest recipes in the catalog", offtopic detection) depend on the FSM
   actually applying transitions; loose markdown would let the model drift exactly where the guide
   is trying to prevent it.
2. **Runtime (Layer 2): one installed CLI, never a second copy. Rust on the roadmap.** Two
   alternatives were considered and dropped. (a) *Compiling a standalone per-platform binary* (Bun
   `--compile`): neither reference plugin in daily use here needs it — context-mode ships a plain
   esbuild JS bundle invoked via `command: "node"`, and graphify shells out to a system Python install
   rather than vendoring a binary. Node is the baseline runtime Claude Code plugins already assume, and
   embedding the five `.wasm` artifacts (`kernel-dsl`, `parser-dsl`, two tree-sitter grammars, the
   `web-tree-sitter` runtime) would have forced an additive-API cascade across four published packages.
   (b) *Vendoring the CLI's built `dist/cli.mjs` into the plugin*: solves the runtime question but
   creates a second copy of the same code that drifts from the published package.
   **Settled: the plugin depends on the one globally-installed `dot-agent` CLI** (`command: "dot-agent"`,
   resolved on PATH), and the skill installs it on first use (`npm i -g @dot-agent/cli`) the way
   graphify's SKILL.md bootstraps its own binary. Single source of truth, no build step, no drift. The
   `.agent` format still decouples Layer 2 from Layer 3, so a later Rust rewrite remains a free,
   reversible drop-in behind the same wire contract.
3. **Driving surface (Layer 3): MCP only, bundled and auto-registered by the plugin manifest.** An
   earlier draft of this decision added a plain-JSON HTTP endpoint (`POST /intent`, `GET /state`) to
   dodge driving MCP streamable-http via curl from a SKILL.md. That workaround is unnecessary once the
   plugin declares `mcpServers` in `plugin.json`: the server starts and registers itself the moment the
   plugin is enabled, so Claude talks to it as a normal MCP tool — no curl, no handshake-by-hand, no
   manual `claude mcp add` (which doesn't take effect mid-session — confirmed during the Fridge E2E
   test, the reason the HTTP workaround was drafted in the first place). Dropped from the plan.
4. **`tick_prompt` is hook-driven, not LLM-driven.** `after N prompts` needs the prompt counter ticked
   once per turn; asking the driving LLM to remember a `tick_prompt` call every turn burns context and
   depends on memory, defeating the point of a deterministic FSM. A plugin-bundled `UserPromptSubmit`
   hook (fires before Claude sees each message, can shell out) ticks it instead — settled, not merely
   investigated (see item 2).
5. **`guide` vs `teach`:** `guide` = **short** behavior directive (rides in the per-turn payload);
   `teach` = **bulky** knowledge (command lists, detailed steps) in `knowledge/*.md`, fetched on
   demand. Bonus: dynamic, state-gated slicing (only the current state's teach loads).
6. **Default comportment = Mode A (embody + interact with the human).** Collapses the current
   "Emulation Mode" and removes the "autonomous executor" stance that caused the agy bug. Rules:
   embody the `.description` persona; at a state awaiting human input (has intents / `request_interact`)
   converse toward the `goal` using guide+teach, map the reply to an intent (or offtopic), then pause
   and wait; at a pure transition, advance silently; **never** execute guide/teach as commands
   (command-text is presented to the human); **never** reveal the intent signal.
7. **Publish-agent (converting the real `/publish` skill):** a **deterministic guide**, **zero
   execution**, commands as **text** (v0.1: the FSM only controls states). Mandatory `interact` gates
   before irreversible steps (tag push → npm publish). The FSM's value here is topological ordering +
   confirmation gates, not automating the irreversible trigger.

### Usage taxonomy (two axes)

**Axis 1 — Surface (who drives):** Skill-driven (Claude) · Host-embedded (an app, e.g. murici) ·
Standalone MCP/CLI (external client).

**Axis 2 — Comportment (how the LLM behaves):**

| Mode | Comportment | Human? | Examples | Destination |
|---|---|---|---|---|
| **A. Persona / Embodiment** | becomes the agent, converses toward the goal | yes | Fridge, mentor, **Publish** (procedural sub-flavor) | **plugin default skill** |
| **B. Autonomous drive** | LLM plays both sides to exercise the FSM | no | E2E / CI / authoring validation | **2nd skill in the same plugin** |
| **C. Knowledge navigation** | librarian; surfaces teach by navigating states | yes | Helper | **≡ a flavor of A** |
| **D. System / headless** | stateless transformer: input → tool call | no | murici background-agent | **out** (host-embedded; ≡ a no-interact state) |

- **C ≡ A:** its value (dynamic state-gated slicing) is a teach-delivery property, not new
  comportment. Helper also doubles as a DSL teaching example — a docs role, orthogonal.
- **D out:** the driver is the host, not Claude. Headless ≡ a minimal no-interact state that
  guide+teach replicate → not architecturally special. It is tooling; document it in the SDK, do not
  ship it as a skill.

### Package

A Claude Code **plugin** `dot-agent` — `plugin.json` declaring:
- `skills`: Mode A (default) + Mode B (autonomous test)
- `mcpServers`: the runtime, auto-started and auto-registered on enable — no separate `configure` step
- `hooks`: `UserPromptSubmit` → ticks `tick_prompt` once per turn, deterministically — deferred out of
  v1 (see decision 4 above and item 2's Result)

the "one download" container (as context-mode itself is a plugin). Out of v1 / roadmap: an
`lspServers` entry for `.description`/`.behavior` authoring diagnostics (a different lane —
authoring, not running an agent); a background monitor (or, failing that, Channels) for push-driven
engine transitions; D (SDK/host docs); **multi-management** (skills embedding their own `.agent` for
micro-orchestration) = v2; Rust runtime = later drop-in.

### Open decision — RESOLVED in practice (2026-07-16)

The comportment spec (`<RULES>`) must be a single source of truth so murici + CLI skill + marketplace
skill do not drift (drift = the agy bug returns). Resolution: the canonical text now lives in
`dsl/reference/comportment.md`; the CLI skill (`apps/dot-agent-cli/skills/dot-agent/SKILL.md`) mirrors
it, and the marketplace plugin's skills (P2) copy this section verbatim.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Evolve the CLI skill: single Mode A comportment + "how to behave with what you receive" — **done**, Fridge E2E tested (commit `fdca20b`) | apps/dot-agent-cli (skill) | M |
| 2 | P1 | Plugin manifest: `mcpServers` auto-registration — **done** (`plugins/claude/`); `UserPromptSubmit` hook for `tick_prompt` deferred, see decision 4 | new plugin | M |
| 3 | P2 | Assemble the marketplace plugin (Mode A skill + Mode B skill + bundle the CLI's `dist/cli.mjs` directly, `command: "node"` + agent bundling) | new plugin | L |
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
`skills/dot-agent/SKILL.md` mirrors it. Tested end-to-end against Fridge Assistant, live and
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

**Result:** `plugins/claude/.claude-plugin/plugin.json` + `skills/dot-agent/SKILL.md` (mirrors the CLI
skill). `mcpServers.command` is the PATH-resolved `dot-agent`; the skill's Step 0 installs it on first
use if missing (see decision 2 above). No `hooks` yet: a `UserPromptSubmit` hook to
drive `tick_prompt` (see decision 4 above) was scoped for v1 and then deferred — `tick_prompt` lives on
the per-agent runtime MCP server (stdio, no fixed command, only exists once an agent is loaded), which a
shell hook has no handle to call. `after N prompts` stays a documented degradation on this surface until
a proper tick channel is designed (candidate: a `dot-agent tick` subcommand + a local channel the
running runtime honors).

### 3. Assemble the marketplace plugin — P2

**What:** Package the full Claude Code plugin: add the Mode B autonomous-test skill alongside the
existing Mode A one, plus the `.agent` bundling/loading flow, and publish it through a
`.claude-plugin/marketplace.json` entry.

**Why:** The distributable "one download" unit for the marketplace.

**Change:** Mode A and Mode B share the comportment spec, differ only in the human-in-the-loop vs
autonomous driving section. **No runtime is bundled** — per decision 2 the plugin keeps depending on the
single globally-installed `dot-agent` CLI, which the skill's Step 0 installs on first use. Nothing to
vendor, nothing to keep in sync with the published package.

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
P2: Assemble marketplace plugin (Mode A + Mode B + agent bundling + marketplace.json)
P3: Rust runtime (drop-in, later)

Roadmap (unscheduled): lspServers for .agent authoring; background monitor (or Channels) for engine-driven transitions
Deferred: Mode D SDK/host docs; v2 multi-management (skills embedding their own .agent)
```