// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import type { AgentBundle, AgentFiles } from './types.js'
import { discoverDescriptionFile, consolidate, collectFiles } from './pack.js'
import { lintDescription, lintBehavior } from './linter.js'
import { buildId } from './id.js'
import { buildAboutme } from './manifest.js'
import { initBehaviorParser, parseDescriptionFile } from './parser.js'
import { COMPILER_VERSION } from './generated-version.js'

const GITKEEP = new Set(['guides/.gitkeep', 'knowledge/.gitkeep'])

export async function bundleFromDir(dir: string): Promise<AgentBundle> {
  const descriptionFileName = await discoverDescriptionFile(dir)
  const descriptionText = await readFile(join(dir, descriptionFileName), 'utf-8')

  const descMessages = await lintDescription(descriptionText, descriptionFileName)
  const descErrors = descMessages.filter(m => m.severity === 'error')
  if (descErrors.length > 0) {
    throw new Error(
      `Lint failed:\n${descErrors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  await initBehaviorParser()
  const descResult = parseDescriptionFile(descriptionText)
  if (descResult.ok === null) {
    const firstError = descResult.diagnostics.find(d => d.severity === 'error')
    throw new Error(`E_DESC: ${firstError?.message ?? 'parse failed'}`)
  }
  const df = descResult.ok

  if (!df.behavior) {
    throw new Error(`E_DESC: '${descriptionFileName}' must declare a behavior file`)
  }

  const { mergedText, mergeSources } = await consolidate(dir, df.behavior)

  const behaviorMessages = await lintBehavior(mergedText, 'agent.behavior', undefined, true)
  const allMessages = [...descMessages, ...behaviorMessages]
  const errors = allMessages.filter(m => m.severity === 'error')
  const warnings = allMessages.filter(m => m.severity === 'warning')

  if (errors.length > 0) {
    throw new Error(
      `Lint failed:\n${errors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  for (const w of warnings) {
    process.stderr.write(`\x1b[33m⚠\x1b[0m ${w.file}:${w.line}:${w.col} ${w.code} ${w.message}\n`)
  }

  const allFiles = await collectFiles(dir, descriptionFileName, mergedText, mergeSources)

  const sha256 = createHash('sha256')
    .update(Array.from(allFiles.values()).join(''))
    .digest('hex')

  const id = buildId({ namespace: df.agent.domain ?? 'local', name: df.agent.name, version: 'dev' })

  const aboutme = buildAboutme({
    id,
    name: df.agent.name,
    description: df.description ?? '',
    version: 'dev',
    domain: df.agent.domain ?? '',
    license: df.agent.license ?? '',
    persona: df.persona ?? 'SOUL.md',
    purpose: 'development',
    compiler: `dot-agent/${COMPILER_VERSION}`,
    capabilities: df.capabilities.map(c => ({ id: c.name, description: c.description ?? '' })),
    requires: df.requires,
    integrity: { sha256, files: '.agent/files.json' },
  })

  const files: AgentFiles = {
    description: descriptionText,
    // Reuse collectFiles()'s 'agent.behavior' entry rather than the raw
    // mergedText — it has redundant `merge "..."` lines stripped (see
    // collectFiles() for why they're dead weight once flattened).
    behavior: allFiles.get('agent.behavior') ?? mergedText,
    soul: allFiles.get('SOUL.md'),
    guides: Array.from(allFiles.entries())
      .filter(([p]) => p.startsWith('guides/') && !GITKEEP.has(p))
      .map(([path, content]) => ({ path, content })),
    knowledge: Array.from(allFiles.entries())
      .filter(([p]) => p.startsWith('knowledge/') && !GITKEEP.has(p))
      .map(([path, content]) => ({ path, content })),
    behaviors: Array.from(allFiles.entries())
      .filter(([p]) => p.startsWith('behaviors/'))
      .map(([path, content]) => ({ path, content })),
  }

  return { id, aboutme, files }
}
