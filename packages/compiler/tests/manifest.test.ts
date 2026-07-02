// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect } from 'vitest'
import { buildAboutme, parseAboutme, aboutmeToJson } from '../src/manifest.js'
import { DSL_VERSION } from '../src/generated-version.js'

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
  it('sets dslVersion from DSL_VERSION', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.dslVersion).toBe(`dot-agent/${DSL_VERSION}`)
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

  it('defaults license to empty string when omitted', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.license).toBe('')
  })

  it('uses provided license', () => {
    const a = buildAboutme({ ...BASE_OPTS, license: 'MIT' })
    expect(a.license).toBe('MIT')
  })

  it('defaults purpose to "unknown" when omitted', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.purpose).toBe('unknown')
  })

  it('defaults capabilities and requires to empty arrays', () => {
    const a = buildAboutme(BASE_OPTS)
    expect(a.capabilities).toEqual([])
    expect(a.requires).toEqual([])
  })

  it('carries optional commit through', () => {
    const a = buildAboutme({ ...BASE_OPTS, commit: 'abc1234' })
    expect(a.commit).toBe('abc1234')
  })

  it('carries custom capabilities and requires', () => {
    const a = buildAboutme({
      ...BASE_OPTS,
      capabilities: [{ id: 'TriagePatient', description: 'Triagem inicial' }],
      requires: [{ name: 'UserProfile', description: 'Patient data' }],
    })
    expect(a.capabilities).toHaveLength(1)
    expect(a.capabilities[0].id).toBe('TriagePatient')
    expect(a.requires[0].name).toBe('UserProfile')
  })
})

describe('parseAboutme', () => {
  const VALID_JSON = {
    dslVersion: 'dot-agent/1.0',
    id: 'health.example.com/doctor:v1.0~a1b2c3d4',
    name: 'Doctor',
    description: 'Clinical diagnostic agent',
    version: 'v1.0',
    domain: 'health.example.com',
    license: 'MIT',
    persona: 'SOUL.md',
    purpose: 'unknown',
    compiler: 'dot-agent/1.0.0',
    capabilities: [],
    requires: [],
    integrity: { sha256: 'e3b0c44', files: '.agent/files.json' },
  }

  it('parses a valid aboutme JSON', () => {
    const a = parseAboutme(VALID_JSON)
    expect(a.name).toBe('Doctor')
    expect(a.dslVersion).toBe('dot-agent/1.0')
    expect(a.capabilities).toEqual([])
  })

  it('round-trips: buildAboutme → aboutmeToJson → JSON.parse → parseAboutme', () => {
    const original = buildAboutme(BASE_OPTS)
    const json = aboutmeToJson(original)
    const parsed = parseAboutme(JSON.parse(json))
    expect(parsed).toEqual(original)
  })

  it.each(['dslVersion', 'id', 'name', 'description', 'version', 'domain', 'persona', 'compiler'])(
    'throws when required field "%s" is missing',
    field => {
      const incomplete = { ...VALID_JSON, [field]: undefined }
      expect(() => parseAboutme(incomplete)).toThrow()
    }
  )

  it('throws when capabilities is not an array', () => {
    expect(() => parseAboutme({ ...VALID_JSON, capabilities: 'nope' })).toThrow('Missing capabilities array')
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
    expect(json).toContain(`"dslVersion": "dot-agent/${DSL_VERSION}"`)
    expect(json).toContain('"name": "Doctor"')
    expect(() => JSON.parse(json)).not.toThrow()
  })
})
