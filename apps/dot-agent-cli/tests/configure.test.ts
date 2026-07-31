// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configure, removeLegacyMcpEntries } from '../src/commands/configure.js'
import { HostCommandError } from '../src/host-command.js'
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
  rename: vi.fn(async (oldPath: string, newPath: string) => {
    mockFiles[newPath] = mockFiles[oldPath]
    delete mockFiles[oldPath]
  }),
}))

// configure's claude target shells out via host-command.ts (ADR-DA00-08) rather than touching
// child_process directly, so it's mocked at that boundary — host-command.ts's own error-mapping
// (ENOENT vs non-zero exit vs timeout) already has dedicated coverage in host-command.test.ts.
type CannedHostResponse = { stdout?: string; stderr?: string; error?: unknown }
const hostCalls: string[][] = []
let hostResponses: Record<string, CannedHostResponse> = {}

function hostKey(bin: string, args: string[]): string {
  return [bin, ...args].join(' ')
}

function setHostResponse(bin: string, args: string[], response: CannedHostResponse) {
  hostResponses[hostKey(bin, args)] = response
}

// The "nothing unusual" path every plugin-install test can start from: no existing marketplace, a
// clean add + install, and a plugin list that reports it installed and enabled.
function setupHappyPathHost() {
  setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], { stdout: '[]' })
  setHostResponse('claude', ['plugin', 'marketplace', 'add', 'dot-agent-spec/platform', '--sparse', '.claude-plugin', 'plugins'], {
    stdout: '',
  })
  setHostResponse('claude', ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'], { stdout: '' })
  setHostResponse('claude', ['plugin', 'list', '--json'], {
    stdout: JSON.stringify([{ id: 'dot-agent@dot-agent-spec', version: '0.1.0', enabled: true }]),
  })
}

vi.mock('../src/host-command.js', async () => {
  const actual = await vi.importActual<typeof import('../src/host-command.js')>('../src/host-command.js')
  return {
    HostCommandError: actual.HostCommandError,
    runHostCommand: vi.fn(async (bin: string, args: string[]) => {
      hostCalls.push([bin, ...args])
      const canned = hostResponses[hostKey(bin, args)]
      if (!canned) {
        throw new actual.HostCommandError(`unstubbed host command in test: ${hostKey(bin, args)}`, 'failed', bin, args)
      }
      if (canned.error) throw canned.error
      return { stdout: canned.stdout ?? '', stderr: canned.stderr ?? '' }
    }),
  }
})

describe('configure command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key in mockFiles) {
      delete mockFiles[key]
    }
    hostResponses = {}
    hostCalls.length = 0
  })

  it('installs the plugin for claude by default, adding the marketplace since none exists', async () => {
    setupHappyPathHost()

    const results = await configure()
    expect(results).toHaveLength(1)
    expect(results[0].target).toBe('claude')
    expect(results[0].pluginId).toBe('dot-agent@dot-agent-spec')
    expect(results[0].pluginVersion).toBe('0.1.0')
    expect(results[0].pluginEnabled).toBe(true)
    expect(results[0].marketplaceAdded).toBe(true)
    expect(results[0].marketplaceSource).toBe('dot-agent-spec/platform')
    expect(results[0].legacyEntriesRemoved).toEqual([])

    // No skill file, no direct MCP config write — the plugin delivers both.
    expect(results[0].dest).toBeUndefined()
    expect(results[0].mcpConfigured).toBeUndefined()
    expect(mockFiles['/mock/home/.claude.json']).toBeUndefined()
  })

  it('ignores --skill/--mcp for claude and always installs the full plugin', async () => {
    setupHappyPathHost()

    const results = await configure({ claude: true, skill: true, mcp: false })
    expect(results).toHaveLength(1)
    expect(results[0].pluginId).toBe('dot-agent@dot-agent-spec')
    expect(mockFiles['/mock/home/.claude.json']).toBeUndefined()
  })

  it('installs the skill for gemini, which has no plugin equivalent', async () => {
    const results = await configure({ gemini: true, skill: true, mcp: false })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBe('/mock/home/.gemini/config/skills/dot-agent/SKILL.md')
    expect(results[0].skillInstalled).toBe(true)
    expect(results[0].skillSkippedReason).toBeUndefined()
    expect(hostCalls).toEqual([])
  })

  it('configures only mcp for gemini when mcp option is true and skill is false', async () => {
    const results = await configure({ gemini: true, skill: false, mcp: true })
    expect(results).toHaveLength(1)
    expect(results[0].dest).toBeUndefined()
    expect(results[0].skillInstalled).toBeUndefined()
    expect(results[0].mcpConfigured).toBe(true)
    expect(mockFiles['/mock/home/.gemini/config/mcp_config.json']).toBeDefined()
  })

  it('configures claude and gemini together — plugin install for claude, file writes only for gemini', async () => {
    setupHappyPathHost()

    const results = await configure({ claude: true, gemini: true })
    expect(results).toHaveLength(2)

    const claudeResult = results.find(r => r.target === 'claude')!
    const geminiResult = results.find(r => r.target === 'gemini')!

    expect(claudeResult.pluginId).toBe('dot-agent@dot-agent-spec')
    expect(mockFiles['/mock/home/.claude.json']).toBeUndefined()

    expect(geminiResult.dest).toBe('/mock/home/.gemini/config/skills/dot-agent/SKILL.md')
    expect(geminiResult.mcpConfigPath).toBe('/mock/home/.gemini/config/mcp_config.json')
  })

  it('removes legacy CLI-written MCP entries end-to-end after installing the plugin', async () => {
    setupHappyPathHost()
    mockFiles['/mock/home/.claude.json'] = JSON.stringify({
      mcpServers: {
        'dot-agent': { command: 'dot-agent', args: ['run', '--helper'] },
        'dot-agent-dev': { command: 'dot-agent', args: ['server-mcp', '--mcp-transport', 'stdio'] },
        'chrome-devtools': { command: 'npx', args: [] },
      },
    })

    const results = await configure({ claude: true })
    expect(results[0].legacyEntriesRemoved?.slice().sort()).toEqual(['dot-agent', 'dot-agent-dev'])

    const config = JSON.parse(mockFiles['/mock/home/.claude.json'])
    expect(config.mcpServers['dot-agent']).toBeUndefined()
    expect(config.mcpServers['dot-agent-dev']).toBeUndefined()
    expect(config.mcpServers['chrome-devtools']).toBeDefined()
  })

  it('does not re-add an existing marketplace on a second run (idempotent)', async () => {
    setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], {
      stdout: JSON.stringify([{ name: 'dot-agent-spec', source: 'github', repo: 'dot-agent-spec/platform' }]),
    })
    setHostResponse('claude', ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'], { stdout: '' })
    setHostResponse('claude', ['plugin', 'list', '--json'], {
      stdout: JSON.stringify([{ id: 'dot-agent@dot-agent-spec', version: '0.1.0', enabled: true }]),
    })

    const results = await configure({ claude: true })
    expect(results[0].marketplaceAdded).toBe(false)
    expect(results[0].marketplaceSource).toBe('dot-agent-spec/platform')
    expect(hostCalls.some(c => c.includes('add'))).toBe(false)
  })

  it('uses an existing marketplace pointing at a local directory as-is, without re-adding', async () => {
    setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], {
      stdout: JSON.stringify([{ name: 'dot-agent-spec', source: 'directory', path: '/Users/dev/dot-agent-spec' }]),
    })
    setHostResponse('claude', ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'], { stdout: '' })
    setHostResponse('claude', ['plugin', 'list', '--json'], {
      stdout: JSON.stringify([{ id: 'dot-agent@dot-agent-spec', version: '0.1.0', enabled: true }]),
    })

    const results = await configure({ claude: true })
    expect(results[0].marketplaceAdded).toBe(false)
    expect(results[0].marketplaceSource).toBe('/Users/dev/dot-agent-spec')
    expect(hostCalls.some(c => c.includes('add'))).toBe(false)
  })

  it('falls through to adding the marketplace when marketplace list returns unparseable output', async () => {
    setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], { stdout: 'not json' })
    setHostResponse('claude', ['plugin', 'marketplace', 'add', 'dot-agent-spec/platform', '--sparse', '.claude-plugin', 'plugins'], {
      stdout: '',
    })
    setHostResponse('claude', ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'], { stdout: '' })
    setHostResponse('claude', ['plugin', 'list', '--json'], { stdout: JSON.stringify([{ id: 'dot-agent@dot-agent-spec' }]) })

    const results = await configure({ claude: true })
    expect(results[0].marketplaceAdded).toBe(true)
  })

  it('retries the marketplace add without --sparse when the host does not support the flag', async () => {
    setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], { stdout: '[]' })
    setHostResponse('claude', ['plugin', 'marketplace', 'add', 'dot-agent-spec/platform', '--sparse', '.claude-plugin', 'plugins'], {
      error: new HostCommandError(
        'failed',
        'failed',
        'claude',
        ['plugin', 'marketplace', 'add', 'dot-agent-spec/platform', '--sparse', '.claude-plugin', 'plugins'],
        1,
        'error: unknown option --sparse',
      ),
    })
    setHostResponse('claude', ['plugin', 'marketplace', 'add', 'dot-agent-spec/platform'], { stdout: '' })
    setHostResponse('claude', ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'], { stdout: '' })
    setHostResponse('claude', ['plugin', 'list', '--json'], { stdout: JSON.stringify([{ id: 'dot-agent@dot-agent-spec' }]) })

    const results = await configure({ claude: true })
    expect(results[0].marketplaceAdded).toBe(true)
  })

  it('reports when the plugin is installed but disabled', async () => {
    setupHappyPathHost()
    setHostResponse('claude', ['plugin', 'list', '--json'], {
      stdout: JSON.stringify([{ id: 'dot-agent@dot-agent-spec', version: '0.1.0', enabled: false }]),
    })

    const results = await configure({ claude: true })
    expect(results[0].pluginEnabled).toBe(false)
  })

  it('fails clearly and writes nothing when the claude binary is missing', async () => {
    setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], {
      error: new HostCommandError(
        '`claude` is not installed or not on your PATH — cannot configure this host.',
        'not-found',
        'claude',
        ['plugin', 'marketplace', 'list', '--json'],
      ),
    })

    await expect(configure({ claude: true })).rejects.toThrow(/not on your PATH/)
    expect(mockFiles['/mock/home/.claude.json']).toBeUndefined()
  })

  it('surfaces the host command failure message when plugin install fails', async () => {
    setHostResponse('claude', ['plugin', 'marketplace', 'list', '--json'], { stdout: '[]' })
    setHostResponse('claude', ['plugin', 'marketplace', 'add', 'dot-agent-spec/platform', '--sparse', '.claude-plugin', 'plugins'], {
      stdout: '',
    })
    setHostResponse('claude', ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'], {
      error: new HostCommandError(
        '`claude plugin install dot-agent@dot-agent-spec` failed (exit 1).\n✘ Unknown plugin "dot-agent@dot-agent-spec"',
        'failed',
        'claude',
        ['plugin', 'install', 'dot-agent@dot-agent-spec', '--scope', 'user'],
        1,
        '✘ Unknown plugin "dot-agent@dot-agent-spec"',
      ),
    })

    await expect(configure({ claude: true })).rejects.toThrow(/Unknown plugin/)
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
    expect(config.mcpServers['dot-agent']).toBeUndefined()
  })

  it('warns instead of writing anything when skill-only is requested for murici', async () => {
    const results = await configure({ murici: true, skill: true, mcp: false })
    expect(results).toHaveLength(1)
    expect(results[0].skillInstalled).toBeUndefined()
    expect(results[0].mcpConfigured).toBeUndefined()
    expect(results[0].skillSkippedReason).toMatch(/murici has no skill file/)
    expect(mockFiles['/mock/home/.config/murici/mcp.json']).toBeUndefined()
  })

  it('configures claude and murici together with distinct outcomes', async () => {
    setupHappyPathHost()

    const results = await configure({ claude: true, murici: true })
    expect(results).toHaveLength(2)

    const claudeResult = results.find(r => r.target === 'claude')!
    const muriciResult = results.find(r => r.target === 'murici')!

    expect(claudeResult.pluginId).toBe('dot-agent@dot-agent-spec')
    expect(mockFiles['/mock/home/.claude.json']).toBeUndefined()
    expect(muriciResult.mcpConfigPath).toBe('/mock/home/.config/murici/mcp.json')
  })
})

// The config file this cleans up (~/.claude.json for the real claude target) holds a host's entire user
// state, not just mcpServers — these tests pin the conservative behavior that makes deleting from it
// safe, at a lower level than the end-to-end coverage in the 'configure command' suite above.
describe('removeLegacyMcpEntries', () => {
  const path = '/mock/home/.claude.json'
  const legacyNames = ['dot-agent', 'dot-agent-helper', 'dot-agent-dev']

  beforeEach(() => {
    vi.clearAllMocks()
    for (const key in mockFiles) {
      delete mockFiles[key]
    }
  })

  it('does nothing and never creates the file when it does not exist', async () => {
    const result = await removeLegacyMcpEntries(path, legacyNames)
    expect(result).toEqual({ path, removed: [] })
    expect(writeFile).not.toHaveBeenCalled()
    expect(mkdir).not.toHaveBeenCalled()
  })

  it('refuses to touch a corrupt file and leaves it byte-identical', async () => {
    const corrupt = '{ not json'
    mockFiles[path] = corrupt

    await expect(removeLegacyMcpEntries(path, legacyNames)).rejects.toThrow(/not valid JSON/)
    expect(mockFiles[path]).toBe(corrupt)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('writes nothing when mcpServers has no entries to remove', async () => {
    mockFiles[path] = JSON.stringify({ mcpServers: { 'chrome-devtools': { command: 'npx', args: [] } } })

    const result = await removeLegacyMcpEntries(path, legacyNames)
    expect(result).toEqual({ path, removed: [] })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('deletes only the exact legacy names, leaving neighbors and lookalikes untouched', async () => {
    mockFiles[path] = JSON.stringify({
      someOtherTopLevelKey: 'untouched',
      mcpServers: {
        'dot-agent': { command: 'dot-agent', args: ['run', '--helper'] },
        'dot-agent-helper': { command: 'dot-agent', args: ['run', '--helper'] },
        'dot-agent-dev': { command: 'dot-agent', args: ['server-mcp', '--mcp-transport', 'stdio'] },
        'chrome-devtools': { command: 'npx', args: ['chrome-devtools-mcp@latest'] },
        'dot-agent-mine': { command: 'my-own-thing', args: [] },
      },
    })

    const result = await removeLegacyMcpEntries(path, legacyNames)
    expect(result.removed.sort()).toEqual(['dot-agent', 'dot-agent-dev', 'dot-agent-helper'])

    const config = JSON.parse(mockFiles[path])
    expect(config.someOtherTopLevelKey).toBe('untouched')
    expect(Object.keys(config.mcpServers).sort()).toEqual(['chrome-devtools', 'dot-agent-mine'])
  })
})
