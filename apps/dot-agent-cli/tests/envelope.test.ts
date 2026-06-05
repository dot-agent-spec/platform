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
import { buildAboutme, parseAboutme, aboutmeToJson } from '../src/core/envelope.js'

describe('envelope', () => {
  it('builds aboutme.json', () => {
    const aboutme = buildAboutme({
      id: 'example.com/test:v1.0~abc123',
      name: 'Test Agent',
      description: 'A test agent',
      version: 'v1.0',
      domain: 'example.com',
      persona: 'SOUL.md',
      compiler: 'dot-agent/1.0.0',
      integrity: {
        sha256: 'e3b0c44298fc1c149afbaf8b2b',
        files: '.agent/files.json',
      },
    })

    expect(aboutme.schemaVersion).toBe('dot-agent/1.0')
    expect(aboutme.id).toBe('example.com/test:v1.0~abc123')
    expect(aboutme.name).toBe('Test Agent')
  })

  it('parses aboutme.json', () => {
    const json = {
      schemaVersion: 'dot-agent/1.0',
      id: 'example.com/test:v1.0~abc123',
      name: 'Test Agent',
      description: 'A test agent',
      version: 'v1.0',
      domain: 'example.com',
      license: 'Apache-2.0',
      persona: 'SOUL.md',
      compiler: 'dot-agent/1.0.0',
      skills: [],
      requires: [],
      integrity: { sha256: 'abc123', files: '.agent/files.json' },
    }

    const parsed = parseAboutme(json)
    expect(parsed.name).toBe('Test Agent')
    expect(parsed.schemaVersion).toBe('dot-agent/1.0')
  })

  it('converts aboutme to JSON string', () => {
    const aboutme = buildAboutme({
      id: 'example.com/test:v1.0~abc123',
      name: 'Test Agent',
      description: 'A test agent',
      version: 'v1.0',
      domain: 'example.com',
      persona: 'SOUL.md',
      compiler: 'dot-agent/1.0.0',
      integrity: { sha256: 'abc123', files: '.agent/files.json' },
    })

    const json = aboutmeToJson(aboutme)
    expect(json).toContain('dot-agent/1.0')
    expect(json).toContain('Test Agent')
  })
})
