// SPDX-License-Identifier: Apache-2.0

import { existsSync } from 'fs'
import { mkdir, writeFile, readFile, readdir, stat } from 'fs/promises'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { InitOptions, InitResult } from '../types.js'

// templates/ ships as a sibling of dist/ in the published package — it is named
// in the "files" allowlist in package.json, so removing it there unships it and
// breaks `init` at runtime rather than at build time. Its depth relative
// to this module differs between running from source (src/commands/init.ts,
// two levels up) and from the bundled build (tsdown flattens everything into
// dist/index.mjs, one level up) — try both instead of hardcoding one.
function resolveTemplatesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [join(here, 'templates'), join(here, '..', 'templates'), join(here, '..', '..', 'templates')]
  const found = candidates.find(existsSync)
  if (!found) throw new Error(`Could not locate templates/ directory (looked in: ${candidates.join(', ')})`)
  return found
}

function applyTokens(content: string, tokens: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => tokens[key] ?? match)
}

// Walks the template tree without writing anything, so the collision check below can see the
// whole payload before the first byte lands. Writing while walking is what let `init` clobber a
// real repository's LICENSE and README: a collision discovered mid-walk still left every earlier
// file overwritten.
async function collectTemplateFiles(srcDir: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(srcDir)
  for (const entry of entries) {
    const srcPath = join(srcDir, entry)
    const relPath = prefix ? `${prefix}/${entry}` : entry
    const stats = await stat(srcPath)
    if (stats.isDirectory()) {
      files.push(...(await collectTemplateFiles(srcPath, relPath)))
      continue
    }
    files.push(relPath)
  }
  return files
}

async function writeTemplateFiles(srcDir: string, destDir: string, tokens: Record<string, string>, relPaths: string[]): Promise<void> {
  for (const relPath of relPaths) {
    const destPath = join(destDir, relPath)
    await mkdir(dirname(destPath), { recursive: true })
    const content = await readFile(join(srcDir, relPath), 'utf-8')
    await writeFile(destPath, applyTokens(content, tokens))
  }
}

export async function init(options: InitOptions = {}): Promise<InitResult> {
  const dir = options.dir || process.cwd()
  const name = options.name || basename(dir)
  const domain = options.domain || 'example.com'
  const force = options.force ?? false

  try {
    await stat(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }

  const templatesDir = resolveTemplatesDir()
  const relPaths = await collectTemplateFiles(templatesDir)

  // Guard the whole payload, not just agent.description — templates/ also carries LICENSE,
  // README.md and SOUL.md, and overwriting those in a real repository is the incident this
  // guard exists to prevent (issue #21). existsSync stays OUTSIDE any try/catch on purpose:
  // the older shape threw from inside the try and survived only because a thrown Error has
  // `code === undefined`.
  if (!force) {
    const collisions = relPaths.filter(rel => existsSync(join(dir, rel)))
    if (collisions.length > 0) {
      throw new Error(
        `Refusing to overwrite existing files in ${dir}:\n` +
          collisions.map(rel => `  ${join(dir, rel)}`).join('\n') +
          `\nUse --force to overwrite.`
      )
    }
  }

  await writeTemplateFiles(templatesDir, dir, { name, domain }, relPaths)

  return { dir, files: relPaths }
}
