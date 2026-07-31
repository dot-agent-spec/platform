// SPDX-License-Identifier: Apache-2.0

import JSZip from 'jszip'
import { parseAboutme, extractFiles, validateMagicBytes, validateZipBomb, classifyContentPath } from '@dot-agent/compiler/core'
import type { AgentBundle } from './types.js'

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
    persona?: string
    behaviors?: string[]
    guides?: string[]
    knowledge?: string[]
  }

  const descFile = zip.file(filesJson.description)
  const behavFile = zip.file(filesJson.behavior)
  if (!descFile) throw new Error(`Missing ${filesJson.description} in bundle`)
  if (!behavFile) throw new Error(`Missing ${filesJson.behavior} in bundle`)

  const personaFile = filesJson.persona ? zip.file(filesJson.persona) : null
  const allFiles = await extractFiles(zip)

  const guides: Array<{ path: string; content: string }> = []
  const knowledge: Array<{ path: string; content: string }> = []
  const behaviors: Array<{ path: string; content: string }> = []

  for (const [path, content] of allFiles) {
    const ns = classifyContentPath(path)
    if (ns === 'guides' && path !== 'guides/.gitkeep') {
      guides.push({ path, content })
    } else if (ns === 'knowledge' && path !== 'knowledge/.gitkeep') {
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
      persona: personaFile ? await personaFile.async('text') : undefined,
      guides,
      knowledge,
      behaviors,
    },
  }
}
