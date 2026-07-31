// SPDX-License-Identifier: Apache-2.0

import { pack as compilerPack } from '@dot-agent/compiler'
import { PackOptions, PackResult } from '../types.js'

export async function pack(options: PackOptions = {}): Promise<PackResult> {
  return compilerPack(options)
}
