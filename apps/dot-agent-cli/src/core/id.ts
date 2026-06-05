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
