// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// WASI imports were removed by wasi-stub at build time.
// The WASM only requires its own _bg.js bindings — no shim needed.

let _initialized = false;
let _module = null;

export async function init() {
  if (_initialized) return;

  try {
    const bgModule = await import('./pkg/dot_agent_behavior_parser_bg.js');

    let wasmBuffer;
    if (typeof window !== 'undefined') {
      const wasmPath = new URL('./pkg/dot_agent_behavior_parser_bg.wasm', import.meta.url);
      const wasmResponse = await fetch(wasmPath);
      wasmBuffer = await wasmResponse.arrayBuffer();
    } else {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const wasmPath = fileURLToPath(new URL('./pkg/dot_agent_behavior_parser_bg.wasm', import.meta.url));
      wasmBuffer = await readFile(wasmPath);
    }

    // Rust debug builds include UBSan instrumentation that imports from "env".
    // Provide no-op stubs so the WASM loads in both debug and release builds.
    const envStubs = new Proxy({}, { get: () => () => {} });
    const wasmModule = await WebAssembly.instantiate(wasmBuffer, {
      './dot_agent_behavior_parser_bg.js': { ...bgModule },
      env: envStubs,
    });
    bgModule.__wbg_set_wasm(wasmModule.instance.exports);
    _module = await import('./pkg/dot_agent_behavior_parser.js');

    _initialized = true;
  } catch (err) {
    console.error('Failed to initialize behavior-parser wasm:', err);
    throw err;
  }
}

export function parse(text) {
  if (!_initialized) throw new Error('Must call init() first');
  return _module.parse(text);
}

export function get_graph(text) {
  if (!_initialized) throw new Error('Must call init() first');
  return _module.get_graph(text);
}

export function get_states(text) {
  if (!_initialized) throw new Error('Must call init() first');
  return _module.get_states(text);
}

export function get_intents_for_state(text, state_name) {
  if (!_initialized) throw new Error('Must call init() first');
  return _module.get_intents_for_state(text, state_name);
}

export default init;
