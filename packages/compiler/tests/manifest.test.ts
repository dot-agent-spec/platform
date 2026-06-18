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
import { buildAboutme, parseAboutme, aboutmeToJson } from '../src/manifest.js'

const BASE_OPTS = {
  id: 'health.example.com/doctor:v1.0~a1b2c3d4',
  name: 'Doctor',
  description: 'Clinical diagnostic agent',
  version: 'v1.0',
  domain: 'health.example.com',
  persona: 'SOUL.md',
  compiler: 'dot-agent/1.0.0',
  integrity: { sha256: 'e3b0c44298fc1c149afbf8b2b', files: '.agent/files.json' },
} as const

describe('buildAboutme', () => {
  it('sets schemaVersion to dot-agent/1.0', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.schemaVersion).toBe('dot-agent/1.0')
  })

  it('propagates all required fields', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.id).toBe(BASE_OPTS.id)
    expect(a.name).toBe('Doctor')
    expect(a.version).toBe('v1.0')
    expect(a.domain).toBe('health.example.com')
    expect(a.persona).toBe('SOUL.md')
    expect(a.compiler).toBe('dot-agent/1.0.0')
  })

  it('defaults license to Apache-2.0 when omitted', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.license).toBe('Apache-2.0')
  })

  it('uses provided license', () => {
    const a = buildAboutme({ ...BASE_OPTS, license: 'MIT' })
    expect(a.license).toBe('MIT')
  })

  it('defaults skills and requires to empty arrays', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.skills).toEqual([])
    expect(a.requires).toEqual([])
  })

  it('carries optional commit through', () => {
    const a = buildAboutme({ ...BASE_OPTS, commit: 'abc1234' })
    expect(a.commit).toBe('abc1234')
  })

  it('carries custom skills and requires', () => {
    const a = buildAboutme({
      ...BASE_OPTS,
      skills: [{ id: 'search', description: 'Web search' }],
      requires: ['UserProfile'],
    })
    expect(a.skills).toHaveLength(1)
    expect(a.requires).toContain('UserProfile')
  })
})

describe('parseAboutme', () => {
  const VALID_JSON = {
    schemaVersion: 'dot-agent/1.0',
    id: 'health.example.com/doctor:v1.0~a1b2c3d4',
    name: 'Doctor',
    description: 'Clinical diagnostic agent',
    version: 'v1.0',
    domain: 'health.example.com',
    license: 'MIT',
    persona: 'SOUL.md',
    compiler: 'dot-agent/1.0.0',
    skills: [],
    requires: [],
    integrity: { sha256: 'e3b0c44', files: '.agent/files.json' },
  }

  it('parses a valid aboutme JSON', () => {
    const a = parseAboutme(VALID_JSON)
    expect(a.name).toBe('Doctor')
    expect(a.schemaVersion).toBe('dot-agent/1.0')
    expect(a.skills).toEqual([])
  })

  it('round-trips: buildAboutme → aboutmeToJson → JSON.parse → parseAboutme', () => {
    const original = buildAboutme(BASE_OPTS)
    const json = aboutmeToJson(original)
    const parsed = parseAboutme(JSON.parse(json))
    expect(parsed).toEqual(original)
  })

  it.each(['schemaVersion', 'id', 'name', 'description', 'version', 'domain', 'license', 'persona', 'compiler'])(
    'throws when required field "%s" is missing',
    field => {
      const incomplete = { ...VALID_JSON, [field]: undefined }
      expect(() => parseAboutme(incomplete)).toThrow()
    }
  )

  it('throws when skills is not an array', () => {
    expect(() => parseAboutme({ ...VALID_JSON, skills: 'nope' })).toThrow('Missing skills array')
  })

  it('throws when requires is not an array', () => {
    expect(() => parseAboutme({ ...VALID_JSON, requires: null })).toThrow('Missing requires array')
  })

  it('throws when integrity is missing', () => {
    expect(() => parseAboutme({ ...VALID_JSON, integrity: undefined })).toThrow('Missing integrity')
  })
})

describe('aboutmeToJson', () => {
  it('returns a pretty-printed JSON string', () => {
    const a = buildAboutme(BASE_OPTS)
    const json = aboutmeToJson(a)
    expect(json).toContain('"schemaVersion": "dot-agent/1.0"')
    expect(json).toContain('"name": "Doctor"')
    expect(() => JSON.parse(json)).not.toThrow()
  })
})
