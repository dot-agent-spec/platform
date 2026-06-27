const envStubs = new Proxy({}, { get: () => () => {} })
let _initialized = false

export async function init(): Promise<void> {
  if (_initialized) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgModule: any = await import('../../pkg/dot_agent_parser_dsl_bg.js')
  const wasmUrl = new URL('../pkg/dot_agent_parser_dsl_bg.wasm', import.meta.url)
  let wasmBuffer: ArrayBuffer | Uint8Array
  if (typeof window !== 'undefined') {
    wasmBuffer = await fetch(wasmUrl).then(r => r.arrayBuffer())
  } else {
    const { readFile } = await import('node:fs/promises')
    wasmBuffer = await readFile(wasmUrl)
  }
  const result = await WebAssembly.instantiate(wasmBuffer as BufferSource, {
    './dot_agent_parser_dsl_bg.js': { ...bgModule },
    env: envStubs,
  }) as WebAssembly.WebAssemblyInstantiatedSource
  bgModule.__wbg_set_wasm(result.instance.exports)
  _initialized = true
}

export {
  parse_behavior,
  parse_description,
  get_graph,
  get_states,
  get_intents_for_state,
} from '../../pkg/dot_agent_parser_dsl.js'
