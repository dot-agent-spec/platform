// SPDX-License-Identifier: Apache-2.0

declare const agentSnapshotBrand: unique symbol

/**
 * A serialisable capture of an `AgentSession`: where its FSM stands, how many prompts it has
 * spent there, and its memory. Produced by `session.snapshot()`, consumed by `session.restore()`.
 *
 * **Opaque by contract.** The only promise is that the value survives `JSON.stringify` →
 * `JSON.parse` unchanged in meaning, so a host can store it as text anywhere it likes. Its fields
 * are not part of the API and may change shape between versions — the value carries its own
 * version, and `restore()` refuses one it does not read. Build one only with `snapshot()`.
 */
export type AgentSnapshot = { readonly [agentSnapshotBrand]: 'AgentSnapshot' }

/** The format tag and version this SDK writes, and the only ones it reads. */
export const SNAPSHOT_FORMAT = 'dot-agent/session-snapshot'
export const SNAPSHOT_VERSION = 1

export type MemoryValue = string | number | boolean | null

export interface MemoryEntry {
  domain: string
  key: string
  value: MemoryValue
}

/** What an `AgentSnapshot` is underneath. Internal — callers see only the brand. */
export interface SnapshotBody {
  format: typeof SNAPSHOT_FORMAT
  v: typeof SNAPSHOT_VERSION
  /** `bundle.id` of the agent the snapshot was taken from. */
  agent: string
  /** The kernel's own `serialize_state()` blob, kept verbatim: it carries its own version. */
  kernel: string
  /** Every memory entry, as the kernel's `get_memory()` reports them. */
  memory: MemoryEntry[]
}

const MEMORY_DOMAINS = new Set(['context', 'session', 'worksession', 'user'])

function malformed(reason: string): Error {
  return new Error(`AgentSession.restore: malformed snapshot — ${reason}`)
}

/**
 * Check an untrusted value is a snapshot this SDK can read, before anything touches the kernel.
 * Throws a descriptive Error otherwise; returns the value typed as its body.
 */
export function readSnapshot(value: unknown): SnapshotBody {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw malformed(`expected an object, got ${value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value}`)
  }
  const body = value as Record<string, unknown>
  if (body.format !== SNAPSHOT_FORMAT) {
    throw malformed(`missing or unknown format tag ${JSON.stringify(body.format)} (expected "${SNAPSHOT_FORMAT}")`)
  }
  if (body.v !== SNAPSHOT_VERSION) {
    throw new Error(
      `AgentSession.restore: unsupported snapshot version ${JSON.stringify(body.v)} — this SDK reads version ${SNAPSHOT_VERSION}`,
    )
  }
  if (typeof body.agent !== 'string') throw malformed('"agent" is not a string')
  if (typeof body.kernel !== 'string') throw malformed('"kernel" is not a string')
  if (!Array.isArray(body.memory)) throw malformed('"memory" is not an array')
  body.memory.forEach((entry, i) => {
    if (entry === null || typeof entry !== 'object') throw malformed(`memory[${i}] is not an object`)
    const { domain, key, value: v } = entry as Record<string, unknown>
    if (typeof domain !== 'string' || !MEMORY_DOMAINS.has(domain)) {
      throw malformed(`memory[${i}].domain ${JSON.stringify(domain)} is not one of ${[...MEMORY_DOMAINS].join(', ')}`)
    }
    if (typeof key !== 'string') throw malformed(`memory[${i}].key is not a string`)
    const ok = v === null || typeof v === 'string' || typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v))
    if (!ok) throw malformed(`memory[${i}].value is not a string, finite number, boolean or null`)
  })
  return body as unknown as SnapshotBody
}

/**
 * Encode a memory value for the kernel's `set_memory`, so it lands as exactly the value read.
 *
 * The kernel's `parse_json_primitive` is not a JSON parser: it trims, tries `null`/`true`/`false`
 * and an f64, then strips one pair of outer quotes **without unescaping**. So a string is wrapped
 * in raw quotes rather than JSON-encoded — `JSON.stringify('a"b')` would arrive as `a\"b` — and
 * the wrapping also shields strings that read as numbers or keywords, and outer whitespace, from
 * the earlier branches. `-0` is spelled out because `String(-0)` is `"0"`.
 */
export function encodeMemoryValue(value: MemoryValue): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value)
  return `"${value}"`
}
