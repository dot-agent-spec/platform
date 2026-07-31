// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export interface McpConfig {
  transport?: 'stdio' | 'http'
  port?: number
  expose_persona?: boolean
  expose_knowledge?: boolean
  auth?: { type: 'bearer'; token: string }
}

export async function loadMcpConfig(): Promise<McpConfig> {
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  const configPath = join(configHome, 'dot-agent', 'mcp.json')
  try {
    const text = await readFile(configPath, 'utf-8')
    return JSON.parse(text) as McpConfig
  } catch {
    return {}
  }
}
