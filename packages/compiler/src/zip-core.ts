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
