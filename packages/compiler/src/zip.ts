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
import { readFile, writeFile } from 'fs/promises'
export { createZip, extractFiles } from './zip-core.js'

const MAX_ZIP_SIZE = 500 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 100

export async function readZip(filePath: string): Promise<JSZip> {
  const data = await readFile(filePath)
  return JSZip.loadAsync(data)
}

export async function validateZipBomb(filePath: string): Promise<boolean> {
  const data = await readFile(filePath)
  const zip = await JSZip.loadAsync(data)

  let totalUncompressed = 0
  zip.forEach((_relativePath, file) => {
    if (!file.dir) {
      totalUncompressed += (file as any)._data?.uncompressedSize || 0
    }
  })

  const compressedSize = data.length
  const ratio = totalUncompressed / compressedSize

  if (totalUncompressed > MAX_ZIP_SIZE) {
    throw new Error(`ZIP uncompressed size exceeds 500MB limit: ${totalUncompressed}`)
  }

  if (ratio > MAX_COMPRESSION_RATIO) {
    throw new Error(`ZIP compression ratio exceeds 100x limit: ${ratio.toFixed(1)}x`)
  }

  return true
}

export async function validateMagicBytes(filePath: string): Promise<boolean> {
  const data = await readFile(filePath)
  const magic = data.subarray(0, 4)
  if (!(magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04)) {
    throw new Error('File is not a valid ZIP (invalid magic bytes)')
  }
  return true
}

export async function writeZip(zip: JSZip, outPath: string): Promise<void> {
  const data = await zip.generateAsync({ type: 'arraybuffer' })
  await writeFile(outPath, Buffer.from(data))
}
