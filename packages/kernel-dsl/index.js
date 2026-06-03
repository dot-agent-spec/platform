import * as bgModule from './pkg/dot_agent_kernel_dsl_bg.js';

let _initialized = false;

export async function init() {
  if (_initialized) return;

  const wasmUrl = new URL('./pkg/dot_agent_kernel_dsl_bg.wasm', import.meta.url);
  const imports = { './dot_agent_kernel_dsl_bg.js': bgModule };

  let result;
  try {
    result = await WebAssembly.instantiateStreaming(fetch(wasmUrl.toString()), imports);
  } catch (err) {
    console.error('Failed to initialize wasm:', err);
    throw err;
  }

  bgModule.__wbg_set_wasm(result.instance.exports);
  result.instance.exports.__wbindgen_start?.();
  _initialized = true;
}

export { AgentDSLKernel } from './pkg/dot_agent_kernel_dsl_bg.js';
