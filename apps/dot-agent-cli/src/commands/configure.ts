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

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

export interface ConfigureResult {
  dest?: string
  mcpConfigPath?: string
  mcpConfigured?: boolean
  skillInstalled?: boolean
  registeredServers?: string[]
  skillSkippedReason?: string
}

export interface ConfigureOptions {
  claude?: boolean
  gemini?: boolean
  agy?: boolean
  murici?: boolean
  skill?: boolean
  mcp?: boolean
}

type TargetName = 'claude' | 'gemini' | 'murici'
type ServerKey = 'helper' | 'dev'

interface McpServerSpec {
  command: string
  args: string[]
}

const SERVERS: Record<ServerKey, McpServerSpec> = {
  helper: { command: 'dot-agent', args: ['run', '--helper'] },
  dev: { command: 'dot-agent', args: ['server-mcp', '--mcp-transport', 'stdio'] },
}

const SERVER_NAMES: Record<ServerKey, string> = {
  helper: 'dot-agent-helper',
  dev: 'dot-agent-dev',
}

interface ConfigureTarget {
  mcpConfigPath: string
  mcpServerKeys: ServerKey[]
  formatServerEntry: (spec: McpServerSpec) => Record<string, unknown>
  // undefined = this target has no skill-file concept (e.g. murici)
  skillDest?: string
}

function getTargets(): Record<TargetName, ConfigureTarget> {
  return {
    claude: {
      mcpConfigPath: join(homedir(), '.claude.json'),
      mcpServerKeys: ['helper', 'dev'],
      formatServerEntry: spec => ({ ...spec }),
      skillDest: join(homedir(), '.claude', 'skills', 'dot-agent', 'SKILL.md'),
    },
    gemini: {
      mcpConfigPath: join(homedir(), '.gemini', 'config', 'mcp_config.json'),
      mcpServerKeys: ['helper', 'dev'],
      formatServerEntry: spec => ({ ...spec }),
      skillDest: join(homedir(), '.gemini', 'config', 'skills', 'dot-agent', 'SKILL.md'),
    },
    murici: {
      // murici's MCP client config (lib/mcp/config-store.ts) requires an explicit transport
      // field and only supports stdio/legacy sse — no skill-file concept exists there.
      mcpConfigPath: join(homedir(), '.config', 'murici', 'mcp.json'),
      mcpServerKeys: ['helper'],
      formatServerEntry: spec => ({ transport: 'stdio', ...spec }),
    },
  }
}

async function configureMcpServer(target: ConfigureTarget): Promise<{ path: string; registeredServers: string[] }> {
  const configPath = target.mcpConfigPath

  let config: any = {}
  try {
    const content = await readFile(configPath, 'utf-8')
    config = JSON.parse(content)
  } catch {
    // File doesn't exist or is invalid JSON
  }

  if (!config.mcpServers) {
    config.mcpServers = {}
  }

  const registeredServers: string[] = []
  for (const key of target.mcpServerKeys) {
    const serverName = SERVER_NAMES[key]
    config.mcpServers[serverName] = target.formatServerEntry(SERVERS[key])
    registeredServers.push(serverName)
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

  return { path: configPath, registeredServers }
}

export async function configure(options?: ConfigureOptions): Promise<ConfigureResult[]> {
  const targets: TargetName[] = []
  if (options?.claude) targets.push('claude')
  if (options?.gemini || options?.agy) targets.push('gemini')
  if (options?.murici) targets.push('murici')

  if (targets.length === 0) {
    targets.push('claude')
  }

  const doSkill = options?.skill ?? (!options?.mcp)
  const doMcp = options?.mcp ?? (!options?.skill)

  const allTargets = getTargets()
  const results: ConfigureResult[] = []

  for (const targetName of targets) {
    const target = allTargets[targetName]
    const result: ConfigureResult = {}

    if (doSkill) {
      if (target.skillDest) {
        const skillSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dot-agent', 'SKILL.md')
        const skillContent = await readFile(skillSrc, 'utf-8')

        await mkdir(dirname(target.skillDest), { recursive: true })
        await writeFile(target.skillDest, skillContent, 'utf-8')

        result.dest = target.skillDest
        result.skillInstalled = true
      } else if (!doMcp) {
        result.skillSkippedReason = `${targetName} has no skill file — nothing to install.`
      }
    }

    if (doMcp) {
      const { path: mcpPath, registeredServers } = await configureMcpServer(target)
      result.mcpConfigPath = mcpPath
      result.mcpConfigured = true
      result.registeredServers = registeredServers
    }

    results.push(result)
  }

  return results
}
