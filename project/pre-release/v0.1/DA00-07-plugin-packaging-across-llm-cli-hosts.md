<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# LOG-DA00-07: dot-agent as a Claude Code Plugin (reference implementation for the host-plugin pattern)

| Field | Value |
|---|---|
| Status | In Progress — P0, P1, P2 done in code (see Current State); P3 (Rust runtime) and roadmap items open |
| Date | 2026-07-27 |
| Deciders | Danilo Borges |
| Related | — |

This is the long-form appendix to [DA00-07](../../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
The ADR records the generalized decision (per-host plugins, shared comportment core); this log carries
the full reasoning and implementation detail from the Claude Code reference implementation, most of
which was too rich for the ADR's Context/Consequences sections and didn't fit the terse GitHub tracker
issue ([platform#13](https://github.com/dot-agent-spec/platform/issues/13)) either.

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) | cli (L4) |
|---|---|---|---|---|---|
| — | — | — | — | — | ✏️ |

(`cli` above covers `apps/dot-agent-cli`; the new `plugins/claude/` plugin itself isn't in this table's
scheme — see Current State.)

## Goal

A **generic skill/plugin** that loads and runs **any `.agent`**, distributable on the marketplace
("download and run"). The user sends "load this agent and follow its flow, let's start" and Claude
begins **following the agent's directives**. Fridge Assistant is the test case, not the target.

## The three-layer decoupling

The `.agent` bundle is the stable contract between layers, so runtime and transport decisions do not
block each other:

```
Layer 1 — FORMAT   (.agent bundle)       ← stable contract, already exists
Layer 2 — RUNTIME  (executes the .agent) ← Node+WASM, bundled straight into the plugin; Rust later
Layer 3 — DRIVING  (Claude ↔ runtime)    ← MCP, bundled + auto-registered by the plugin manifest
```

## The core problem — role framing

When the earlier CLI skill was run under `agy`, the LLM collapsed roles: it read the FSM's
`guide`/`teach` output as *commands for itself to execute*, instead of using the FSM as a dynamic script
to interact with the human. This is a **driving-surface framing bug, not a kernel bug**. Murici already
fixes it in `lib/runtime/dot-agent-injector.ts`: `<PERSONA>`/`<RULES>` go into the system prompt at max
salience, and FSM state (`goal`/`guide`/`teach`/`allowed_intents`) is injected as a *simulated tool
result* (`get_current_state`) — never as the user speaking; the model's only lever on the FSM is a
`trigger_intent` tool whose `intent_name` is enum-constrained to valid intents. The organizing metaphor:
**an FSM is a dynamically state-selected SKILL.md** — each state is the active section of the
instructions. Comportment is **independent of transport and of surface**, so the same `comportment.md`
serves murici (host), the CLI skill (MCP), and every host plugin (MCP, bundled).

## Not just a CLI wrapper

The first pass at this plugin was "SKILL.md that shells out to the CLI" — functional, but it leaves
Claude Code capabilities unused that solve real problems already hit during the Fridge E2E test. See the
platform's [plugin reference](https://code.claude.com/docs/en/plugins#develop-more-complex-plugins):

- **`mcpServers` in `plugin.json`** auto-starts and auto-registers the MCP server the moment the plugin
  is enabled — no `claude mcp add` (which doesn't take effect mid-session) and no manual
  `dot-agent-cli configure` step.
- **A `UserPromptSubmit` hook** fires once per turn, before Claude sees the message, and can shell out
  deterministically — the mechanism candidate for `tick_prompt` (deferred, see decision 4 below).
- **`lspServers`** gives Claude live diagnostics/go-to-def while editing `.description`/`.behavior`
  files, if pointed at our own language-server — an authoring-side capability, orthogonal to running an
  agent (roadmap).
- **Background monitors** (`monitors/monitors.json`: `name` + a persistent `command` + `description`)
  run a shell command (e.g. `tail -F`) and deliver each stdout line to Claude as a notification during
  the session — no special flag or org allowlist, unlike Channels. The gap: the runtime doesn't currently
  emit anything a monitor could tail when the engine drives its own transition (`on event`,
  `after N prompts`) — roadmap.
- **Channels** (`claude/channel` MCP capability) push a message into Claude's context without polling,
  but are research preview — a fallback if monitors turn out not to fit, not the first choice.

## Settled decisions (with rationale)

1. **Execution substrate:** real deterministic FSM via the runtime — **not** static markdown. Guardrails
   (e.g. "only suggest recipes in the catalog", offtopic detection) depend on the FSM actually applying
   transitions; loose markdown would let the model drift exactly where the guide is trying to prevent it.
2. **Runtime (Layer 2): one installed CLI, never a second copy. Rust on the roadmap.** Two alternatives
   were considered and dropped. (a) *Compiling a standalone per-platform binary* (Bun `--compile`):
   neither reference plugin in daily use here needs it — context-mode ships a plain esbuild JS bundle
   invoked via `command: "node"`, and graphify shells out to a system Python install rather than
   vendoring a binary. Node is the baseline runtime Claude Code plugins already assume, and embedding the
   five `.wasm` artifacts (`kernel-dsl`, `parser-dsl`, two tree-sitter grammars, the `web-tree-sitter`
   runtime) would have forced an additive-API cascade across four published packages. (b) *Vendoring the
   CLI's built `dist/cli.mjs` into the plugin*: solves the runtime question but creates a second copy of
   the same code that drifts from the published package. **Settled: the plugin depends on the one
   globally-installed `dot-agent` CLI** (`command: "dot-agent"`, resolved on PATH), and the skill installs
   it on first use (`npm i -g @dot-agent/cli`) the way graphify's SKILL.md bootstraps its own binary.
   Single source of truth, no build step, no drift. The `.agent` format still decouples Layer 2 from
   Layer 3, so a later Rust rewrite remains a free, reversible drop-in behind the same wire contract. This
   is the decision [DA00-07](../../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) generalizes
   across every future host plugin (Codex, Antigravity).
3. **Driving surface (Layer 3): MCP only, bundled and auto-registered by the plugin manifest.** An
   earlier draft of this decision added a plain-JSON HTTP endpoint (`POST /intent`, `GET /state`) to
   dodge driving MCP streamable-http via curl from a SKILL.md. That workaround turned out unnecessary
   once the plugin declares `mcpServers` in `plugin.json`: the server starts and registers itself the
   moment the plugin is enabled, so Claude talks to it as a normal MCP tool — no curl, no
   handshake-by-hand, no manual `claude mcp add` (which doesn't take effect mid-session — confirmed
   during the Fridge E2E test, the reason the HTTP workaround was drafted in the first place). Dropped
   from the plan; re-litigated once more later in the project and reconfirmed for the same reason.
4. **`tick_prompt` is hook-driven, not LLM-driven — deferred out of v1.** `after N prompts` needs the
   prompt counter ticked once per turn; asking the driving LLM to remember a `tick_prompt` call every
   turn burns context and depends on memory, defeating the point of a deterministic FSM. A
   plugin-bundled `UserPromptSubmit` hook (fires before Claude sees each message, can shell out) was the
   intended mechanism — settled in principle, but deferred during P2: `tick_prompt` is a runtime tool
   that only does something once an agent is loaded (see the Runtime holder below), and a shell hook
   still has no way to know that state or call a specific tool on a specific connection.
   `after N prompts` stays a documented degradation on this surface until a proper tick channel is
   designed (candidate: a `dot-agent tick` subcommand + a local channel the running runtime honors).
5. **`guide` vs `teach`:** `guide` = **short** behavior directive (rides in the per-turn payload);
   `teach` = **bulky** knowledge (command lists, detailed steps) in `knowledge/*.md`, fetched on demand.
   Bonus: dynamic, state-gated slicing (only the current state's teach loads).
6. **Default comportment = Mode A (embody + interact with the human).** Collapses the earlier "Emulation
   Mode" and removes the "autonomous executor" stance that caused the agy bug. Rules: embody the
   `.description` persona; at a state awaiting human input (has intents / `request_interact`) converse
   toward the `goal` using guide+teach, map the reply to an intent (or offtopic), then pause and wait; at
   a pure transition, advance silently; **never** execute guide/teach as commands (command-text is
   presented to the human); **never** reveal the intent signal.
7. **Publish-agent (converting the real `/publish` skill):** a **deterministic guide**, **zero
   execution**, commands as **text** (v0.1: the FSM only controls states). Mandatory `interact` gates
   before irreversible steps (tag push → npm publish). The FSM's value here is topological ordering +
   confirmation gates, not automating the irreversible trigger.

## Usage taxonomy (two axes)

**Axis 1 — Surface (who drives):** Skill-driven (Claude) · Host-embedded (an app, e.g. murici) ·
Standalone MCP/CLI (external client).

**Axis 2 — Comportment (how the LLM behaves):**

| Mode | Comportment | Human? | Examples | Destination |
|---|---|---|---|---|
| **A. Persona / Embodiment** | becomes the agent, converses toward the goal | yes | Fridge, mentor, **Publish** (procedural sub-flavor) | **plugin default skill** |
| **B. Autonomous drive** | LLM plays both sides to exercise the FSM | no | E2E / CI / authoring validation | **2nd skill in the same plugin** |
| **C. Knowledge navigation** | librarian; surfaces teach by navigating states | yes | Helper | **≡ a flavor of A** |
| **D. System / headless** | stateless transformer: input → tool call | no | murici background-agent | **out** (host-embedded; ≡ a no-interact state) |

- **C ≡ A:** its value (dynamic state-gated slicing) is a teach-delivery property, not new comportment.
  Helper also doubles as a DSL teaching example — a docs role, orthogonal.
- **D out:** the driver is the host, not Claude. Headless ≡ a minimal no-interact state that guide+teach
  replicate → not architecturally special. It is tooling; document it in the SDK, do not ship it as a
  skill.

## Current State (verified against source 2026-07-27)

**P0 — Evolve the CLI skill (done, commit `fdca20b`).** Reconciled the CLI skill's two contradictory
stances — the "MCP interaction loop" (autonomous driver) and "Agent Simulation / Emulation Mode"
(proxy/echo) — into a single **Mode A** comportment, plus a **"how to behave with what you receive"**
section. `dsl/reference/comportment.md` is the canonical, transport-neutral spec;
`apps/dot-agent-cli/skills/run/SKILL.md` mirrors it. Tested end-to-end against Fridge Assistant, live and
human-in-the-loop — found and fixed 7 comportment gaps (state-bleed across dwells, silent no-op on
unhandled `send_offtopic`, offtopic-vs-unmatched-intent conflation, grounding elasticity, trust boundary
for third-party `.agent` authors, end-of-flow handling, multi-hop routing).

**P1 — Plugin manifest: MCP auto-registration (done).** `plugins/claude/.claude-plugin/plugin.json`
declared `mcpServers` for two agent-agnostic servers (`dot-agent-dev`, `dot-agent-helper`), replacing the
manual `dot-agent-cli configure` step. At this point the per-agent runtime server still required a chosen
`.agent` before it could start, so the plugin could not yet run a user's agent — the actual headline use
case had no working path. P2 closed that gap.

**P2 — Assemble the marketplace plugin (done).** The core mechanism: `mcp-run.ts`'s tools/resources now
close over a mutable `Runtime` holder (`{ session?, bundle? }`) instead of a fixed session, so they
register once at boot — reporting "no agent loaded" until a new `load_agent(source)` tool fills the
holder. A second `load_agent` call replaces whatever was loaded, which doubles as "restart the flow"
without a new process. This is what makes "load this agent and follow its flow" work at all from a
static, connect-time tool list: Claude Code fixes a server's tool list when it connects, and cannot
attach to a server shelled out mid-session (`claude mcp add` mid-session doesn't take effect — confirmed
during the Fridge E2E test).

`dot-agent-dev` (4 authoring tools, zero resources, zero prompts — verified) was folded into the runtime
server and renamed `dot-agent`; `dot-agent-helper` stays separate since it is itself a loaded agent (it
would evict itself if folded in). Both `SKILL.md` copies (`plugins/claude/skills/run/`,
`apps/dot-agent-cli/skills/run/`) were updated to describe `load_agent` instead of the earlier, non-working
"launched on demand" claim, and kept byte-identical (`plugins/claude/AGENTS.md` records the invariant and
the `diff` command to verify it). A new `plugins/claude/skills/test/SKILL.md` (Mode B) points back at the
Mode A skill for comportment instead of duplicating it, adding only the one behavioral delta (synthesize
the human's turn) and a subagent-isolation caveat: a subagent sharing the main thread's MCP connection
would evict its loaded agent by calling `load_agent`. A root `.claude-plugin/marketplace.json`
(`"source": "./plugins/claude"`) makes the plugin installable via
`/plugin marketplace add dot-agent-spec/platform`.

Both plugin skill folders were renamed during this pass (`skills/dot-agent` → `skills/run`,
`skills/dot-agent-test` → `skills/test`) to drop a naming stutter: since the plugin itself is also named
`dot-agent`, a skill folder of the same name invoked as `/dot-agent:dot-agent` in Claude Code — confusing
and redundant. `configure.ts`'s global skill-install destination (`~/.claude/skills/dot-agent/SKILL.md`)
was deliberately left unrenamed — an open question about whether that CLI-side install path should still
exist now that the plugin supersedes it, not decided as part of this pass.

**No runtime is bundled** — per decision 2 the plugin keeps depending on the single globally-installed
`dot-agent` CLI, which the skill's Step 0 installs on first use. Nothing vendored, nothing to keep in
sync with the published package beyond the release gate below.

**Release gate (not yet done):** the plugin's Step 0 installs `@dot-agent/cli` from npm, so `load_agent`
only exists for real users once that package is published with this change. As of this log, the plugin
has only been verified on the maintainer's machine via `npm link`; both the npm publish and the
maintainer's own manual test of the installed plugin remain outstanding before this is considered
release-ready.

**P3 — Rust runtime (roadmap, not started).** Reimplement the runtime host in Rust behind the same
`(state, intent) → (state, effects)` wire contract — a drop-in swap of the Layer 2 entrypoint; the plugin
manifest's `mcpServers.command` would just point at a different bundled executable.

**Roadmap (unscheduled):** `lspServers` for `.description`/`.behavior` authoring diagnostics (a distinct,
*authoring* lane, not the *running* lane this log covers — may end up in this same plugin or a separate
authoring-focused one); a background monitor (or Channels fallback) so an engine-driven transition
(`on event`, `after N prompts` firing on its own) surfaces immediately instead of only on the next
`dot-agent://state` re-read — the current re-read-on-every-turn approach already works, so this is polish,
not a fix, and needs a delivery-timing spike before committing to a mechanism.

**Deferred:** Mode D (system/headless) stays SDK/host documentation, not a skill — the driver there is
the host, not Claude. v2 multi-management (skills embedding their own `.agent` for micro-orchestration)
is out of scope for this pass.

## What this generalizes to (Codex, Antigravity)

Everything above that is Claude-Code-specific lives in `plugins/claude/` — the manifest shape
(`plugin.json`'s `mcpServers`/`skills` keys), the `/dot-agent:run` and `/dot-agent:test` slash-command
naming, and the `/reload-plugins` restart caveat. Everything else — `comportment.md`, the single
globally-installed-CLI rule, the `Runtime` holder pattern, the Mode A/B split — is host-neutral and is
exactly what [DA00-07](../../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) expects a future
`plugins/codex/` or the already-reserved `apps/agy/` to reuse rather than reinvent.
