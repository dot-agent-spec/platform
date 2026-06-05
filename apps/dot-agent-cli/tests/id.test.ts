// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it, expect } from 'vitest'
import { parseId, buildId } from '../src/core/id.js'

describe('id', () => {
  it('parses a valid agent ID', () => {
    const parts = parseId('entelekheia.ai/doctor:v1.0~a1b2c3d')
    expect(parts.namespace).toBe('entelekheia.ai')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBe('a1b2c3d')
  })

  it('builds an ID from parts', () => {
    const id = buildId({
      namespace: 'entelekheia.ai',
      name: 'doctor',
      version: 'v1.0',
      digest: 'a1b2c3d',
    })
    expect(id).toBe('entelekheia.ai/doctor:v1.0~a1b2c3d')
  })

  it('throws on invalid ID format', () => {
    expect(() => parseId('invalid')).toThrow()
  })
})
