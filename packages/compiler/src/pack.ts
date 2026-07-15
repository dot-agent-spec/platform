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
import type { LintMessage, PackOptions, PackResult, Statement } from './types.js'
import { lintDescription, lintBehavior } from './linter.js'
import { buildId, slugify, isValidVersion } from './id.js'
import { buildAboutme, aboutmeToJson } from './manifest.js'
import { initBehaviorParser, parseDescriptionFile, parseBehaviorFile } from './parser.js'
import { buildTypesJson } from './schema.js'
import { writeZip } from './zip.js'
import { COMPILER_VERSION } from './generated-version.js'

function gitRevParseShort(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

async function resolveCommit(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit
  return gitRevParseShort() ?? undefined
}

// ── Version resolution ────────────────────────────────────────────────────────

interface VersionCandidate {
  version: string
  label: string
}

// The repo's tags are all monorepo-style `<pkg>@<version>` (there is no plain
// vX.Y.Z release tag convention here). Rather than guess which tag belongs to
// the directory being packed, list the most recent tags with their package
// context and let a human pick — precision comes from judgment, not a
// heuristic that can silently attribute the wrong package's version.
function recentTagCandidates(limit = 5): VersionCandidate[] {
  let tags: string[]
  try {
    tags = execSync('git tag --sort=-creatordate', { stdio: 'pipe', encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
  return tags
    .slice(0, limit)
    .map((tag): VersionCandidate => {
      const atIdx = tag.lastIndexOf('@')
      const version = atIdx === -1 ? tag : tag.slice(atIdx + 1)
      const label = atIdx === -1 ? tag : `${version}   (tag: ${tag})`
      return { version, label }
    })
    .filter(c => isValidVersion(c.version))
}

// String sentinels (not symbols) — @clack/prompts' select() types `value` as
// `string`, and these are extremely unlikely to collide with a real tag-derived version.
const CUSTOM_VERSION = '__dot-agent-custom-version__'
const BARE_VERSION = '__dot-agent-bare-version__'

// No hardcoded version default — an unresolved version produces a form A
// (bare) id per docs/reference/agent-id.md, rather than fabricating one.
async function resolveVersionInteractive(explicit?: string): Promise<string | undefined> {
  if (explicit) {
    if (!isValidVersion(explicit)) {
      throw new Error(`E019: Invalid version format '${explicit}' — expected vX.Y[.Z][-prerelease] or X.Y[.Z][-prerelease]`)
    }
    return explicit
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('[dot-agent] no TTY and no --version — packing without a version\n')
    return undefined
  }

  const candidates = recentTagCandidates()

  // @clack/prompts is ESM-only — dynamic import() resolves it correctly
  // regardless of whether this package itself is consumed as ESM or CJS
  // (a static import would break `require()` callers), and it also means the
  // non-interactive paths above never pay to load it at all.
  const clack = await import('@clack/prompts')

  const choice = await clack.select({
    message: 'Choose a version for this package',
    options: [
      ...candidates.map(c => ({ value: c.version, label: c.label })),
      { value: CUSTOM_VERSION, label: 'Type a custom version…' },
      { value: BARE_VERSION, label: 'None (bare — no version)' },
    ],
  })

  if (clack.isCancel(choice)) {
    clack.cancel('Pack cancelled.')
    process.exit(1)
  }

  if (choice === BARE_VERSION) return undefined

  if (choice === CUSTOM_VERSION) {
    const typed = await clack.text({
      message: 'Version',
      validate: v => (v && isValidVersion(v) ? undefined : 'Invalid version format — expected vX.Y[.Z][-prerelease] or X.Y[.Z][-prerelease]'),
    })
    if (clack.isCancel(typed)) {
      clack.cancel('Pack cancelled.')
      process.exit(1)
    }
    return typed
  }

  return choice as string
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

// ── guide/teach file references ───────────────────────────────────────────────

// `guide "..."` / `teach "..."` text is either inline orientation prose or a
// filename to bundle alongside the agent (e.g. `teach "recipes.txt"`). A
// trailing .txt/.md is the only signal we have to tell them apart — anything
// else stays literal, embedded verbatim in the flattened agent.behavior.
const FILE_REF_RE = /\.(txt|md)$/i

interface FileRef {
  kind: 'guide' | 'teach'
  text: string
}

function collectFileRefs(stmts: Statement[], out: Map<string, FileRef>): void {
  for (const s of stmts) {
    switch (s.type) {
      case 'guide_stmt':
        if (FILE_REF_RE.test(s.text)) out.set(`guide:${s.text}`, { kind: 'guide', text: s.text })
        break
      case 'teach_stmt':
        if (FILE_REF_RE.test(s.text)) out.set(`teach:${s.text}`, { kind: 'teach', text: s.text })
        break
      case 'interact_stmt':
        collectFileRefs(s.handlers, out)
        break
      case 'intent_handler':
        if (Array.isArray(s.body)) collectFileRefs(s.body, out)
        break
      case 'offtopic_handler':
      case 'after_stmt':
      case 'parallel_stmt':
        collectFileRefs(s.body, out)
        break
      case 'conditional_stmt':
        collectFileRefs(s.then, out)
        if (s.else) collectFileRefs(s.else, out)
        break
    }
  }
}

// ── File collection ───────────────────────────────────────────────────────────

function namespaceOf(kind: FileRef['kind']): 'guides' | 'knowledge' {
  return kind === 'guide' ? 'guides' : 'knowledge'
}

async function collectBehaviorFileRefs(mergedBehaviorText: string): Promise<Map<string, FileRef>> {
  await initBehaviorParser()
  const refs = new Map<string, FileRef>()
  const behaviorAst = parseBehaviorFile(mergedBehaviorText).ok
  if (!behaviorAst) return refs
  for (const state of behaviorAst.states) collectFileRefs(state.body, refs)
  for (const trigger of behaviorAst.global_triggers) collectFileRefs(trigger.body, refs)
  return refs
}

// Every file under guides/ or knowledge/, keyed by the bundle path it *would*
// occupy. Nothing here reaches the bundle on its own — only a guide/teach
// reference pulls a file in (see collectFiles) — so this exists solely to let
// findOrphanContentFiles report the files that never make it.
async function listContentFiles(dir: string, ns: 'guides' | 'knowledge'): Promise<string[]> {
  const found: string[] = []

  async function walk(subdir: string, prefix: string) {
    let entries: string[]
    try {
      entries = await readdir(subdir)
    } catch {
      return  // directory doesn't exist or can't be read
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const fullPath = join(subdir, entry)
      const relativePath = `${prefix}/${entry}`
      if ((await stat(fullPath)).isDirectory()) {
        await walk(fullPath, relativePath)
      } else {
        found.push(relativePath)
      }
    }
  }

  await walk(join(dir, ns), ns)
  return found
}

// A file in guides/ or knowledge/ that no guide/teach statement names is absent
// from the bundle under the linked-only rule — and would be unreachable at runtime
// even if it were bundled, since the kernel hands the LLM a bare filename via the
// teach effect and the MCP server exposes no listing endpoint. W015 is what keeps
// that from being a silent drop, including for something like knowledge/data.csv
// that FILE_REF_RE never recognises as a file reference to begin with.
export async function findOrphanContentFiles(
  dir: string,
  mergedBehaviorText: string,
): Promise<LintMessage[]> {
  const refs = await collectBehaviorFileRefs(mergedBehaviorText)
  const referenced = new Set<string>()
  for (const { kind, text } of refs.values()) referenced.add(`${namespaceOf(kind)}/${text}`)

  const onDisk = [
    ...(await listContentFiles(dir, 'guides')),
    ...(await listContentFiles(dir, 'knowledge')),
  ]

  return onDisk
    .filter(path => !referenced.has(path))
    .map((path): LintMessage => ({
      file: path,
      line: 1,
      col: 1,
      severity: 'warning',
      code: 'W015',
      message: `'${path}' is not referenced by any guide or teach statement — it will not be included in the bundle`,
    }))
}

export async function collectFiles(
  dir: string,
  descriptionFile: string,
  mergedBehaviorText: string,
  mergeSources: string[],
  personaFile?: string,
): Promise<Map<string, string>> {
  const files = new Map<string, string>()

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

  if (personaFile) {
    if (isExternalPath(dir, personaFile)) {
      throw new Error(`E014: persona path '${personaFile}' in '${descriptionFile}' is absolute or escapes the agent root`)
    }
    let personaText: string
    try {
      personaText = await readFile(join(dir, personaFile), 'utf-8')
    } catch {
      throw new Error(`E_DESC: persona file '${personaFile}' declared in '${descriptionFile}' not found`)
    }
    files.set(personaFile, personaText)
  }

  // A `guide "intro.md"` / `teach "recipes.txt"` reference is the only thing that
  // pulls a content file into the bundle — guides/ and knowledge/ are not swept
  // wholesale, so the bundle is a function of the behavior graph rather than of
  // whatever happens to sit in the directory. Resolve against the recommended
  // layout (guides/<text>, knowledge/<text>) first, then fall back to a file
  // sitting loose next to agent.behavior; either way it lands under <ns>/ in the
  // bundle. findOrphanContentFiles() reports what this loop leaves behind.
  const refs = await collectBehaviorFileRefs(mergedBehaviorText)
  for (const { kind, text } of refs.values()) {
    if (isExternalPath(dir, text)) {
      throw new Error(`E014: '${kind}' path '${text}' is absolute or escapes the agent root`)
    }
    const ns = namespaceOf(kind)
    const nsPath = `${ns}/${text}`

    let content: string | undefined
    for (const candidate of [join(dir, ns, text), join(dir, text)]) {
      try {
        content = await readFile(candidate, 'utf-8')
        break
      } catch {
        // fall through to the next candidate
      }
    }
    if (content === undefined) {
      throw new Error(
        `E018: '${kind}' file '${text}' referenced in agent.behavior not found in ${dir} — looked for '${nsPath}' and '${text}'`
      )
    }

    files.set(nsPath, content)
  }

  return files
}

// The bundle extension is always .agent — append it when the caller left it off
// rather than requiring `--out foo.agent` to be typed out every time.
function withAgentExtension(path: string): string {
  return path.endsWith('.agent') ? path : `${path}.agent`
}

export async function pack(options: PackOptions = {}): Promise<PackResult> {
  const dir = options.dir ?? process.cwd()
  const outPath = withAgentExtension(options.out ?? join(dir, basename(dir)))

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
  const lintWarnings = allMessages.filter(m => m.severity === 'warning')

  if (errors.length > 0) {
    throw new Error(
      `Lint failed:\n${errors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  // 8. Collect all files for the bundle
  const version = await resolveVersionInteractive(options.version)
  const commit = await resolveCommit(options.commit)
  const allFiles = await collectFiles(dir, descriptionFileName, mergedText, mergeSources, df.persona ?? undefined)
  const warnings = [...lintWarnings, ...(await findOrphanContentFiles(dir, mergedText))]

  const contentForHash = Array.from(allFiles.values()).join('')
  const sha256 = createHash('sha256').update(contentForHash).digest('hex')

  const namespace = df.agent.domain ?? 'unknown'
  // digest requires version (buildId's own invariant) — a bare (versionless)
  // id never carries a digest either, even if a commit sha is available.
  const id = buildId({ namespace, name: slugify(df.agent.name), version, digest: version ? commit : undefined })

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
    version: version ?? '',
    domain: df.agent.domain ?? '',
    license: df.agent.license ?? '',
    persona: df.persona ?? undefined,
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

  const filesJson = {
    description: descriptionFileName,
    behavior: 'agent.behavior',
    ...(df.persona ? { persona: df.persona } : {}),
    behaviors: Array.from(allFiles.keys()).filter(f => f.startsWith('behaviors/')),
    guides: Array.from(allFiles.keys()).filter(f => f.startsWith('guides/')),
    knowledge: Array.from(allFiles.keys()).filter(f => f.startsWith('knowledge/')),
  }
  agentFolder.file('files.json', JSON.stringify(filesJson, null, 2))

  for (const [path, content] of allFiles) {
    zip.file(path, content)
  }

  await writeZip(zip, outPath)

  return { path: outPath, id, warnings }
}
