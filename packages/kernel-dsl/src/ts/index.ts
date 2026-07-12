const envStubs = new Proxy({}, { get: () => () => {} })
let _initialized = false

// `typeof window !== 'undefined'` is not a reliable browser/Node split: Web
// Workers have `fetch` but no `window` (only `self`/`globalThis`), so that
// check used to send workers down the Node-only `readFile` branch, which
// fails once bundlers strip/stub `node:fs/promises` for browser targets.
// Detect Node explicitly instead so every non-Node environment (main thread
// or worker) takes the `fetch` path.
export function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null
}

export async function init(): Promise<void> {
  if (_initialized) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgModule: any = await import('../../pkg/dot_agent_kernel_dsl_bg.js')
  const wasmUrl = new URL('../pkg/dot_agent_kernel_dsl_bg.wasm', import.meta.url)
  let wasmBuffer: ArrayBuffer | Uint8Array
  if (isNodeRuntime()) {
    const { readFile } = await import('node:fs/promises')
    wasmBuffer = await readFile(wasmUrl)
  } else {
    wasmBuffer = await fetch(wasmUrl).then(r => r.arrayBuffer())
  }
  const result = await WebAssembly.instantiate(wasmBuffer as BufferSource, {
    './dot_agent_kernel_dsl_bg.js': { ...bgModule },
    env: envStubs,
  }) as WebAssembly.WebAssemblyInstantiatedSource
  bgModule.__wbg_set_wasm(result.instance.exports)
  _initialized = true
}

export { AgentDSLKernel } from '../../pkg/dot_agent_kernel_dsl.js'
