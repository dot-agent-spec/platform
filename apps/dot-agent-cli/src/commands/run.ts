// SPDX-License-Identifier: Apache-2.0

import { loadMcpConfig } from '../config.js'
import { loadBundleAndSession, startMcpServer } from './mcp-run.js'
import type { RunOptions, RunResult } from '../types.js'

export async function run(options: RunOptions): Promise<RunResult> {
  const { bundle, session } = await loadBundleAndSession(options.source)

  if (options.mcp) {
    const fileConfig = await loadMcpConfig()
    await startMcpServer({ bundle, session }, {
      transport: options.mcpTransport ?? fileConfig.transport ?? 'stdio',
      port: options.mcpPort ?? fileConfig.port ?? 3000,
      exposePersona: fileConfig.expose_persona ?? true,
      exposeKnowledge: fileConfig.expose_knowledge ?? true,
    })
  }

  return { bundle, session }
}
