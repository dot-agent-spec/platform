// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

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
