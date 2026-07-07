// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFile, stat } from 'fs/promises'
import { loadAgent, AgentSession } from '@dot-agent/sdk'
import { bundleFromDir } from '@dot-agent/compiler'
import { loadMcpConfig } from '../config.js'
import { startMcpServer } from './mcp-run.js'
import type { RunOptions, RunResult } from '../types.js'

export async function run(options: RunOptions): Promise<RunResult> {
  const { source } = options

  const srcStat = await stat(source)
  const bundle = srcStat.isFile()
    ? await loadAgent(await readFile(source))
    : await bundleFromDir(source)

  const session = await AgentSession.create(bundle)
  session.start()

  if (options.mcp) {
    const fileConfig = await loadMcpConfig()
    await startMcpServer(session, bundle, {
      transport: options.mcpTransport ?? fileConfig.transport ?? 'stdio',
      port: options.mcpPort ?? fileConfig.port ?? 3000,
      exposePersona: fileConfig.expose_persona ?? true,
      exposeKnowledge: fileConfig.expose_knowledge ?? true,
    })
  }

  return { bundle, session }
}
