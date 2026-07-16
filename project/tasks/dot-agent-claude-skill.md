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
| Sources | Design interview 2026-07-16; murici `lib/runtime/dot-agent-injector.ts`; existing CLI skill `apps/dot-agent-cli/.../skills/dot-agent/SKILL.md` |

---

## Context

Goal: a **generic skill/plugin** that loads and runs **any `.agent`**, distributable on the
marketplace ("download and run"). The user sends "load this agent and follow its flow, let's start"
and Claude begins **following the agent's directives**. Fridge Assistant is the test case, not the target.

The design rests on a **three-layer decoupling**, where the `.agent` bundle is the stable contract
between layers, so runtime and transport decisions do not block each other:

```
Layer 1 — FORMAT   (.agent bundle)       ← stable contract, already exists
Layer 2 — RUNTIME  (executes the .agent) ← Node+WASM today; Bun-compile OR Rust
Layer 3 — DRIVING  (Claude ↔ runtime)    ← MCP (exists) + plain-JSON HTTP endpoint (new)
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
the instructions. Comportment is **independent of transport and of surface**, so the same `<RULES>`
serves murici (host), the CLI skill (MCP), and the marketplace skill (HTTP).

### Settled decisions (with rationale)

1. **Execution substrate:** real deterministic FSM via the runtime — **not** static markdown.
   Guardrails (e.g. "only suggest recipes in the catalog", offtopic detection) depend on the FSM
   actually applying transitions; loose markdown would let the model drift exactly where the guide
   is trying to prevent it.
2. **Runtime (Layer 2):** **Bun-compile now, Rust on the roadmap.** The `.agent` format decouples
   them, so Bun today is reversible for free; a later Rust rewrite gives independence + performance
   without touching any skill or agent (drop-in swap behind the same wire contract).
3. **Driving surface (Layer 3):** a **plain-JSON HTTP endpoint** (`POST /intent → {state, effects}`,
   `GET /state`) **alongside** the existing MCP server, reusing `AgentSession` and
   `buildBehaviorStatePayload`. This avoids making a SKILL.md drive MCP streamable-http (initialize
   handshake + `Mcp-Session-Id` + SSE framing) via curl, which is fragile in bash. The 127.0.0.1
   port is the rendezvous that carries FSM state across turns (each turn is a fresh subshell). The
   `(state, intent) → (state, effects)` contract maps directly to the future Rust reimplementation.
4. **`guide` vs `teach`:** `guide` = **short** behavior directive (rides in the per-turn payload);
   `teach` = **bulky** knowledge (command lists, detailed steps) in `knowledge/*.md`, fetched on
   demand. Bonus: dynamic, state-gated slicing (only the current state's teach loads).
5. **Default comportment = Mode A (embody + interact with the human).** Collapses the current
   "Emulation Mode" and removes the "autonomous executor" stance that caused the agy bug. Rules:
   embody the `.description` persona; at a state awaiting human input (has intents / `request_interact`)
   converse toward the `goal` using guide+teach, map the reply to an intent (or offtopic), then pause
   and wait; at a pure transition, advance silently; **never** execute guide/teach as commands
   (command-text is presented to the human); **never** reveal the intent signal.
6. **Publish-agent (converting the real `/publish` skill):** a **deterministic guide**, **zero
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

A Claude Code **plugin** `dot-agent` bundling **{Mode A skill (default), Mode B skill (autonomous
test)} + the MCP/runtime registration** — the "one download" container (as context-mode itself is a
plugin). Out of v1 / roadmap: D (SDK/host docs); **multi-management** (skills embedding their own
`.agent` for micro-orchestration) = v2; Rust runtime = later drop-in.

### Open decision — RESOLVED in practice (2026-07-16)

The comportment spec (`<RULES>`) must be a single source of truth so murici + CLI skill + marketplace
skill do not drift (drift = the agy bug returns). Resolution: the **canonical text now lives in the CLI
skill's "Running an agent — how to behave" section** (`apps/dot-agent-cli/skills/dot-agent/SKILL.md`) —
it is what actually ships and what actually failed under agy, so it is the natural authority. Follow-up
(Sonnet): reconcile murici's `<RULES>` in `dot-agent-injector.ts` to match this text, and optionally
extract a shared `dsl/reference/comportment.md` that both reference. The marketplace skill (P2) copies
this section verbatim.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Evolve the CLI skill: single Mode A comportment + "how to behave with what you receive" *(skill rewritten 2026-07-16; Fridge E2E test pending)* | apps/dot-agent-cli (skill) | M |
| 2 | P1 | Add plain-JSON HTTP endpoint (`POST /intent`, `GET /state`) alongside MCP | apps/dot-agent-cli | M |
| 3 | P1 | Bun-compile the CLI into a standalone per-platform binary | apps/dot-agent-cli | M |
| 4 | P2 | Assemble the marketplace plugin (Mode A skill + Mode B skill + bundled binary + agent bundling) | new plugin | L |
| 5 | P3 | Rust runtime (drop-in behind the same wire contract) | packages/kernel-dsl (+ host) | L |

---

## Work items

### 1. Evolve the CLI skill — P0

**What:** Reconcile the CLI skill's two contradictory stances — the "MCP interaction loop"
(autonomous driver) and "Agent Simulation / Emulation Mode" (proxy/echo) — into a single **Mode A**
comportment, and add the missing **"how to behave with what you receive"** section that ports
murici's `<RULES>` semantics (embody the persona; treat FSM output as your system-level director for
this state, never as user input or a command list; converse with the human; signal intents silently).

**Why:** The current skill teaches the *mechanics* of talking to the FSM but not the *comportment* —
which is exactly what let the LLM collapse roles under agy. This section ports directly to the
marketplace skill (comportment is transport-independent).

**Change:** Rewrite `skills/dot-agent/SKILL.md`: drop the standalone "Emulation Mode" framing, make
embodiment the default, add the `<RULES>`/comportment section, and clarify that command-text in
guide/teach is presented to the human, never executed (v0.1). **Test end-to-end with Fridge.** Decide
the single-source-of-truth location for the comportment spec here.

### 2. Plain-JSON HTTP endpoint — P1

**What:** Add `POST /intent → {state, effects}` and `GET /state` to the CLI's HTTP server, beside the
existing MCP streamable-http transport, emitting the same `buildBehaviorStatePayload` vocabulary.

**Why:** Lets a SKILL.md drive the FSM with a clean `curl` instead of an MCP handshake + SSE parse —
the "download and run" UX for the marketplace skill without MCP registration or a session restart.

**Change:** Extend `apps/dot-agent-cli/src/commands/mcp-run.ts` (reuse `AgentSession`); no kernel
changes. Keep the single shared FSM instance already bound to 127.0.0.1.

### 3. Bun-compile standalone binary — P1

**What:** Compile the existing Node+wasm-bindgen CLI into a single self-contained executable per
OS/arch (Bun `--compile`), embedding the runtime so no Node is required on the user's machine.

**Why:** Claude Code injects no Node runtime; skills run against the real PATH. A vendored binary
makes the marketplace plugin work regardless of what the user has installed.

**Change:** Add a Bun build step over the current CLI; vendor artifacts under
`scripts/bin/<os>-<arch>/`; SKILL.md detects `uname -sm` and calls the binary directly.

### 4. Assemble the marketplace plugin — P2

**What:** Package a Claude Code plugin bundling the Mode A skill (default), the Mode B autonomous-test
skill, the bundled binary, and the `.agent` bundling/loading flow.

**Why:** The distributable "one download" unit for the marketplace.

**Change:** New plugin layout; Mode A and Mode B share the comportment spec, differ only in the
human-in-the-loop vs autonomous driving section.

### 5. Rust runtime — P3 (roadmap)

**What:** Reimplement the runtime host in Rust behind the same `(state, intent) → (state, effects)`
wire contract.

**Why:** Independence from Node and better performance, without touching any `.agent` or skill.

**Change:** Drop-in swap of the Layer 2 binary; the format and the HTTP contract are unchanged.

---

## Implementation order

```
P0: Evolve CLI skill (single Mode A comportment + RULES section) + test with Fridge
P1: Plain-JSON HTTP endpoint  ‖  Bun-compile standalone binary   (parallel)
P2: Assemble marketplace plugin (Mode A + Mode B + binary + agent bundling)
P3: Rust runtime (drop-in, later)

Deferred: Mode D SDK/host docs; v2 multi-management (skills embedding their own .agent)
```