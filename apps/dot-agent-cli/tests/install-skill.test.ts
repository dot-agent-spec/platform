import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installSkill } from '../src/commands/install-skill.js'
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

describe('installSkill command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key in mockFiles) {
      delete mockFiles[key]
    }
  })

  it('installs to claude by default', async () => {
    const results = await installSkill()
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.claude/skills/dot-agent/SKILL.md')
    expect(mkdir).toHaveBeenCalledWith('/mock/home/.claude/skills/dot-agent', { recursive: true })
    expect(writeFile).toHaveBeenCalledWith('/mock/home/.claude/skills/dot-agent/SKILL.md', 'mock skill content', 'utf-8')
  })

  it('installs to claude when claude: true is passed', async () => {
    const results = await installSkill({ claude: true })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.claude/skills/dot-agent/SKILL.md')
  })

  it('installs to gemini when gemini: true is passed', async () => {
    const results = await installSkill({ gemini: true })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.gemini/config/skills/dot-agent/SKILL.md')
  })

  it('installs to gemini when agy: true is passed', async () => {
    const results = await installSkill({ agy: true })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.gemini/config/skills/dot-agent/SKILL.md')
  })

  it('installs to both platforms when both target options are passed', async () => {
    const results = await installSkill({ claude: true, gemini: true })
    expect(results).toHaveLength(2)
    expect(results.map(r => r.dest)).toContain('/mock/home/.claude/skills/dot-agent/SKILL.md')
    expect(results.map(r => r.dest)).toContain('/mock/home/.gemini/config/skills/dot-agent/SKILL.md')
  })

  it('configures MCP for claude when mcp: true is passed', async () => {
    const results = await installSkill({ claude: true, mcp: true })
    expect(results[0].mcpConfigured).toBe(true)
    expect(results[0].mcpConfigPath).toBe('/mock/home/.claude.json')

    const configContent = JSON.parse(mockFiles['/mock/home/.claude.json'])
    expect(configContent.mcpServers['dot-agent']).toEqual({
      command: 'dot-agent',
      args: ['run', '--helper'],
    })
  })

  it('configures MCP for gemini when mcp: true is passed', async () => {
    const results = await installSkill({ gemini: true, mcp: true })
    expect(results[0].mcpConfigured).toBe(true)
    expect(results[0].mcpConfigPath).toBe('/mock/home/.gemini/antigravity-ide/mcp_config.json')

    const configContent = JSON.parse(mockFiles['/mock/home/.gemini/antigravity-ide/mcp_config.json'])
    expect(configContent.mcpServers['dot-agent']).toEqual({
      command: 'dot-agent',
      args: ['run', '--helper'],
    })
  })

  it('preserves existing MCP servers when configuring MCP', async () => {
    mockFiles['/mock/home/.claude.json'] = JSON.stringify({
      mcpServers: {
        'existing-server': {
          command: 'node',
          args: ['some-script.js'],
        },
      },
    })

    await installSkill({ claude: true, mcp: true })

    const configContent = JSON.parse(mockFiles['/mock/home/.claude.json'])
    expect(configContent.mcpServers['existing-server']).toEqual({
      command: 'node',
      args: ['some-script.js'],
    })
    expect(configContent.mcpServers['dot-agent']).toEqual({
      command: 'dot-agent',
      args: ['run', '--helper'],
    })
  })
})
