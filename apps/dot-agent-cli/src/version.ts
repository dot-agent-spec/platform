// SPDX-License-Identifier: Apache-2.0

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
export const version: string = require('../package.json').version
