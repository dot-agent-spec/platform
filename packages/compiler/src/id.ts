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

import type { IdParts } from './types.js'

// Code hosting platforms whose namespace format is platform/user rather than plain domain.
// The list is maintained by the compiler and updated via CLI releases.
export const KNOWN_PLATFORMS = ['github.com', 'gitlab.com', 'codeberg.org', 'sr.ht'] as const

function parseNamespaceName(identifier: string): { namespace: string; name: string } {
  // Email namespace: @ appears before any /
  const atIdx = identifier.indexOf('@')
  if (atIdx !== -1 && (identifier.indexOf('/') === -1 || atIdx < identifier.indexOf('/'))) {
    const slashIdx = identifier.indexOf('/')
    if (slashIdx === -1) {
      throw new Error(`Invalid agent ID: email namespace requires a name after '/' (got '${identifier}')`)
    }
    return {
      namespace: identifier.slice(0, slashIdx),
      name: identifier.slice(slashIdx + 1),
    }
  }

  // Known code-hosting platforms: namespace is platform/user, name is the next segment.
  for (const platform of KNOWN_PLATFORMS) {
    if (identifier.startsWith(platform + '/')) {
      const afterPlatform = identifier.slice(platform.length + 1)
      const slashIdx = afterPlatform.indexOf('/')
      if (slashIdx === -1) {
        throw new Error(
          `Invalid agent ID: '${platform}' namespace requires a user segment and a name (got '${identifier}')`,
        )
      }
      return {
        namespace: platform + '/' + afterPlatform.slice(0, slashIdx),
        name: afterPlatform.slice(slashIdx + 1),
      }
    }
  }

  // Domain or reserved keyword (e.g. 'unknown'): last '/' separates namespace from name.
  const lastSlash = identifier.lastIndexOf('/')
  if (lastSlash === -1) {
    throw new Error(`Invalid agent ID: missing '/' separator in '${identifier}'`)
  }
  return {
    namespace: identifier.slice(0, lastSlash),
    name: identifier.slice(lastSlash + 1),
  }
}

export function parseId(id: string): IdParts {
  if (!id) throw new Error('Invalid agent ID: empty string')

  // Phase 1: split on the first ':' to isolate the identifier from version~digest.
  const colonIdx = id.indexOf(':')

  let identifier: string
  let version: string | undefined
  let digest: string | undefined

  if (colonIdx === -1) {
    // Form A: namespace/name
    identifier = id
  } else {
    identifier = id.slice(0, colonIdx)
    const rest = id.slice(colonIdx + 1)
    if (!rest) throw new Error(`Invalid agent ID: empty version after ':' in '${id}'`)

    // Phase 2: split version~digest
    const tildeIdx = rest.indexOf('~')
    if (tildeIdx === -1) {
      // Form B: namespace/name:version
      version = rest
    } else {
      // Form D: namespace/name:version~digest
      version = rest.slice(0, tildeIdx)
      digest = rest.slice(tildeIdx + 1)
      if (!version) throw new Error(`Invalid agent ID: empty version before '~' in '${id}'`)
      if (!digest) throw new Error(`Invalid agent ID: empty digest after '~' in '${id}'`)
    }
  }

  // Phase 3: extract namespace and name from the identifier
  const { namespace, name } = parseNamespaceName(identifier)

  if (!namespace) throw new Error(`Invalid agent ID: empty namespace in '${id}'`)
  if (!name) throw new Error(`Invalid agent ID: empty name in '${id}'`)

  return { namespace, name, version, digest }
}

export function buildId(parts: IdParts): string {
  const { namespace, name, version, digest } = parts
  if (!namespace || !name) {
    throw new Error('Missing required ID parts: namespace and name')
  }
  if (digest && !version) {
    throw new Error('Invalid ID parts: digest requires version')
  }
  let result = `${namespace}/${name}`
  if (version) {
    result += `:${version}`
    if (digest) result += `~${digest}`
  }
  // Ids are always lowercase — domains, platform usernames (GitHub/GitLab/
  // Codeberg/Sourcehut) and email local-parts are all case-insensitive in
  // practice, so normalizing here is safe and gives every id a single shape.
  return result.toLowerCase()
}

// Turns a human display name (e.g. "Fridge Assistant", from `agent Fridge
// Assistant` in the DSL — spaces/capitalization are deliberate there) into
// the kebab-case slug used for an id's name segment.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Accepts optional leading 'v' (id spec examples use it; monorepo tags after
// their '@' split don't), 1-3 dot-separated numeric groups, and optional
// -prerelease / +build suffixes — e.g. v1.0, 2.3.1, v1.0.0-alpha.1, 1.0+build.
const VERSION_RE = /^v?\d+(\.\d+){0,2}(-[0-9A-Za-z.]+)?(\+[0-9A-Za-z.]+)?$/i

export function isValidVersion(version: string): boolean {
  return VERSION_RE.test(version)
}

export function extractDigest(id: string): string {
  try {
    return parseId(id).digest ?? ''
  } catch {
    return ''
  }
}

export function extractName(id: string): string {
  try {
    return parseId(id).name
  } catch {
    return ''
  }
}
