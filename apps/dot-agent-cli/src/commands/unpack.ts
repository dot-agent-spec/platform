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

import { mkdir, writeFile, stat } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { UnpackOptions, UnpackResult } from '../types.js'
import { readZip, validateZipBomb, validateMagicBytes, extractFiles } from '../core/zip.js'
import { parseAboutme } from '../core/envelope.js'

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
  await mkdir(outDir, { recursive: true })

  const extractedFiles: string[] = []

  for (const [path, content] of files) {
    if (path.startsWith('.agent/')) continue

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
