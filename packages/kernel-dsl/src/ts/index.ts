// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
    // The `node:` scheme must stay invisible to browser bundlers: webpack throws
    // UnhandledSchemeError and rolldown/tsdown preserves the literal (this is how
    // the 0.10.2 tsup→tsdown migration broke Murici's webpack build). Building the
    // specifier at runtime degrades this to a runtime-only dynamic import — guarded
    // by isNodeRuntime(), so browsers never execute it. `Array.join` is used
    // because rolldown does not constant-fold it back to the static literal.
    const fsSpecifier = ['node:', 'fs/promises'].join('')
    const { readFile } = await import(/* webpackIgnore: true */ fsSpecifier)
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
