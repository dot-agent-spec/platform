// SPDX-License-Identifier: Apache-2.0

import { mkdir, writeFile, stat } from 'fs/promises'
import { join, posix } from 'path'
import { UnpackOptions, UnpackResult } from '../types.js'
import {
  readZip,
  validateZipBomb,
  validateMagicBytes,
  extractFiles,
  parseAboutme,
  parseDescriptionFile,
  parseBehaviorFile,
  initBehaviorParser,
} from '@dot-agent/compiler'

// Every merge source `pack` bundles is stored under `behaviors/<root-relative
// path>` (packages/compiler/src/pack.ts, collectFiles(): `files.set(\`behaviors/${relPath}\`,
// ...)`), including the entry file itself. Writing those paths verbatim is
// what a `.description` naming the original entry (e.g.
// `behavior main.behavior`) can no longer find on a subsequent `pack`, since
// the file no longer lives at that name (E012).
//
// `.agent/files.json`'s `behaviors` array is NOT reliable for telling the
// merge graph apart from everything else pack.ts happens to store under
// `behaviors/`: `collectFiles()` also lands `guide`/`teach` references there
// when the author wrote them that way (e.g. `teach "behaviors/notes.md"`,
// which is legal — it only earns a W016 warning), and that array lists every
// key under the `behaviors/` prefix regardless. Restoring by that list alone
// moves a referenced content file out from under the path the behavior text
// still names it by, and a hand-built (or otherwise unusual) archive can
// name a root `agent.behavior` that already IS the real, unflattened entry
// — deleting that unconditionally loses the entry outright.
//
// So restoration is driven by walking the actual merge graph instead: parse
// the archived `.description` (with the compiler's own parser) to get the
// entry file's declared root-relative path, then follow `merge` statements
// from there using the same field consolidate() reads
// (`parseBehaviorFile(...).ok?.merges`) and the same relative-path
// resolution rule it applies (each merge path resolves against the
// referencing file's own directory) — `consolidate()` itself takes a
// filesystem directory and can't be pointed at files still in memory, so
// `walkMergeGraph` below reimplements its exact resolution against
// `behaviors/<path>` keys instead of real files on disk. Only the paths
// that walk actually reaches are moved back to their original root-relative
// location; anything else under `behaviors/` — a `teach`/`guide` reference,
// or an unrelated leftover — stays exactly where the archive put it. The
// flattened `agent.behavior` build artifact is deleted only once the walk
// has confirmed there is a real, restorable source to put there instead
// (which also covers the entry-named-`agent.behavior` case: the walk writes
// the original, unflattened source to that path before the flattened copy
// would have been deleted, so the two never collide).
//
// Any place this can't be established safely — the manifest doesn't parse,
// the description doesn't name a usable entry, a merge target the walk
// needs isn't present under `behaviors/`, or a merge path is absolute or
// would escape the agent root — falls through to full verbatim extraction,
// exactly as unpack did before this fix existed.
const BEHAVIORS_PREFIX = 'behaviors/'

interface FilesManifest {
  description?: string
}

function isSafeRelPath(relPath: string): boolean {
  if (posix.isAbsolute(relPath)) return false
  const normalized = posix.normalize(relPath)
  return normalized !== '..' && !normalized.startsWith('../')
}

// Walks the merge graph reachable from `entryRelPath` against the archive's
// `behaviors/<path>` entries. Returns the root-relative paths reached, in
// the same post-order `consolidate()` produces (dependencies before the
// file that merges them), or `null` if the graph can't be walked safely.
async function walkMergeGraph(files: Map<string, string>, entryRelPath: string): Promise<string[] | null> {
  if (!isSafeRelPath(entryRelPath)) return null
  await initBehaviorParser()

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const order: string[] = []

  function dfs(relPath: string): boolean {
    if (visiting.has(relPath)) return false // circular merge — not safe to restore
    if (visited.has(relPath)) return true
    visiting.add(relPath)

    const content = files.get(BEHAVIORS_PREFIX + relPath)
    if (content === undefined) return false

    const merges = parseBehaviorFile(content).ok?.merges ?? []
    for (const mergePath of merges) {
      if (posix.isAbsolute(mergePath)) return false
      const mergeRel = posix.normalize(posix.join(posix.dirname(relPath), mergePath))
      if (!isSafeRelPath(mergeRel)) return false
      if (!dfs(mergeRel)) return false
    }

    visiting.delete(relPath)
    visited.add(relPath)
    order.push(relPath)
    return true
  }

  return dfs(entryRelPath) ? order : null
}

export async function unpack(options: UnpackOptions): Promise<UnpackResult> {
  const { file, out, force = false } = options

  // Validate magic bytes
  await validateMagicBytes(file)

  // Validate ZIP bomb
  await validateZipBomb(file)

  // Load ZIP
  const zip = await readZip(file)

  // Read aboutme.json
  const aboutmeFile = zip.file('.agent/aboutme.json')
  if (!aboutmeFile) {
    throw new Error('Missing .agent/aboutme.json in ZIP')
  }

  const aboutmeText = await aboutmeFile.async('text')
  const aboutme = parseAboutme(JSON.parse(aboutmeText))

  // Extract output directory
  const outDir = out || `./${aboutme.name}`

  // Check if directory exists
  try {
    await stat(outDir)
    if (!force) {
      throw new Error(`Output directory already exists: ${outDir}. Use --force to overwrite.`)
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err
  }

  // Extract all files from root
  const files = await extractFiles(zip)

  // Restore the original source layout for exactly the merge graph reached
  // from the description's declared entry — see the comment above.
  const filesJsonRaw = files.get('.agent/files.json')
  if (filesJsonRaw) {
    let filesManifest: FilesManifest | undefined
    try {
      filesManifest = JSON.parse(filesJsonRaw)
    } catch {
      filesManifest = undefined
    }
    const descPath = filesManifest?.description

    if (descPath && files.has(descPath)) {
      const descResult = parseDescriptionFile(files.get(descPath)!)
      const entryRelPath = descResult.ok?.behavior

      const reached = entryRelPath ? await walkMergeGraph(files, entryRelPath) : null
      if (reached) {
        // Only now that a real, restorable source has been found — never
        // leave the archive without an entry at the path the description
        // names.
        files.delete('agent.behavior')
        for (const relPath of reached) {
          const zipPath = BEHAVIORS_PREFIX + relPath
          const content = files.get(zipPath)!
          files.delete(zipPath)
          files.set(relPath, content)
        }
      }
    }
  }

  await mkdir(outDir, { recursive: true })

  const extractedFiles: string[] = []

  for (const [path, content] of files) {
    const fullPath = join(outDir, path)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))

    await mkdir(dir, { recursive: true })
    await writeFile(fullPath, content)
    extractedFiles.push(path)
  }

  return {
    dir: outDir,
    id: aboutme.id,
    files: extractedFiles,
    aboutme,
  }
}
