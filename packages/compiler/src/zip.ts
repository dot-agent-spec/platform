// SPDX-License-Identifier: Apache-2.0

import JSZip from 'jszip'
import { readFile, writeFile } from 'fs/promises'
export { createZip, extractFiles } from './zip-core.js'
import {
  validateMagicBytes as validateMagicBytesCore,
  validateZipBomb as validateZipBombCore,
} from './zip-core.js'

export async function readZip(filePath: string): Promise<JSZip> {
  const data = await readFile(filePath)
  return JSZip.loadAsync(data)
}

export async function validateZipBomb(filePath: string): Promise<boolean> {
  const data = await readFile(filePath)
  const zip = await JSZip.loadAsync(data)
  validateZipBombCore(zip, data.length)
  return true
}

export async function validateMagicBytes(filePath: string): Promise<boolean> {
  const data = await readFile(filePath)
  validateMagicBytesCore(data)
  return true
}

export async function writeZip(zip: JSZip, outPath: string): Promise<void> {
  const data = await zip.generateAsync({ type: 'arraybuffer' })
  await writeFile(outPath, Buffer.from(data))
}
