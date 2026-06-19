let _initialized = false;
let _module = null;

// UBSan handlers present only in debug builds; release builds compile them out.
const envShim = {
  __ubsan_handle_type_mismatch_v1: () => {},
  __ubsan_handle_alignment_assumption: () => {},
  __ubsan_handle_out_of_bounds: () => {},
  __ubsan_handle_nonnull_arg: () => {},
  __ubsan_handle_load_invalid_value: () => {},
  __ubsan_handle_builtin_unreachable: () => {},
  __ubsan_handle_add_overflow: () => {},
  __ubsan_handle_sub_overflow: () => {},
  __ubsan_handle_mul_overflow: () => {},
  __ubsan_handle_divrem_overflow: () => {},
  __ubsan_handle_shift_out_of_bounds: () => {},
  __ubsan_handle_pointer_overflow: () => {},
};

export class AgentDSLKernel {
  constructor() {
    if (!_initialized) throw new Error('Must call init() first');
    this._kernel = new _module.AgentDSLKernel();
  }

  get_current_state() { return this._kernel.get_current_state(); }
  get_graph() { return this._kernel.get_graph(); }
  get_memory() { return this._kernel.get_memory(); }
  get_valid_intents() { return this._kernel.get_valid_intents(); }
  load_behavior(text) { return this._kernel.load_behavior(text); }
  observe(callback) { return this._kernel.observe(callback); }
  send_complete() { return this._kernel.send_complete(); }
  send_event(event) { return this._kernel.send_event(event); }
  send_failed() { return this._kernel.send_failed(); }
  send_intent(intent) { return this._kernel.send_intent(intent); }
  set_memory(domain, key, value_json) { return this._kernel.set_memory(domain, key, value_json); }
  send_offtopic() { return this._kernel.send_offtopic(); }
  tick_prompt() { return this._kernel.tick_prompt(); }
  free() { return this._kernel.free(); }
}

export async function init() {
  if (_initialized) return;

  try {
    const bgModule = await import('./pkg/dot_agent_kernel_dsl_bg.js');

    // Load WASM buffer: fetch in browser, fs.readFile in Node.js
    let wasmBuffer;
    if (typeof window !== 'undefined') {
      // Browser environment
      const wasmPath = new URL('./pkg/dot_agent_kernel_dsl_bg.wasm', import.meta.url);
      const wasmResponse = await fetch(wasmPath);
      wasmBuffer = await wasmResponse.arrayBuffer();
    } else {
      // Node.js environment
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const wasmPath = fileURLToPath(new URL('./pkg/dot_agent_kernel_dsl_bg.wasm', import.meta.url));
      wasmBuffer = await readFile(wasmPath);
    }

    const importObject = {
      env: envShim,
      './dot_agent_kernel_dsl_bg.js': { ...bgModule }
    };

    const wasmModule = await WebAssembly.instantiate(wasmBuffer, importObject);
    bgModule.__wbg_set_wasm(wasmModule.instance.exports);
    _module = await import('./pkg/dot_agent_kernel_dsl.js');

    _initialized = true;
  } catch (err) {
    console.error('Failed to initialize wasm:', err);
    throw err;
  }
}
