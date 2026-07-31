// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  shims: true,
  clean: false, // WASM files in dist/ are built by tree-sitter-cli, not tsdown
})
