// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { existsSync } from 'fs'
import { mkdir, writeFile, readFile, readdir, stat } from 'fs/promises'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { InitOptions, InitResult } from '../types.js'

// templates/ ships as a sibling of dist/ in the published package (no "files"
// allowlist in package.json, so it's included by default). Its depth relative
// to this module differs between running from source (src/commands/init.ts,
// two levels up) and from the bundled build (tsup flattens everything into
// dist/index.js, one level up) — try both instead of hardcoding one.
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

async function copyTemplateTree(srcDir: string, destDir: string, tokens: Record<string, string>, files: string[], prefix = ''): Promise<void> {
  const entries = await readdir(srcDir)
  for (const entry of entries) {
    const srcPath = join(srcDir, entry)
    const relPath = prefix ? `${prefix}/${entry}` : entry
    const stats = await stat(srcPath)
    if (stats.isDirectory()) {
      await mkdir(join(destDir, relPath), { recursive: true })
      await copyTemplateTree(srcPath, destDir, tokens, files, relPath)
      continue
    }
    const content = await readFile(srcPath, 'utf-8')
    await writeFile(join(destDir, relPath), applyTokens(content, tokens))
    files.push(relPath)
  }
}

export async function init(options: InitOptions = {}): Promise<InitResult> {
  const dir = options.dir || process.cwd()
  const name = options.name || basename(dir)
  const domain = options.domain || 'example.com'

  try {
    await stat(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }

  const agentDescriptionPath = join(dir, 'agent.description')
  try {
    await stat(agentDescriptionPath)
    throw new Error(`agent.description already exists at ${agentDescriptionPath}`)
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err
  }

  const files: string[] = []
  await copyTemplateTree(resolveTemplatesDir(), dir, { name, domain }, files)

  return { dir, files }
}
