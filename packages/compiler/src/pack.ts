// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFile, stat, readdir } from 'fs/promises'
import { join, basename } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import JSZip from 'jszip'
import type { PackOptions, PackResult } from './types.js'
import { lintDescription, lintBehavior } from './linter.js'
import { buildId } from './id.js'
import { buildAboutme, aboutmeToJson } from './manifest.js'
import { initBehaviorParser, parseDescriptionFile } from './parser.js'
import { buildTypesJson } from './schema.js'
import { writeZip } from './zip.js'

function gitDescribeTags(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function gitRevParseShort(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

async function resolveVersion(explicit?: string): Promise<string> {
  if (explicit) return explicit
  return gitDescribeTags() ?? 'v1.0.0'
}

async function resolveCommit(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit
  return gitRevParseShort() ?? undefined
}

export async function collectFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()

  async function walk(subdir: string, prefix = '') {
    try {
      const entries = await readdir(subdir)
      for (const entry of entries) {
        if (entry === '.gitkeep' || entry.startsWith('.')) continue
        const fullPath = join(subdir, entry)
        const stats = await stat(fullPath)
        const relativePath = prefix ? `${prefix}/${entry}` : entry
        if (stats.isDirectory()) {
          await walk(fullPath, relativePath)
        } else {
          files.set(relativePath, await readFile(fullPath, 'utf-8'))
        }
      }
    } catch {
      // directory doesn't exist or can't be read
    }
  }

  files.set('agent.description', await readFile(join(dir, 'agent.description'), 'utf-8'))
  files.set('agent.behavior', await readFile(join(dir, 'agent.behavior'), 'utf-8'))

  try {
    files.set('SOUL.md', await readFile(join(dir, 'SOUL.md'), 'utf-8'))
  } catch {
    // optional
  }

  await walk(join(dir, 'behaviors'), 'behaviors')
  await walk(join(dir, 'guides'), 'guides')
  await walk(join(dir, 'knowledge'), 'knowledge')

  return files
}

export async function pack(options: PackOptions = {}): Promise<PackResult> {
  const dir = options.dir ?? process.cwd()
  const outPath = options.out ?? join(dir, `${basename(dir)}.agent`)

  let descriptionText: string
  let behaviorText: string

  try {
    descriptionText = await readFile(join(dir, 'agent.description'), 'utf-8')
  } catch {
    throw new Error('E003: File agent.description not found')
  }

  try {
    behaviorText = await readFile(join(dir, 'agent.behavior'), 'utf-8')
  } catch {
    throw new Error('E007: File agent.behavior not found')
  }

  const [descriptionMessages, behaviorMessages] = await Promise.all([
    lintDescription(descriptionText),
    lintBehavior(behaviorText),
  ])

  const allMessages = [...descriptionMessages, ...behaviorMessages]
  const errors = allMessages.filter(m => m.severity === 'error')
  const warnings = allMessages.filter(m => m.severity === 'warning')

  if (errors.length > 0) {
    throw new Error(
      `Lint failed:\n${errors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  await initBehaviorParser()
  const descResult = parseDescriptionFile(descriptionText)
  if (descResult.ok === null) {
    const firstError = descResult.diagnostics.find(d => d.severity === 'error')
    throw new Error(`E_DESC: ${firstError?.message ?? 'parse failed'}`)
  }
  const df = descResult.ok

  const version = await resolveVersion(options.version)
  const commit = await resolveCommit(options.commit)
  const allFiles = await collectFiles(dir)

  const contentForHash = Array.from(allFiles.values()).join('')
  const sha256 = createHash('sha256').update(contentForHash).digest('hex')

  const namespace = df.agent.domain ?? 'unknown'
  const id = buildId({ namespace, name: df.agent.name, version, digest: commit })

  const typesJson = buildTypesJson(df)
  const integrity = {
    sha256,
    ...(typesJson ? { types: '.agent/types.json' } : {}),
    files: '.agent/files.json',
  }

  const aboutme = buildAboutme({
    id,
    name: df.agent.name,
    description: df.description ?? '',
    version,
    domain: df.agent.domain ?? '',
    license: df.agent.license ?? '',
    persona: df.persona ?? 'SOUL.md',
    purpose: 'unknown',
    compiler: 'dot-agent/1.0.0',
    commit,
    capabilities: df.capabilities.map(c => ({ id: c.name, description: c.description ?? '' })),
    requires: df.requires,
    integrity,
  })

  const zip = new JSZip()
  const agentFolder = zip.folder('.agent')!
  agentFolder.file('aboutme.json', aboutmeToJson(aboutme))

  if (typesJson) {
    agentFolder.file('types.json', typesJson)
  }

  const gitkeepPaths = new Set(['behaviors/.gitkeep', 'guides/.gitkeep', 'knowledge/.gitkeep'])
  const filesJson = {
    description: 'agent.description',
    behavior: 'agent.behavior',
    behaviors: Array.from(allFiles.keys()).filter(f => f.startsWith('behaviors/') && !gitkeepPaths.has(f)),
    guides: Array.from(allFiles.keys()).filter(f => f.startsWith('guides/') && !gitkeepPaths.has(f)),
    knowledge: Array.from(allFiles.keys()).filter(f => f.startsWith('knowledge/') && !gitkeepPaths.has(f)),
  }
  agentFolder.file('files.json', JSON.stringify(filesJson, null, 2))

  for (const [path, content] of allFiles) {
    if (!gitkeepPaths.has(path)) zip.file(path, content)
  }

  await writeZip(zip, outPath)

  return { path: outPath, id, warnings }
}
