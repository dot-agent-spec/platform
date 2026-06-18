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
import { parseId, buildId, extractDigest, extractName } from '../src/id.js'

// ── parseId — form D (full) ──────────────────────────────────────────────────

describe('parseId — form D (namespace/name:version~digest)', () => {
  it('parses a domain namespace', () => {
    const parts = parseId('entelekheia.ai/doctor:v1.0~a1b2c3d4')
    expect(parts.namespace).toBe('entelekheia.ai')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBe('a1b2c3d4')
  })

  it('parses a subdomain namespace', () => {
    const parts = parseId('health.example.com/analyst:v2.3.1~deadbeef')
    expect(parts.namespace).toBe('health.example.com')
    expect(parts.name).toBe('analyst')
    expect(parts.version).toBe('v2.3.1')
    expect(parts.digest).toBe('deadbeef')
  })
})

// ── parseId — form B (versioned, no digest) ──────────────────────────────────

describe('parseId — form B (namespace/name:version)', () => {
  it('parses a domain namespace without digest', () => {
    const parts = parseId('entelekheia.ai/doctor:v1.0')
    expect(parts.namespace).toBe('entelekheia.ai')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBeUndefined()
  })

  it('parses a GitHub platform namespace without digest', () => {
    const parts = parseId('github.com/daniloborges/doctor:v1.0')
    expect(parts.namespace).toBe('github.com/daniloborges')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBeUndefined()
  })
})

// ── parseId — form A (bare, no version, no digest) ───────────────────────────

describe('parseId — form A (namespace/name)', () => {
  it('parses a bare domain id', () => {
    const parts = parseId('entelekheia.ai/doctor')
    expect(parts.namespace).toBe('entelekheia.ai')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBeUndefined()
    expect(parts.digest).toBeUndefined()
  })

  it('parses unknown/name', () => {
    const parts = parseId('unknown/doctor')
    expect(parts.namespace).toBe('unknown')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBeUndefined()
    expect(parts.digest).toBeUndefined()
  })
})

// ── parseId — code platform namespaces ───────────────────────────────────────

describe('parseId — code platform namespaces', () => {
  it('parses github.com/user/name (form D)', () => {
    const parts = parseId('github.com/daniloborges/doctor:v1.0~a1b2c3d4')
    expect(parts.namespace).toBe('github.com/daniloborges')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBe('a1b2c3d4')
  })

  it('parses gitlab.com/user/name', () => {
    const parts = parseId('gitlab.com/someuser/agent:v2.0~cafebabe')
    expect(parts.namespace).toBe('gitlab.com/someuser')
    expect(parts.name).toBe('agent')
  })

  it('parses codeberg.org/user/name', () => {
    const parts = parseId('codeberg.org/someuser/agent:v1.0~12345678')
    expect(parts.namespace).toBe('codeberg.org/someuser')
    expect(parts.name).toBe('agent')
  })

  it('parses sr.ht/~user/name — Sourcehut tilde username does not conflict with digest separator', () => {
    const parts = parseId('sr.ht/~reykjalin/doctor:v1.0~a1b2c3d4')
    expect(parts.namespace).toBe('sr.ht/~reykjalin')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBe('a1b2c3d4')
  })

  it('parses sr.ht/~user/name bare (form A)', () => {
    const parts = parseId('sr.ht/~reykjalin/doctor')
    expect(parts.namespace).toBe('sr.ht/~reykjalin')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBeUndefined()
  })

  it('throws when platform namespace is missing user segment', () => {
    expect(() => parseId('github.com/doctor:v1.0~abc')).toThrow()
  })
})

// ── parseId — email namespaces ────────────────────────────────────────────────

describe('parseId — email namespaces', () => {
  it('parses a plain email namespace', () => {
    const parts = parseId('user@gmail.com/doctor:v1.0~a1b2c3d4')
    expect(parts.namespace).toBe('user@gmail.com')
    expect(parts.name).toBe('doctor')
    expect(parts.version).toBe('v1.0')
    expect(parts.digest).toBe('a1b2c3d4')
  })

  it('parses a Gmail plus-alias email namespace', () => {
    const parts = parseId('user+agentcreator@gmail.com/doctor:v1.0~a1b2c3d4')
    expect(parts.namespace).toBe('user+agentcreator@gmail.com')
    expect(parts.name).toBe('doctor')
  })

  it('parses a bare email namespace (form A)', () => {
    const parts = parseId('user@example.com/myagent')
    expect(parts.namespace).toBe('user@example.com')
    expect(parts.name).toBe('myagent')
    expect(parts.version).toBeUndefined()
    expect(parts.digest).toBeUndefined()
  })

  it('throws when email namespace has no name after /', () => {
    expect(() => parseId('user@example.com')).toThrow()
  })
})

// ── parseId — error cases ─────────────────────────────────────────────────────

describe('parseId — error cases', () => {
  it('throws on empty string', () => {
    expect(() => parseId('')).toThrow()
  })

  it('throws on missing / separator (plain name only)', () => {
    expect(() => parseId('doctor')).toThrow()
  })

  it('throws on empty version after :', () => {
    expect(() => parseId('ns/name:')).toThrow()
  })

  it('throws on empty digest after ~', () => {
    expect(() => parseId('ns/name:v1.0~')).toThrow()
  })

  it('throws on empty version before ~', () => {
    expect(() => parseId('ns/name:~abc')).toThrow()
  })
})

// ── buildId ───────────────────────────────────────────────────────────────────

describe('buildId', () => {
  it('builds a full ID (form D)', () => {
    expect(buildId({ namespace: 'entelekheia.ai', name: 'doctor', version: 'v1.0', digest: 'a1b2c3d4' })).toBe(
      'entelekheia.ai/doctor:v1.0~a1b2c3d4',
    )
  })

  it('builds a versioned ID without digest (form B)', () => {
    expect(buildId({ namespace: 'entelekheia.ai', name: 'doctor', version: 'v1.0' })).toBe(
      'entelekheia.ai/doctor:v1.0',
    )
  })

  it('builds a bare ID (form A)', () => {
    expect(buildId({ namespace: 'entelekheia.ai', name: 'doctor' })).toBe('entelekheia.ai/doctor')
  })

  it('builds a GitHub platform ID', () => {
    expect(buildId({ namespace: 'github.com/daniloborges', name: 'doctor', version: 'v1.0', digest: 'a1b2c3d4' })).toBe(
      'github.com/daniloborges/doctor:v1.0~a1b2c3d4',
    )
  })

  it('builds an unknown namespace ID', () => {
    expect(buildId({ namespace: 'unknown', name: 'doctor' })).toBe('unknown/doctor')
  })

  it('builds an email namespace ID', () => {
    expect(buildId({ namespace: 'user@gmail.com', name: 'doctor', version: 'v1.0' })).toBe(
      'user@gmail.com/doctor:v1.0',
    )
  })

  it('throws when namespace is missing', () => {
    expect(() => buildId({ namespace: '', name: 'x', version: 'v1' })).toThrow()
  })

  it('throws when name is missing', () => {
    expect(() => buildId({ namespace: 'ns', name: '' })).toThrow()
  })

  it('throws when digest is provided without version', () => {
    expect(() => buildId({ namespace: 'ns', name: 'x', digest: 'abc' })).toThrow('digest requires version')
  })

  it('round-trips form D: buildId(parseId(x)) === x', () => {
    const original = 'builder.entelekheia.ai/builder:v1.2.0~cafebabe'
    expect(buildId(parseId(original))).toBe(original)
  })

  it('round-trips form B: buildId(parseId(x)) === x', () => {
    const original = 'entelekheia.ai/doctor:v1.0'
    expect(buildId(parseId(original))).toBe(original)
  })

  it('round-trips form A: buildId(parseId(x)) === x', () => {
    const original = 'entelekheia.ai/doctor'
    expect(buildId(parseId(original))).toBe(original)
  })

  it('round-trips sr.ht tilde username (form D)', () => {
    const original = 'sr.ht/~reykjalin/doctor:v1.0~a1b2c3d4'
    expect(buildId(parseId(original))).toBe(original)
  })
})

// ── extractDigest ─────────────────────────────────────────────────────────────

describe('extractDigest', () => {
  it('extracts digest from a full ID', () => {
    expect(extractDigest('ns/name:v1~deadbeef')).toBe('deadbeef')
  })

  it('returns empty string for a bare ID (no digest)', () => {
    expect(extractDigest('ns/name')).toBe('')
  })

  it('returns empty string for an invalid ID', () => {
    expect(extractDigest('not-an-id')).toBe('')
  })
})

// ── extractName ───────────────────────────────────────────────────────────────

describe('extractName', () => {
  it('extracts the agent name from a full ID', () => {
    expect(extractName('ns/builder:v1~abc')).toBe('builder')
  })

  it('extracts the agent name from a bare ID', () => {
    expect(extractName('ns/myagent')).toBe('myagent')
  })

  it('returns empty string for an invalid ID', () => {
    expect(extractName('bad')).toBe('')
  })
})
