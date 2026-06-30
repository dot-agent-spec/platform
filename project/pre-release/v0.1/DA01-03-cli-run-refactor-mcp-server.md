<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# LOG-DA01-03: CLI — Run Refactor and MCP Server

| Field | Value |
|---|---|
| Status | Planned |
| Date | 2026-06-27 |
| Deciders | Danilo Borges |
| Related | DA01-01, DA01-02 |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) | cli (L4) |
|---|---|---|---|---|---|
| — | — | ✏️ | — | — | ✏️ |

---

## 1. Summary

Three-track work on the CLI, compiler, and LLM integration.

**Track 1 — Run Refactor**: Remove duplicated bundle-construction code from `run.ts`. The CLI currently rebuilds `AgentBundle` from scratch for directory sources, duplicating `pack()` logic. A new `bundleFromDir()` function is added to the compiler, the dead `AgentContext` EventEmitter wrapper is removed, and `run()` delegates entirely to SDK primitives.

**Track 2 — MCP Server**: Add a `--mcp` flag to `dot-agent run`. When set, the CLI loads the agent and serves it as an MCP server. Any MCP client (LLM, Claude Code agent, test harness) can drive the FSM: read state and resources, send intents/events, inspect and inject memory.

**Track 3 — LLM Context**: An embedded `helper.agent` bundled inside the CLI. When invoked via `--helper`, it starts as an MCP server backed by a real FSM. An LLM navigates it via intents to learn what dot-agent is, the DSL, the MCP interaction protocol, and a working example — loading only what it needs, on demand. A minimal Claude Code skill bootstraps the process. The helper is the first proof that the spec works on itself.

---

## 2. Motivation

### 2.1 Duplication in run.ts

The directory path in `apps/dot-agent-cli/src/commands/run.ts` constructs an `AgentBundle` manually:

- Calls `collectFiles()`, `initBehaviorParser()`, `parseDescriptionFile()` directly
- Constructs `aboutme` without sha256, with `purpose: 'local development'` hardcoded
- Extracts guides/knowledge/behaviors from the raw `Map` without validation

All of this logic already exists in `packages/compiler/src/pack.ts`. Only a disk-write-free variant that returns `AgentBundle` directly is missing.

### 2.2 AgentContext is dead code

`AgentContext` (an `EventEmitter` subtype) has no external consumers. No public API depends on it. It adds indirection between `run()` and `AgentSession` with no value.

### 2.3 Lint absent on directory run

`run` for directory sources skips lint entirely. The behavior must match what `pack()` would do: errors block, warnings are printed to stderr.

### 2.4 LLM-driven agent testing

The primary use case for `--mcp` is an LLM (Claude Code or another MCP client) loading a `.agent`, navigating the FSM via intents, observing effects and memory transitions, and validating behavior without writing an ad-hoc test harness. The FSM is deterministic — an LLM can cover all paths systematically.

### 2.5 LLM orientation gap

An LLM connecting to the MCP server has no intrinsic knowledge of: the expected interaction loop, what effects mean, when to call `tick_prompt` vs `send_intent`, or how to interpret `request_interact`. A static `dot-agent://howto` resource would close the protocol gap but dumps everything into context at once — exactly the problem the FSM model solves. The `helper.agent` replaces it with navigated, on-demand guidance: the LLM asks what it needs, in the state it needs it, and loads nothing else.

---

## 3. Specification

### Track 1: Run Refactor

#### 3.1 bundleFromDir (new compiler export)

```ts
// packages/compiler/src/bundle.ts
export async function bundleFromDir(dir: string): Promise<AgentBundle>
```

Algorithm (mirrors `pack()` up to the zip-write step):

1. `discoverDescriptionFile(dir)` — finds the `.description` file
2. `consolidate(dir, behaviorFile)` — flatten merges
3. `lintDescription(text, file)` + `lintBehavior(mergedText, file)` — lint errors throw `Error`, warnings go to `stderr`
4. `buildAboutme({ id, ..., purpose: 'development', sha256: hash(content) })`
5. `collectFiles(dir, ...)` — assembles the full `Map<string, string>`
6. Constructs and returns `AgentBundle`

Exported from `packages/compiler/src/index.ts`. **Not** exported from `compiler/core` (requires `fs`).

> **Type ownership decision**: `AgentBundle` moves to `@dot-agent/compiler/core` and is re-exported by the SDK. This eliminates the latent circular dependency. The SDK imports the type from the compiler.

#### 3.2 Refactored run()

```ts
// Before
export async function run(options: RunOptions): Promise<AgentContext>

// After
export interface RunResult {
  bundle: AgentBundle
  session: AgentSession
}
export async function run(options: RunOptions): Promise<RunResult>
```

- **`.agent` file**: `loadAgent(bytes)` → `AgentSession.create(bundle)` → `session.start()` → return `{ bundle, session }`
- **Directory**: `bundleFromDir(dir)` → `AgentSession.create(bundle)` → `session.start()` → return `{ bundle, session }`

Removed: `AgentContext`, `FileEntry` (if unused), the full EventEmitter wrapper.

`cli.ts` updates its `run` handler to print the initial state from the effects returned by `start()`.

#### 3.3 Version pinning on release

`scripts/release.mjs` must resolve `"*"` dependencies to exact versions before publishing:

```
"@dot-agent/compiler": "*"  →  "@dot-agent/compiler": "0.1.0"
"@dot-agent/sdk": "*"       →  "@dot-agent/sdk": "0.1.0"
```

Resolution uses the version declared in each package's `package.json` at release time.

---

### Track 2: MCP Server

#### 3.4 CLI interface

```
dot-agent run <file.agent | dir> [--mcp] [--mcp-transport stdio|http] [--mcp-port <n>]
```

- **Without `--mcp`**: current behavior — load agent, print ID and initial effects, exit.
- **With `--mcp`**: load agent, start MCP server, block until Ctrl-C.
- Default transport: `stdio`.
- Default port (HTTP): `3000`.

#### 3.5 Server identity

- Server name: `dot-agent`
- URI scheme for resources: `dot-agent://`

#### 3.6 MCP Tools

Each tool returns the effects produced by the kernel **synchronously** in the call result — not via notifications.

| Tool | Input | Kernel call | Return |
|---|---|---|---|
| `send_intent` | `{ intent: string }` | `session.sendIntent(intent)` | `{ ok: true, effects: Effect[] }` |
| `send_event` | `{ event: string }` | `session.sendEvent(event)` | `{ ok: true, effects: Effect[] }` |
| `send_offtopic` | — | `session.sendOfftopic()` | `{ ok: true, effects: Effect[] }` |
| `tick_prompt` | — | `session.tickPrompt()` | `{ ok: true, effects: Effect[] }` |
| `inject_memory` | `{ domain, key, value }` | `session.injectMemory(domain, key, value)` | `{ ok: true }` |

`Effect` is the kernel type: `{ type: "goal" | "guide" | "teach" | "request_interact" | "transition" | ..., ... }`.

The LLM reads the effects array in the tool call result and acts accordingly (e.g. `request_interact` signals the agent is awaiting user input).

#### 3.7 MCP Resources

Resources are read-only (except where noted). `state`, `intents`, and `memory` change with interaction — the MCP client **must not** cache these resources.

| URI | Source | Mutable | Description |
|---|---|---|---|
| `dot-agent://manifest` | `bundle.aboutme` | No | Full `aboutme.json`: name, description, capabilities, requires |
| `dot-agent://state` | `session.getState()` | Yes | Current FSM state name |
| `dot-agent://intents` | `session.getValidIntents()` | Yes | Valid intents array in the current state |
| `dot-agent://graph` | `session.getGraph()` | No* | SCXML with `_active="true"` on the current state |
| `dot-agent://memory` | `session.getMemory()` | Yes | Full memory store (4 domains) |
| `dot-agent://persona` | `bundle.files.soul` | No | SOUL.md / persona file content |
| `dot-agent://guides/{name}` | `bundle.files.guides` | No | Content of an individual guide |
| `dot-agent://knowledge/{name}` | `bundle.files.knowledge` | No | Content of a knowledge file |
| `dot-agent://howto` | static (server) | No | Minimal 3-line interaction primer (full guidance: `--helper`) |

*`graph` changes on each state transition (`_active` annotation).

#### 3.8 Session management

- **stdio**: one session per process (implicit singleton). Created on start, disposed on shutdown.
- **HTTP**: one session per connection. `Map<connectionId, AgentSession>`. Session disposed when the connection closes. No persistence between connections (v0.1 stateless).

A single process serves **one agent**. For multiple simultaneous agents: multiple processes on different ports. A `dot-agent serve` command to manage multiple agents is v0.2+.

#### 3.9 Config file

**Path**: `$XDG_CONFIG_HOME/dot-agent/mcp.json` (default: `~/.config/dot-agent/mcp.json`).

The file is optional — absence is not an error.

Schema:

```json
{
  "transport": "stdio",
  "port": 3000,
  "auth": {
    "type": "bearer",
    "token": "..."
  },
  "expose_persona": true,
  "expose_knowledge": true
}
```

Precedence: **CLI flags > config file > defaults**.

Auth is only relevant for HTTP transport in v0.1. stdio is implicitly secure (local access).

#### 3.10 MCP library

Add `@modelcontextprotocol/sdk` as a dependency of `@dot-agent/cli`. Implement the server using the MCP SDK `Server` class with handlers for the tools and resources above.

---

### Track 3: LLM Context

#### 3.11 dot-agent://howto resource (minimal)

A static 3-line resource served by every dot-agent MCP server:

```
Navigate via dot-agent://intents + send_intent.
For full DSL and protocol guidance: run dot-agent with --helper and connect.
request_interact = pause, ask the user, then continue.
```

Deep guidance lives in the helper FSM, not here.

#### 3.12 helper.agent

An `.agent` bundle shipped inside the CLI package (`assets/helper.agent`). Invoked via:

```
dot-agent run --helper [--mcp-transport stdio|http] [--mcp-port <n>]
```

This is syntactic sugar for `dot-agent run assets/helper.agent --mcp`. No new runtime logic.

**Why a real `.agent`**: the helper is a live FSM navigated via intents. The LLM loads only the state it needs. The helper is simultaneously the best example of the format it teaches — first proof that the spec works on itself.

**State graph:**

| State | Effects emitted | Intents available |
|---|---|---|
| `init` | `goal` — topic list | `about` \| `dsl` \| `mcp` \| `generate` \| `example` |
| `about` | `guide` — what dot-agent is, FSM model, use cases | `dsl` \| `mcp` \| `back` |
| `dsl_overview` | `guide` — file types: `.description`, `.behavior`, `SOUL.md`, `guides/`, `knowledge/` | `dsl_description` \| `dsl_behavior` \| `dsl_memory` \| `dsl_persona` \| `back` |
| `dsl_description` | `guide` + `teach` — description syntax with example | `dsl_behavior` \| `dsl_overview` \| `back` |
| `dsl_behavior` | `guide` + `teach` — states, intents, triggers, effects, after, merge | `dsl_states` \| `dsl_effects` \| `dsl_overview` \| `back` |
| `dsl_states` | `guide` — init requirement, global triggers, after statements | `dsl_behavior` \| `back` |
| `dsl_effects` | `guide` — goal/guide/teach/request\_interact/transition\_to/set\_memory/run\_script | `dsl_behavior` \| `back` |
| `dsl_memory` | `guide` — 4 domains: context/session/worksession/user | `dsl_behavior` \| `back` |
| `dsl_persona` | `guide` — SOUL.md: voice, values, rules; `persona` keyword | `dsl_overview` \| `back` |
| `mcp_overview` | `guide` — MCP server mode, tools vs resources, interaction loop | `mcp_tools` \| `mcp_resources` \| `mcp_effects` \| `back` |
| `mcp_tools` | `guide` + `teach` — send\_intent/send\_event/send\_offtopic/tick\_prompt/inject\_memory, when to use each | `mcp_overview` \| `mcp_effects` \| `back` |
| `mcp_resources` | `guide` — all `dot-agent://` URIs | `mcp_overview` \| `back` |
| `mcp_effects` | `guide` — effect type semantics | `mcp_overview` \| `back` |
| `example` | `guide` + `teach` — complete hello-world `.description` + `.behavior` | `dsl` \| `generate` \| `back` |
| `generate_overview` | `guide` — authoring steps: description → behavior → optional persona/guides/knowledge → validate with `run` → pack with `pack`; minimal valid agent = 1 `.description` + 1 `.behavior` with `init` state | `gen_description` \| `gen_behavior` \| `gen_patterns` \| `gen_validate` \| `gen_pack` \| `back` |
| `gen_description` | `guide` — required fields: `name`, `description`, `capabilities`, `behavior`; optional: `requires`, `persona`; `teach` — minimal `.description` example | `gen_behavior` \| `generate_overview` \| `back` |
| `gen_behavior` | `guide` — `init` state required, on intent, effects; `teach` — minimal `.behavior` with `init` and one intent | `gen_description` \| `gen_patterns` \| `gen_validate` \| `generate_overview` \| `back` |
| `gen_patterns` | `guide` — three patterns with `teach` snippets: simple responder (stateless loop), multi-stage workflow (linear states), memory-aware (set\_memory + inject\_memory) | `gen_behavior` \| `gen_validate` \| `generate_overview` \| `back` |
| `gen_validate` | `guide` — validate with `dot-agent run <dir>`; key lint errors: E016 (no `init`), E003 (no `.description`), E014 (path escapes root), E012 (merge target missing); errors block, warnings to stderr | `gen_pack` \| `generate_overview` \| `back` |
| `gen_pack` | `guide` — `dot-agent pack <dir>` produces `<name>.agent`; `-o <path>` for explicit output; runs same lint as `run` — errors block; bundle contains consolidated `agent.behavior`, description, `SOUL.md`, `guides/`, `knowledge/`, source files under `behaviors/`; `teach` — pack + run roundtrip example | `gen_validate` \| `generate_overview` \| `back` |

`back` always returns to `init`. No memory required.

#### 3.13 Claude Code skill

A skill file at `~/.claude/skills/dot-agent/SKILL.md` installed via `dot-agent install-skill`.

Content is intentionally minimal — the helper does the work:

```markdown
# dot-agent

To run or test an agent:
1. `dot-agent run <path> --mcp` in background (stdio)
2. Connect, read dot-agent://manifest and dot-agent://state
3. Relay user messages as intents; relay effects back

To learn the DSL or protocol:
1. `dot-agent run --helper --mcp` in background
2. Connect, read dot-agent://intents
3. Navigate the helper to answer the question
```

**Trigger**: user says "run", "test", "execute", or "explain" with a `.agent` path or agent name, or invokes `/dot-agent`.

#### 3.14 Kernel snapshot debt (v0.2)

Full kernel snapshot/resume requires two additions in `packages/kernel-dsl/src`:

- `get_prompt_count(): number` — exposes `Fsm.prompt_count` via `#[wasm_bindgen]`
- `restore_state(name: string, count: number): void` — repositions the FSM without firing entry effects

Without this, memory is serializable (`get_memory`/`set_memory`) but the FSM position cannot be faithfully restored. The "replay log" alternative (record all events, re-execute on restore) is deferred due to complexity cost.

---

## 4. Implementation Plan

### Track 1 — Prerequisite

1. Move `AgentBundle` to `@dot-agent/compiler/core`, update re-export in SDK
2. Add `packages/compiler/src/bundle.ts` with `bundleFromDir()`
3. Export from `packages/compiler/src/index.ts`
4. Rewrite `apps/dot-agent-cli/src/commands/run.ts`
5. Remove `AgentContext`, update `types.ts`, update `cli.ts`
6. Update `scripts/release.mjs` for version pinning

### Track 2 — Depends on Track 1

1. Add `@modelcontextprotocol/sdk` to CLI deps
2. Add `apps/dot-agent-cli/src/commands/mcp-server.ts`
   - `startMcpServer(session, bundle, options)` — registers tools and resources
3. Add `apps/dot-agent-cli/src/config.ts`
   - Reads `$XDG_CONFIG_HOME/dot-agent/mcp.json`, merges with CLI flags
4. Update `cli.ts` to parse `--mcp`, `--mcp-transport`, `--mcp-port`
5. Implement tools (§3.6) and resources (§3.7, including `dot-agent://howto`)
6. Test with Claude Code as MCP client

### Track 3 — Depends on Track 2

1. Write the `helper.agent` source files (description + behavior + example knowledge)
2. Pack to `assets/helper.agent` and commit to the CLI package
3. Add `--helper` flag to CLI (`dot-agent run --helper`) as alias for the bundled asset
4. Write `apps/dot-agent-cli/skills/dot-agent/SKILL.md`
5. Add `dot-agent install-skill` command — copies skill to `~/.claude/skills/dot-agent/`
6. Test: user says "run examples/hello.agent" → Claude Code drives the full interaction loop
7. Test: user asks "what is dot-agent?" → Claude Code navigates helper via `about` intent

---

## 5. Verification

### Track 1

- [ ] `bundleFromDir(dir)` produces `AgentBundle` with the same fields as `loadAgent(await packBuffer(dir))` for the same input
- [ ] Lint errors on directory source block `run`
- [ ] Lint warnings are printed but do not block
- [ ] All existing CLI tests pass
- [ ] `release.mjs` in dry-run shows `*` resolved to exact versions

### Track 2

- [ ] `dot-agent run foo.agent --mcp` starts MCP server in stdio without error
- [ ] `send_intent` returns `effects` array in the tool call result
- [ ] `dot-agent://state` reflects FSM state after `send_intent`
- [ ] Multiple simultaneous HTTP connections maintain independent FSMs
- [ ] `~/.config/dot-agent/mcp.json` overrides defaults; CLI flags override the file
- [ ] `dot-agent://persona` exposes correct content of the persona file
- [ ] `dot-agent://howto` returns the static interaction guide

### Track 3

- [ ] `dot-agent run --helper --mcp` starts as a real MCP server backed by helper.agent FSM
- [ ] `dot-agent://intents` on helper returns `["about","dsl","mcp","example"]` from `init` state
- [ ] Navigating `dsl` → `dsl_behavior` → `dsl_effects` → `back` returns to `init`
- [ ] `teach` effects on `dsl_description`, `gen_description`, `gen_behavior`, `gen_patterns`, and `example` states contain complete, correct, copy-pasteable examples
- [ ] `gen_validate` effect lists lint codes that match the current compiler (E016, E003, E014, E012)
- [ ] LLM can navigate `generate` → `gen_patterns` → get a pattern snippet → `gen_validate` → know how to test the output
- [ ] `dot-agent install-skill` copies skill to `~/.claude/skills/dot-agent/SKILL.md`
- [ ] "run examples/hello.agent" → Claude Code starts server, enters loop
- [ ] "what is dot-agent?" → Claude Code starts helper, navigates to `about`, answers from effect
