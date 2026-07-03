// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFile, stat, readdir } from 'fs/promises'
import { join, basename, resolve, relative, isAbsolute, normalize, dirname } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import JSZip from 'jszip'
import type { PackOptions, PackResult } from './types.js'
import { lintDescription, lintBehavior } from './linter.js'
import { buildId } from './id.js'
import { buildAboutme, aboutmeToJson } from './manifest.js'
import { initBehaviorParser, parseDescriptionFile, parseBehaviorFile } from './parser.js'
import { buildTypesJson } from './schema.js'
import { writeZip } from './zip.js'
import { COMPILER_VERSION } from './generated-version.js'

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

// ── Path safety ──────────────────────────────────────────────────────────────

function isExternalPath(agentRoot: string, declaredPath: string): boolean {
  if (isAbsolute(declaredPath)) return true
  const normRoot = normalize(resolve(agentRoot))
  const resolved = resolve(normRoot, declaredPath)
  return relative(normRoot, resolved).startsWith('..')
}

// ── Description file discovery ────────────────────────────────────────────────

export async function discoverDescriptionFile(dir: string, explicit?: string): Promise<string> {
  if (explicit) {
    try {
      await stat(join(dir, explicit))
      return explicit
    } catch {
      throw new Error(`E003: Description file '${explicit}' not found in ${dir}`)
    }
  }
  const entries = await readdir(dir)
  const descFiles = entries.filter(f => f.endsWith('.description'))
  if (descFiles.length === 0) {
    throw new Error(`E003: No .description file found in ${dir}`)
  }
  if (descFiles.length > 1) {
    throw new Error(`E003: Multiple .description files found: ${descFiles.join(', ')} — use PackOptions.description to specify one`)
  }
  const name = descFiles[0]
  if (name !== 'agent.description') {
    console.info(`[dot-agent] using description file: ${name}`)
  }
  return name
}

// ── Merge graph consolidation ─────────────────────────────────────────────────

interface ConsolidateResult {
  mergedText: string
  mergeSources: string[]  // relative paths within agent root, e.g. ["main.behavior"]
}

export async function consolidate(agentRoot: string, entryFile: string): Promise<ConsolidateResult> {
  await initBehaviorParser()
  const normRoot = normalize(resolve(agentRoot))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const order: string[] = []
  const textCache = new Map<string, string>()

  async function dfs(relPath: string): Promise<void> {
    const absPath = resolve(normRoot, relPath)

    if (visiting.has(absPath)) {
      throw new Error(`E013: Circular merge dependency involving '${relPath}'`)
    }
    if (visited.has(absPath)) return

    visiting.add(absPath)

    let fileText: string
    try {
      fileText = await readFile(absPath, 'utf-8')
    } catch {
      throw new Error(`E012: Merge target not found: '${relPath}'`)
    }
    textCache.set(absPath, fileText)

    const result = parseBehaviorFile(fileText)
    const merges = result.ok?.merges ?? []

    for (const mergePath of merges) {
      if (isAbsolute(mergePath)) {
        throw new Error(`E014: Merge path '${mergePath}' in '${relPath}' is absolute — only paths within the agent root are allowed`)
      }
      const mergeAbs = resolve(dirname(absPath), mergePath)
      const mergeRel = relative(normRoot, mergeAbs)
      if (mergeRel.startsWith('..')) {
        throw new Error(`E014: Merge path '${mergePath}' in '${relPath}' escapes the agent root`)
      }
      await dfs(mergeRel)
    }

    visiting.delete(absPath)
    visited.add(absPath)
    order.push(relPath)
  }

  await dfs(entryFile)

  const texts = order.map(relPath => textCache.get(resolve(normRoot, relPath))!)
  return {
    mergedText: texts.join('\n'),
    mergeSources: order,
  }
}

// ── File collection ───────────────────────────────────────────────────────────

export async function collectFiles(
  dir: string,
  descriptionFile: string,
  mergedBehaviorText: string,
  mergeSources: string[],
): Promise<Map<string, string>> {
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

  files.set(descriptionFile, await readFile(join(dir, descriptionFile), 'utf-8'))
  // mergedBehaviorText is a literal concatenation of every merged file's raw
  // source (see consolidate() above), so a `merge "..."` line from the entry
  // file survives verbatim even though every state it would pull in is
  // already inlined by the concatenation. Left in, a runtime that re-parses
  // this flat file (e.g. AgentSession.start() in @dot-agent/sdk) treats it as
  // a live merge directive and tries to re-resolve it against a differently
  // keyed bundle, failing with "files not found". It's dead once flattened —
  // strip it. Safe to do after linting (above), which already ran on the
  // unstripped text.
  const flatBehaviorText = mergedBehaviorText.replace(/^\s*merge\s+"[^"]*"\s*$/gm, '')
  files.set('agent.behavior', flatBehaviorText)

  for (const relPath of mergeSources) {
    files.set(`behaviors/${relPath}`, await readFile(join(dir, relPath), 'utf-8'))
  }

  try {
    files.set('SOUL.md', await readFile(join(dir, 'SOUL.md'), 'utf-8'))
  } catch {
    // optional
  }

  await walk(join(dir, 'guides'), 'guides')
  await walk(join(dir, 'knowledge'), 'knowledge')

  return files
}

export async function pack(options: PackOptions = {}): Promise<PackResult> {
  const dir = options.dir ?? process.cwd()
  const outPath = options.out ?? join(dir, `${basename(dir)}.agent`)

  // 1. Discover and read description file
  const descriptionFileName = await discoverDescriptionFile(dir, options.description)
  const descriptionText = await readFile(join(dir, descriptionFileName), 'utf-8')

  // 2. Lint description — fail fast on errors (E017, E004, etc.)
  const descriptionMessages = await lintDescription(descriptionText, descriptionFileName)
  const descErrors = descriptionMessages.filter(m => m.severity === 'error')
  if (descErrors.length > 0) {
    throw new Error(
      `Lint failed:\n${descErrors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  // 3. Init WASM parser (needed for parseDescriptionFile and consolidate)
  await initBehaviorParser()

  // 4. Parse description to get df.behavior
  const descResult = parseDescriptionFile(descriptionText)
  if (descResult.ok === null) {
    const firstError = descResult.diagnostics.find(d => d.severity === 'error')
    throw new Error(`E_DESC: ${firstError?.message ?? 'parse failed'}`)
  }
  const df = descResult.ok

  // 5. Validate df.behavior
  if (!df.behavior) {
    throw new Error(`E_DESC: '${descriptionFileName}' must declare a behavior file — add 'behavior "agent.behavior"' (or the name of your entry .behavior file)`)
  }
  if (isExternalPath(dir, df.behavior)) {
    throw new Error(`E014: behavior path '${df.behavior}' in '${descriptionFileName}' is absolute or escapes the agent root`)
  }

  // 6. Consolidate merge graph → single merged text
  const { mergedText, mergeSources } = await consolidate(dir, df.behavior)

  // 7. Lint consolidated behavior (E015, E016, W014 only fire when consolidated=true)
  const behaviorMessages = await lintBehavior(mergedText, 'agent.behavior', undefined, true)
  const allMessages = [...descriptionMessages, ...behaviorMessages]
  const errors = allMessages.filter(m => m.severity === 'error')
  const warnings = allMessages.filter(m => m.severity === 'warning')

  if (errors.length > 0) {
    throw new Error(
      `Lint failed:\n${errors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  // 8. Collect all files for the bundle
  const version = await resolveVersion(options.version)
  const commit = await resolveCommit(options.commit)
  const allFiles = await collectFiles(dir, descriptionFileName, mergedText, mergeSources)

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
    compiler: `dot-agent/${COMPILER_VERSION}`,
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

  const gitkeepPaths = new Set(['guides/.gitkeep', 'knowledge/.gitkeep'])
  const filesJson = {
    description: descriptionFileName,
    behavior: 'agent.behavior',
    behaviors: Array.from(allFiles.keys()).filter(f => f.startsWith('behaviors/')),
    guides: Array.from(allFiles.keys()).filter(f => f.startsWith('guides/') && !gitkeepPaths.has(f)),
    knowledge: Array.from(allFiles.keys()).filter(f => f.startsWith('knowledge/') && !gitkeepPaths.has(f)),
  }
  agentFolder.file('files.json', JSON.stringify(filesJson, null, 2))

  for (const [path, content] of allFiles) {
    zip.file(path, content)
  }

  await writeZip(zip, outPath)

  return { path: outPath, id, warnings }
}
