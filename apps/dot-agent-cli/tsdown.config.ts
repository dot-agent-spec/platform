// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  shims: true,
  sourcemap: true,
  clean: true,
})
