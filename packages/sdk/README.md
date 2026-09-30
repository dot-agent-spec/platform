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

## Suspending and resuming a session

A session can be captured between interactions and brought back later — in another process, after the
page reloads, on another server. `snapshot()` returns an opaque, JSON-serialisable value holding the
FSM position, the prompt count and the memory; `restore()` on a fresh session from the same bundle
puts all three back **in place of `start()`**.

```ts
// Suspend: capture and store
const saved = JSON.stringify(session.snapshot())
await store.put(conversationId, saved)
session.dispose()

// Resume: create from the same bundle, register handlers, restore instead of start
const resumed = await AgentSession.create(bundle)
resumed.registerHandler('goal', ({ text }) => console.log('goal:', text))
resumed.restore(JSON.parse(await store.get(conversationId)))
resumed.sendIntent(nextIntent)   // carries on from where the snapshot was taken
```

What to rely on:

- **The snapshot is opaque.** Its type exposes no fields; only its JSON-serialisability is contract.
  It carries its own version, and a snapshot of a version this SDK does not read is refused.
- **`restore()` emits nothing.** Loading the behavior enters `init`, and those entry effects are
  discarded — no handler and no effect listener sees them, because they describe a state the session
  already left. The host resumes by sending the next intent, event or prompt tick; an
  `after N prompts` handler fires at the same count it would have without the pause.
- **It takes `start()`'s options.** `restore(snapshot, { resolveContent: false })` keeps bare
  `teach`/`guide` paths exactly as `start({ resolveContent: false })` does.
- **The restored memory is the snapshot's, exactly.** Loading the behavior runs the `init` entry, and
  whatever its `set` statements write (or those of a state it transitions into) is cleared before the
  snapshot's memory goes back in — so the restored memory holds the same keys, types and values as the
  original, and nothing else. Memory injected before a successful `restore()` is replaced too: inject
  after restoring.
- **A bad snapshot throws and changes nothing.** A snapshot from a different agent (or from a revision
  whose state graph changed), a malformed one, one of an unknown version or one naming a state the
  behavior does not declare throws an `Error`, and so does a behavior that fails to parse. The session
  stays unstarted, memory injected before the call is still there, a registered file resolver still
  applies, and `start()` still works.
- **`restore()` replaces `start()`, once.** It is refused on a session that was started or already
  restored, and `start()` is refused after a `restore()`. `snapshot()` is refused before either, and
  after a `start()` whose behavior failed to parse — there is no position to capture then.

---

## Running in the browser

`loadAgent()` is a client-side path. It unpacks the `.agent` ZIP in memory with `jszip` and imports only the browser-safe `@dot-agent/compiler/core` sub-path — no `node:` module, no filesystem, and no server-side unpack endpoint. The bytes can come from `fetch()`, an `<input type="file">`, or a drop target; a Web Worker is a supported host, because the kernel detects Node explicitly rather than checking for `window`.

The one asset still fetched is the kernel WebAssembly module, on the first `AgentSession.create()` that reaches it. How it arrives is your bundler's decision — Vite's library build inlines it as a `data:` URI and fetches nothing; other setups emit it as a static asset you serve yourself.

Full guide: [docs/how-to/load-an-agent-in-the-browser.md](../../docs/how-to/load-an-agent-in-the-browser.md).

---

## Public API

| Export | Description |
|--------|-------------|
| `loadAgent(input)` | Parse a `.agent` ZIP (`Uint8Array` \| `ArrayBuffer`) into an `AgentBundle` |
| `AgentSession.create(bundle)` | Construct a session around a loaded bundle; initializes the WASM kernel |
| `session.setFileResolver(fn)` | Register the fallback for a `merge` path missing from the bundle (Mode B), and for a `teach`/`guide` path missing from the content map |
| `session.registerHandler(type, fn)` | Register a per-effect-type handler (`goal`, `guide`, `teach`, `request_interact`, `transition`, `run_script`, `run_subagent`, `run_tool`, `set_memory`, `apply_css`, `remove_css`, …) |
| `session.setEffectListener(fn)` | Optional catch-all called for every effect, in addition to per-type handlers |
| `session.start(options?)` | Load the behavior into the kernel and fire the `init` state's effects; also hands the bundle's `knowledge/` and `guides/` files to the kernel, unless `{ resolveContent: false }` |
| `session.sendIntent(intent)` | Dispatch a user intent to the current state's `on intent` handler |
| `session.sendEvent(event)` | Dispatch a named event to matching `on event` triggers |
| `session.sendOfftopic()` | Dispatch to the current state's `on offtopic` handler |
| `session.tickPrompt()` | Advance the turn counter, firing any `after N prompts` statements |
| `session.snapshot()` | Capture FSM position, prompt count and memory as an opaque, JSON-serialisable `AgentSnapshot` |
| `session.restore(snapshot, options?)` | Rehydrate a fresh session from a snapshot, in place of `start()` (same options); emits no effects |
| `session.getState()` | Current FSM state name |
| `session.getValidIntents()` | Intents accepted by the current state |
| `session.getGraph()` | SCXML graph of the loaded behavior, with the active state annotated |
| `session.getMemory()` | Snapshot of kernel memory as `{ domain, key, value }[]` |
| `session.injectMemory(domain, key, value)` | Write a value into kernel memory |
| `session.dispose()` | Free the underlying WASM kernel instance |
| `validateMagicBytes(bytes)` \| `validateZipBomb(zip, size)` | Bundle-safety checks, re-exported from `@dot-agent/compiler/core` |

**`teach` and `guide` effects carry resolved content.** `start()` passes the bundle's `files.knowledge` and `files.guides` to the kernel, so an effect whose `text` names one of those files also carries that file's text in `content`; anything else — inline prose, a path the bundle does not hold — arrives with `content: null`. The path in `text` is never replaced, so a handler that resolves paths on its own keeps working. Read `effect.content ?? effect.text` to take whichever is there. No extra call is needed. A host that serves those files itself — publishing them as URIs for a client to fetch on demand — passes `start({ resolveContent: false })` and keeps receiving bare paths at no payload cost.

Full type definitions (`AgentBundle`, `AgentFiles`, `Effect`, `EffectHandler`, `AboutMe`, `AgentSnapshot`, `StartOptions`) are in `dist/index.d.ts` after building.

---

## Development

```bash
npm install
npm test          # node --test against tests/node.test.js
npm run build     # compile to dist/ with tsup
npm run typecheck # tsc --noEmit
```

