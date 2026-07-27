// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

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
