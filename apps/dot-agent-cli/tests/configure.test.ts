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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configure } from '../src/commands/configure.js'
import { readFile, writeFile, mkdir } from 'fs/promises'

vi.mock('os', () => ({
  homedir: () => '/mock/home',
}))

const mockFiles: Record<string, string> = {}

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('SKILL.md')) {
      return 'mock skill content'
    }
    if (mockFiles[path]) {
      return mockFiles[path]
    }
    throw new Error('ENOENT')
  }),
  writeFile: vi.fn(async (path: string, content: string) => {
    mockFiles[path] = content
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

describe('configure command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key in mockFiles) {
      delete mockFiles[key]
    }
  })

  it('configures both skill and mcp for claude by default', async () => {
    const results = await configure()
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.claude/skills/dot-agent/SKILL.md')
    expect(results[0].mcpConfigured).toBe(true)
    expect(results[0].mcpConfigPath).toBe('/mock/home/.claude.json')

    const config = JSON.parse(mockFiles['/mock/home/.claude.json'])
    expect(config.mcpServers['dot-agent-helper']).toEqual({
      command: 'dot-agent',
      args: ['run', '--helper'],
    })
    expect(config.mcpServers['dot-agent-dev']).toEqual({
      command: 'dot-agent',
      args: ['server-mcp', '--mcp-transport', 'stdio'],
    })
  })

  it('configures only skill when skill option is true and mcp is false', async () => {
    const results = await configure({ claude: true, skill: true, mcp: false })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.claude/skills/dot-agent/SKILL.md')
    expect(results[0].skillInstalled).toBe(true)
    expect(results[0].mcpConfigured).toBeUndefined()
    expect(mockFiles['/mock/home/.claude.json']).toBeUndefined()
  })

  it('configures only mcp when mcp option is true and skill is false', async () => {
    const results = await configure({ claude: true, skill: false, mcp: true })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBeUndefined()
    expect(results[0].skillInstalled).toBeUndefined()
    expect(results[0].mcpConfigured).toBe(true)
    expect(mockFiles['/mock/home/.claude.json']).toBeDefined()
  })

  it('configures both platforms for both options when requested', async () => {
    const results = await configure({ claude: true, gemini: true })
    expect(results).toHaveLength(2)

    expect(results.map(r => r.dest)).toContain('/mock/home/.claude/skills/dot-agent/SKILL.md')
    expect(results.map(r => r.dest)).toContain('/mock/home/.gemini/config/skills/dot-agent/SKILL.md')
    expect(results.map(r => r.mcpConfigPath)).toContain('/mock/home/.claude.json')
    expect(results.map(r => r.mcpConfigPath)).toContain('/mock/home/.gemini/config/mcp_config.json')
  })

  it('registers only dot-agent-helper for murici, using its stdio transport schema, with no skill file', async () => {
    const results = await configure({ murici: true })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBeUndefined()
    expect(results[0].skillInstalled).toBeUndefined()
    expect(results[0].mcpConfigured).toBe(true)
    expect(results[0].mcpConfigPath).toBe('/mock/home/.config/murici/mcp.json')
    expect(results[0].registeredServers).toEqual(['dot-agent-helper'])

    const config = JSON.parse(mockFiles['/mock/home/.config/murici/mcp.json'])
    expect(config.mcpServers['dot-agent-helper']).toEqual({
      transport: 'stdio',
      command: 'dot-agent',
      args: ['run', '--helper'],
    })
    expect(config.mcpServers['dot-agent-dev']).toBeUndefined()
  })

  it('warns instead of writing anything when skill-only is requested for murici', async () => {
    const results = await configure({ murici: true, skill: true, mcp: false })
    expect(results).toHaveLength(1)
    expect(results[0].skillInstalled).toBeUndefined()
    expect(results[0].mcpConfigured).toBeUndefined()
    expect(results[0].skillSkippedReason).toMatch(/murici has no skill file/)
    expect(mockFiles['/mock/home/.config/murici/mcp.json']).toBeUndefined()
  })

  it('configures claude and murici together with distinct config paths', async () => {
    const results = await configure({ claude: true, murici: true })
    expect(results).toHaveLength(2)
    expect(results.map(r => r.mcpConfigPath)).toContain('/mock/home/.claude.json')
    expect(results.map(r => r.mcpConfigPath)).toContain('/mock/home/.config/murici/mcp.json')
  })
})
