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
