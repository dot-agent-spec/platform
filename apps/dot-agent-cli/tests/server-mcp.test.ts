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
import { startDevMcpServer } from '../src/commands/server-mcp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Mock the commands
vi.mock('../src/commands/init.js', () => ({
  init: vi.fn().mockResolvedValue({ dir: '/mock/dir', files: ['file1'] }),
}))
vi.mock('../src/commands/pack.js', () => ({
  pack: vi.fn().mockResolvedValue({ path: '/mock/path.agent', id: 'agent-id', warnings: [] }),
}))
vi.mock('../src/commands/unpack.js', () => ({
  unpack: vi.fn().mockResolvedValue({ dir: '/mock/unpack-dir', id: 'agent-id', files: [] }),
}))
vi.mock('../src/commands/configure.js', () => ({
  configure: vi.fn().mockResolvedValue([{ dest: '/mock/skill/path', mcpConfigured: true }]),
}))

// Mock SDK classes
const registeredTools: Record<string, Function> = {}

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: vi.fn().mockImplementation(() => ({
      tool: vi.fn().mockImplementation((name: string, desc: string, schema: any, handler: Function) => {
        registeredTools[name] = handler
      }),
      connect: vi.fn().mockResolvedValue(undefined),
    }))
  }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}))

describe('server-mcp command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key in registeredTools) {
      delete registeredTools[key]
    }
  })

  it('starts the server and registers dev tools', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    expect(McpServer).toHaveBeenCalled()
    expect(registeredTools['dot_agent_init']).toBeDefined()
    expect(registeredTools['dot_agent_pack']).toBeDefined()
    expect(registeredTools['dot_agent_unpack']).toBeDefined()
    expect(registeredTools['dot_agent_configure']).toBeDefined()
  })

  it('tool handlers invoke correct commands', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    // Test dot_agent_init
    const initRes = await registeredTools['dot_agent_init']({ name: 'test', domain: 'example.com', dir: '/test' })
    expect(JSON.parse(initRes.content[0].text)).toEqual({ ok: true, dir: '/mock/dir', files: ['file1'] })

    // Test dot_agent_pack
    const packRes = await registeredTools['dot_agent_pack']({ dir: '/test' })
    expect(JSON.parse(packRes.content[0].text)).toEqual({ ok: true, path: '/mock/path.agent', id: 'agent-id', warnings: [] })

    // Test dot_agent_unpack
    const unpackRes = await registeredTools['dot_agent_unpack']({ file: '/test.agent' })
    expect(JSON.parse(unpackRes.content[0].text)).toEqual({ ok: true, dir: '/mock/unpack-dir', id: 'agent-id', files: [] })

    // Test dot_agent_configure
    const configureRes = await registeredTools['dot_agent_configure']({ claude: true })
    expect(JSON.parse(configureRes.content[0].text)).toEqual({ ok: true, results: [{ dest: '/mock/skill/path', mcpConfigured: true }] })
  })
})
