let _initialized = false;
let _module = null;

// Complete WASI + Rust runtime shim - 31 functions required
const wasiShim = {
  // WASI file descriptor operations (5)
  fd_write: () => 0,
  fd_close: () => 0,
  fd_seek: () => 0,
  fd_prestat_get: () => 0,
  fd_prestat_dir_name: () => 0,

  // WASI environment (2)
  environ_get: () => 0,
  environ_sizes_get: () => 0,

  // WASI time (1)
  clock_time_get: () => 0,

  // WASI misc (1)
  random_get: () => 0,
  proc_exit: () => 0,

  // Rust UB Sanitizer handlers (11)
  __ubsan_handle_type_mismatch_v1: () => 0,
  __ubsan_handle_alignment_assumption: () => 0,
  __ubsan_handle_out_of_bounds: () => 0,
  __ubsan_handle_nonnull_arg: () => 0,
  __ubsan_handle_load_invalid_value: () => 0,
  __ubsan_handle_builtin_unreachable: () => 0,
  __ubsan_handle_add_overflow: () => 0,
  __ubsan_handle_sub_overflow: () => 0,
  __ubsan_handle_mul_overflow: () => 0,
  __ubsan_handle_divrem_overflow: () => 0,
  __ubsan_handle_shift_out_of_bounds: () => 0,
  __ubsan_handle_pointer_overflow: () => 0,

  // wasm-bindgen JS interop (8)
  __wbg_call_9c758de292015997: () => 0,
  __wbg_new_d90091b82fdf5b91: () => 0,
  __wbg_new_ce1ab61c1c2b300d: () => 0,
  __wbg_push_a6822215aa43e71c: () => 0,
  __wbg_set_6be42768c690e380: () => 0,
  __wbg_set_dca99999bba88a9a: () => 0,
  __wbg___wbindgen_throw_1506f2235d1bdba0: () => 0,

  // wasm-bindgen internal (3)
  __wbindgen_init_externref_table: () => 0,
  __wbindgen_cast_0000000000000001: () => 0,
  __wbindgen_cast_0000000000000002: () => 0,
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
  send_fallback() { return this._kernel.send_fallback(); }
  send_intent(intent) { return this._kernel.send_intent(intent); }
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
      env: wasiShim,
      wasi_snapshot_preview1: wasiShim,
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
