# Load and run a `.agent` in the browser

Unpacking a `.agent` bundle in the browser is a supported path, not a workaround. `loadAgent()` takes raw bytes and returns an `AgentBundle` with no filesystem access and no server-side unpack endpoint — the ZIP is opened in memory, on the main thread or inside a worker, by the same code Node runs.

This guide covers where those bytes can come from, what still crosses the network, and the cases where a server hop is genuinely warranted.

---

## Where the bytes come from

`loadAgent()` accepts a `Uint8Array` or an `ArrayBuffer`, so anything that yields bytes in a browser feeds it directly.

**From a URL:**

```ts
const bytes = await fetch('/agents/mentor.agent').then(r => r.arrayBuffer())
const bundle = await loadAgent(bytes)
```

**From a file picker** (`<input type="file">`):

```ts
const file = input.files[0]
const bundle = await loadAgent(await file.arrayBuffer())
```

**From a drop target:**

```ts
const file = event.dataTransfer.items[0].getAsFile()
const bundle = await loadAgent(await file.arrayBuffer())
```

The last two reach the network never: the user's own file is unpacked in the tab.

---

## What actually crosses the network

Two static GETs, and nothing else:

| Request | When | Size |
|---|---|---|
| The `.agent` file | Only when you fetch it, rather than reading a local file | Whatever the bundle weighs |
| The kernel WebAssembly module | Once, on the first `AgentSession.create()` | ~725 KB, measured on this repository's current build |

The WASM request is worth naming, because "no server hop" is true of the **unpack** and false of the **session**. `AgentSession.create()` calls the kernel's `init()`, which in any non-Node runtime resolves `../pkg/dot_agent_kernel_dsl_bg.wasm` against `import.meta.url` and fetches it (`packages/kernel-dsl/src/ts/index.ts`). That URL points into your own bundler's output, so it is a static asset on your own origin, cached like any other — and it is a real request that shows up in DevTools.

What does not exist: an unpack route, an FSM running server-side, and any per-dispatch round trip. Once the bundle is loaded and the kernel is initialized, `sendIntent()` and its siblings are synchronous local calls into WebAssembly.

---

## Why no server route is needed

`packages/sdk/src/load.ts` imports exactly two things: `jszip`, and the `@dot-agent/compiler/core` sub-path. Neither carries a `node:` specifier. `core` is the sub-path the compiler exposes precisely so a browser consumer gets the parsing and the safety checks — `validateMagicBytes`, `validateZipBomb`, `classifyContentPath` — without the packer's filesystem half.

A guard stands behind that claim. `packages/sdk/tests/browser-bundle.test.js` bundles the whole `sdk → kernel-dsl` chain for a browser target with esbuild and no externals, so a `node:` scheme leaking anywhere along that chain fails the test instead of a consumer's build. It gates the publish workflow; `packages/sdk/CHANGELOG.md` records it under 0.10.3.

The dependency argument is drawn out in full at layer 4 of the [architecture map](../explanation/architecture/map.md).

---

## Web Workers

A worker is a first-class host here, not a special case. The kernel splits on `isNodeRuntime()` — `typeof process !== 'undefined' && process.versions?.node != null` — rather than on `typeof window`. The `window` check is the bug it replaced: a worker has no `window`, so that test sent workers down the Node-only `readFile` branch, which fails the moment a bundler stubs `node:fs/promises` for a browser target.

`packages/kernel-dsl/tests/env-detection.test.js` is the regression guard, asserting `isNodeRuntime()` in both directions, including the case where a bundler polyfills `process` with no version information.

Running the session inside a worker keeps dispatch off the main thread. The kernel is synchronous once initialized, so a host that also renders pays for every dispatch in its frame budget otherwise.

---

## When a server hop is still justified

Client-side unpack is the default, not a rule. Three cases send the bytes through your own server anyway:

- **A cross-origin bundle without CORS.** A host that omits `Access-Control-Allow-Origin` leaves the browser unable to read the response. A same-origin proxy is the fix.
- **A private bundle.** When reaching the bundle needs a credential the browser must not hold — a long-lived API key, a service account — the request belongs on the server.
- **A registry issuing signed URLs.** Short-lived URLs need something trusted to ask for them.

In all three the server proxies the **bytes** and stops there. It must not unpack, and it must not run the FSM: either one moves the parsing and the state machine back off the client, and hands the server a stateful session it now has to keep alive per user.

---

## Complete example

```ts
import { loadAgent, AgentSession } from '@dot-agent/sdk'

async function run(url: string) {
  // 1. Bytes — a plain static GET, no unpack endpoint involved.
  const bytes = await fetch(url).then(r => r.arrayBuffer())

  // 2. Unpack in the tab. jszip reads the ZIP; no filesystem is touched.
  const bundle = await loadAgent(bytes)

  // 3. Session. This is the call that fetches the kernel WASM, once.
  const session = await AgentSession.create(bundle)

  // 4. Handlers must be registered before start().
  session.registerHandler('goal', ({ text }) => render('goal', text))
  session.registerHandler('guide', ({ text }) => render('guide', text))
  session.registerHandler('request_interact', () => focusInputBox())

  // 5. Fire the init state's effects.
  session.start()

  // 6. Drive it. Synchronous local calls into WebAssembly.
  session.sendIntent('examine')
  console.log(session.getState(), session.getValidIntents())

  // 7. Free the kernel instance when the view goes away.
  session.dispose()
}
```

---

## Related

- [Three-layer packaging](packaging.md) — what a `.agent` bundle contains
- [`@dot-agent/sdk` README](../../packages/sdk/README.md) — the full session API
- [Architecture map](../explanation/architecture/map.md) — where the SDK sits in the package hierarchy
