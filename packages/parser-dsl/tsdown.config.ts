// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/ts/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  shims: true,
  clean: true,
})
