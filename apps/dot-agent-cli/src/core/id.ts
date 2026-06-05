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

export interface IdParts {
  namespace: string
  name: string
  version: string
  digest: string
}

export function parseId(id: string): IdParts {
  const match = id.match(/^(.+)\/(.+):(.+)~(.+)$/)
  if (!match) {
    throw new Error(`Invalid agent ID format: ${id}. Expected: namespace/name:version~digest`)
  }
  const [, namespace, name, version, digest] = match
  return { namespace, name, version, digest }
}

export function buildId(parts: IdParts): string {
  const { namespace, name, version, digest } = parts
  if (!namespace || !name || !version || !digest) {
    throw new Error('Missing required ID parts: namespace, name, version, digest')
  }
  return `${namespace}/${name}:${version}~${digest}`
}

export function extractDigest(id: string): string {
  try {
    const parts = parseId(id)
    return parts.digest
  } catch {
    return ''
  }
}

export function extractName(id: string): string {
  try {
    const parts = parseId(id)
    return parts.name
  } catch {
    return ''
  }
}
