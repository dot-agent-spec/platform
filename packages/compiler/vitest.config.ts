// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // singleFork keeps the WASM parsers alive across all test files
    // (web-tree-sitter initializes a shared WebAssembly module that can't be
    // transferred across worker threads or re-initialized cleanly in the same process)
    pool: 'forks',
    fileParallelism: false,
  },
})
