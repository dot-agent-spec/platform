# @dot-agent/sdk

Browser-compatible dispatch layer for loading and running `.agent` bundles. This is **Level 3** of the dot-agent tooling hierarchy: it wraps `@dot-agent/kernel-dsl` (the WASM FSM runtime) and `@dot-agent/compiler` (bundle parsing) behind a small session API, so a host application never talks to the kernel directly.

---

## Install

```bash
npm install @dot-agent/sdk
```

---

## Quick start

```ts
import { loadAgent, AgentSession } from '@dot-agent/sdk'

// 1. Load a .agent bundle (a ZIP, as Uint8Array or ArrayBuffer)
const bundle = await loadAgent(bytes)

// 2. Create a session and register effect handlers before starting
const session = await AgentSession.create(bundle)
session.registerHandler('goal', ({ text }) => console.log('goal:', text))
session.registerHandler('guide', ({ text }) => console.log('guide:', text))
session.registerHandler('request_interact', () => showInputBox())

// 3. Start the FSM — fires the init state's effects
session.start()

// 4. Drive the conversation
session.sendIntent('examine')
console.log(session.getState())
console.log(session.getValidIntents())

session.dispose()
```

If the bundle's behavior files reference a `merge "…"` path that isn't already included in
`bundle.files.behaviors`, register a fallback resolver **before** calling `start()`:

```ts
session.setFileResolver(path => lookupBehaviorSource(path))
```

---

## Public API

| Export | Description |
|--------|-------------|
| `loadAgent(input)` | Parse a `.agent` ZIP (`Uint8Array` \| `ArrayBuffer`) into an `AgentBundle` |
| `AgentSession.create(bundle)` | Construct a session around a loaded bundle; initializes the WASM kernel |
| `session.setFileResolver(fn)` | Register the Mode B fallback for `merge` paths missing from the bundle |
| `session.registerHandler(type, fn)` | Register a per-effect-type handler (`goal`, `guide`, `teach`, `request_interact`, `transition`, `run_script`, `run_subagent`, `run_tool`, `set_memory`, `apply_css`, `remove_css`, …) |
| `session.setEffectListener(fn)` | Optional catch-all called for every effect, in addition to per-type handlers |
| `session.start()` | Load the behavior into the kernel and fire the `init` state's effects |
| `session.sendIntent(intent)` | Dispatch a user intent to the current state's `on intent` handler |
| `session.sendEvent(event)` | Dispatch a named event to matching `on event` triggers |
| `session.sendOfftopic()` | Dispatch to the current state's `on offtopic` handler |
| `session.tickPrompt()` | Advance the turn counter, firing any `after N prompts` statements |
| `session.getState()` | Current FSM state name |
| `session.getValidIntents()` | Intents accepted by the current state |
| `session.getGraph()` | SCXML graph of the loaded behavior, with the active state annotated |
| `session.getMemory()` | Snapshot of kernel memory as `{ domain, key, value }[]` |
| `session.injectMemory(domain, key, value)` | Write a value into kernel memory |
| `session.dispose()` | Free the underlying WASM kernel instance |
| `validateMagicBytes(bytes)` \| `validateZipBomb(zip, size)` | Bundle-safety checks, re-exported from `@dot-agent/compiler/core` |

Full type definitions (`AgentBundle`, `AgentFiles`, `Effect`, `EffectHandler`, `AboutMe`) are in `dist/index.d.ts` after building.

---

## Development

```bash
npm install
npm test          # node --test against tests/node.test.js
npm run build     # compile to dist/ with tsup
npm run typecheck # tsc --noEmit
```
