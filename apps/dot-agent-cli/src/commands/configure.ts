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
}

export interface ConfigureOptions {
  claude?: boolean
  gemini?: boolean
  agy?: boolean
  skill?: boolean
  mcp?: boolean
}

async function configureMcpServer(target: 'claude' | 'gemini'): Promise<{ path: string }> {
  const configPath = target === 'claude'
    ? join(homedir(), '.claude.json')
    : join(homedir(), '.gemini', 'config', 'mcp_config.json')

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

  config.mcpServers['dot-agent-helper'] = {
    command: 'dot-agent',
    args: ['run', '--helper']
  }

  config.mcpServers['dot-agent-dev'] = {
    command: 'dot-agent',
    args: ['server-mcp', '--mcp-transport', 'stdio']
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

  return { path: configPath }
}

export async function configure(options?: ConfigureOptions): Promise<ConfigureResult[]> {
  const targets: Array<'claude' | 'gemini'> = []
  if (options?.claude) targets.push('claude')
  if (options?.gemini || options?.agy) targets.push('gemini')

  if (targets.length === 0) {
    targets.push('claude')
  }

  const doSkill = options?.skill ?? (!options?.mcp)
  const doMcp = options?.mcp ?? (!options?.skill)

  const results: ConfigureResult[] = []

  for (const target of targets) {
    const result: ConfigureResult = {}

    if (doSkill) {
      const skillSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dot-agent', 'SKILL.md')
      const skillContent = await readFile(skillSrc, 'utf-8')

      const dest = target === 'gemini'
        ? join(homedir(), '.gemini', 'config', 'skills', 'dot-agent', 'SKILL.md')
        : join(homedir(), '.claude', 'skills', 'dot-agent', 'SKILL.md')

      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, skillContent, 'utf-8')

      result.dest = dest
      result.skillInstalled = true
    }

    if (doMcp) {
      const { path: mcpPath } = await configureMcpServer(target)
      result.mcpConfigPath = mcpPath
      result.mcpConfigured = true
    }

    results.push(result)
  }

  return results
}
