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

export const MAX_ZIP_SIZE = 500 * 1024 * 1024
export const MAX_COMPRESSION_RATIO = 100

export function validateMagicBytes(bytes: Uint8Array): void {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new Error('Not a valid .agent file (invalid magic bytes)')
  }
}

export function validateZipBomb(zip: JSZip, compressedSize: number): void {
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

export function createZip(): JSZip {
  return new JSZip()
}

export async function extractFiles(zip: JSZip, filter?: string[]): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  const promises: Promise<void>[] = []

  zip.forEach((relativePath, file) => {
    if (file.dir) return
    if (filter && !filter.some(f => relativePath.startsWith(f))) return
    promises.push(
      file.async('text').then(content => {
        files.set(relativePath, content)
      })
    )
  })

  await Promise.all(promises)
  return files
}
