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

import JSZip from 'jszip'
import { parseAboutme, extractFiles } from '@dot-agent/compiler/core'
import type { AgentBundle } from './types.js'

const MAX_ZIP_SIZE = 500 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 100

function validateMagicBytes(bytes: Uint8Array): void {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new Error('Not a valid .agent file (invalid magic bytes)')
  }
}

function validateZipBomb(zip: JSZip, compressedSize: number): void {
  let totalUncompressed = 0
  zip.forEach((_path, file) => {
    if (!file.dir) totalUncompressed += (file as any)._data?.uncompressedSize || 0
  })
  if (totalUncompressed > MAX_ZIP_SIZE) {
    throw new Error(`Bundle exceeds 500MB uncompressed: ${totalUncompressed}`)
  }
  if (totalUncompressed / compressedSize > MAX_COMPRESSION_RATIO) {
    throw new Error(`Compression ratio exceeds 100x: ${(totalUncompressed / compressedSize).toFixed(1)}x`)
  }
}

export async function loadAgent(input: Uint8Array | ArrayBuffer): Promise<AgentBundle> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)

  validateMagicBytes(bytes)

  const zip = await JSZip.loadAsync(bytes)
  validateZipBomb(zip, bytes.length)

  const aboutmeFile = zip.file('.agent/aboutme.json')
  if (!aboutmeFile) throw new Error('Missing .agent/aboutme.json in bundle')
  const aboutme = parseAboutme(JSON.parse(await aboutmeFile.async('text')))

  const filesJsonFile = zip.file('.agent/files.json')
  if (!filesJsonFile) throw new Error('Missing .agent/files.json in bundle')
  const filesJson = JSON.parse(await filesJsonFile.async('text')) as {
    description: string
    behavior: string
    behaviors?: string[]
    guides?: string[]
    knowledge?: string[]
  }

  const descFile = zip.file(filesJson.description)
  const behavFile = zip.file(filesJson.behavior)
  if (!descFile) throw new Error(`Missing ${filesJson.description} in bundle`)
  if (!behavFile) throw new Error(`Missing ${filesJson.behavior} in bundle`)

  const soulFile = zip.file('SOUL.md')
  const allFiles = await extractFiles(zip)

  const guides: Array<{ path: string; content: string }> = []
  const knowledge: Array<{ path: string; content: string }> = []
  const behaviors: Array<{ path: string; content: string }> = []

  for (const [path, content] of allFiles) {
    if (path.startsWith('guides/') && path !== 'guides/.gitkeep') {
      guides.push({ path, content })
    } else if (path.startsWith('knowledge/') && path !== 'knowledge/.gitkeep') {
      knowledge.push({ path, content })
    } else if (path.startsWith('behaviors/') && path !== 'behaviors/.gitkeep') {
      behaviors.push({ path, content })
    }
  }

  return {
    id: aboutme.id,
    aboutme,
    files: {
      description: await descFile.async('text'),
      behavior: await behavFile.async('text'),
      soul: soulFile ? await soulFile.async('text') : undefined,
      guides,
      knowledge,
      behaviors,
    },
  }
}
