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

import { readFile, writeFile, mkdir, rename } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { runHostCommand, HostCommandError } from '../host-command.js'

export interface ConfigureResult {
  target: TargetName

  // plugin-install hosts (claude) — see ADR-DA00-08
  pluginId?: string
  pluginVersion?: string
  pluginEnabled?: boolean
  marketplaceName?: string
  marketplaceSource?: string
  marketplaceAdded?: boolean
  legacyConfigPath?: string
  legacyEntriesRemoved?: string[]

  // file-write hosts (gemini, murici — no dot-agent plugin format yet)
  dest?: string
  mcpConfigPath?: string
  mcpConfigured?: boolean
  skillInstalled?: boolean
  registeredServers?: string[]
  skillSkippedReason?: string
}

export interface ConfigureOptions {
  claude?: boolean
  gemini?: boolean
  agy?: boolean
  murici?: boolean
  skill?: boolean
  mcp?: boolean
}

type TargetName = 'claude' | 'gemini' | 'murici'
type ServerKey = 'helper' | 'dev'

interface McpServerSpec {
  command: string
  args: string[]
}

// Exported so tests/plugin-manifest-parity.test.ts can assert these match
// plugins/claude/.claude-plugin/plugin.json's own mcpServers — the two are hand-kept in sync, and
// nothing else catches drift between them.
export const SERVERS: Record<ServerKey, McpServerSpec> = {
  helper: { command: 'dot-agent', args: ['run', '--helper'] },
  dev: { command: 'dot-agent', args: ['server-mcp', '--mcp-transport', 'stdio'] },
}

export const SERVER_NAMES: Record<ServerKey, string> = {
  helper: 'dot-agent-helper',
  dev: 'dot-agent',
}

// The `dev` server was renamed from `dot-agent-dev` to `dot-agent` when the runtime tools
// (load_agent, send_intent, ...) were folded in — see plugins/claude/AGENTS.md. Drop the old key
// from any config this CLI wrote before that rename, so it doesn't linger as a dead server entry.
const STALE_SERVER_NAMES = ['dot-agent-dev']

interface PluginMarketplace {
  name: string
  source: string
  // git-source hosts only; limits the checkout to these paths (this repo is a monorepo).
  sparse?: string[]
}

// A host with a native dot-agent plugin (ADR-DA00-08): the host's own plugin mechanism owns
// registration end to end. `configure` installs the plugin and, since a plugin manifest is
// declarative and can never delete, also deletes whatever dot-agent MCP entries a previous CLI run
// left in the host's own config file. It never writes new entries there — legacyConfigPath is
// delete-only, on purpose; sharing a name with a *written* path is exactly what invites a future
// regression back to writing it.
interface PluginTarget {
  kind: 'plugin'
  bin: string
  marketplace: PluginMarketplace
  plugin: string
  legacyConfigPath: string
  legacyServerNames: string[]
}

// A host with no dot-agent plugin format yet: this CLI is still the only thing that can register it,
// so it writes the skill file and/or MCP config directly.
interface FileTarget {
  kind: 'files'
  mcpConfigPath: string
  mcpServerKeys: ServerKey[]
  formatServerEntry: (spec: McpServerSpec) => Record<string, unknown>
  // undefined = this host has no skill-file concept (murici)
  skillDest?: string
}

type ConfigureTarget = PluginTarget | FileTarget

function getTargets(): Record<TargetName, ConfigureTarget> {
  return {
    claude: {
      kind: 'plugin',
      bin: 'claude',
      marketplace: {
        name: 'dot-agent-spec',
        source: 'dot-agent-spec/platform',
        sparse: ['.claude-plugin', 'plugins'],
      },
      plugin: 'dot-agent',
      legacyConfigPath: join(homedir(), '.claude.json'),
      // Every name this CLI is known to have written under mcpServers, current and historical —
      // derived, not re-typed, so a future rename of SERVER_NAMES stays covered automatically.
      legacyServerNames: [...Object.values(SERVER_NAMES), ...STALE_SERVER_NAMES],
    },
    gemini: {
      kind: 'files',
      mcpConfigPath: join(homedir(), '.gemini', 'config', 'mcp_config.json'),
      mcpServerKeys: ['helper', 'dev'],
      formatServerEntry: spec => ({ ...spec }),
      skillDest: join(homedir(), '.gemini', 'config', 'skills', 'dot-agent', 'SKILL.md'),
    },
    murici: {
      kind: 'files',
      // murici's MCP client config (lib/mcp/config-store.ts) requires an explicit transport
      // field and only supports stdio/legacy sse — no skill-file concept exists there.
      mcpConfigPath: join(homedir(), '.config', 'murici', 'mcp.json'),
      mcpServerKeys: ['helper'],
      formatServerEntry: spec => ({ transport: 'stdio', ...spec }),
    },
  }
}

async function configureMcpServer(target: FileTarget): Promise<{ path: string; registeredServers: string[] }> {
  const configPath = target.mcpConfigPath

  let config: any = {}
  try {
    const content = await readFile(configPath, 'utf-8')
    config = JSON.parse(content)
  } catch {
    // File doesn't exist or is invalid JSON
  }

  if (!config.mcpServers) {
    config.mcpServers = {}
  }

  for (const staleName of STALE_SERVER_NAMES) {
    delete config.mcpServers[staleName]
  }

  const registeredServers: string[] = []
  for (const key of target.mcpServerKeys) {
    const serverName = SERVER_NAMES[key]
    config.mcpServers[serverName] = target.formatServerEntry(SERVERS[key])
    registeredServers.push(serverName)
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

  return { path: configPath, registeredServers }
}

export interface LegacyCleanup {
  path: string
  removed: string[]
}

/**
 * Deletes the dot-agent MCP server entries a previous `configure --claude` run may have written into a
 * host's config file, now that the host's own plugin owns registration (ADR-DA00-08). This file — for
 * Claude Code, `~/.claude.json` — holds the host's entire user state, not just `mcpServers`, so every
 * branch here is deliberately conservative: never create it, never touch it on a parse failure, never
 * write when nothing needs removing, and delete only exact server names this CLI is known to have
 * written itself.
 */
export async function removeLegacyMcpEntries(configPath: string, legacyServerNames: string[]): Promise<LegacyCleanup> {
  const none: LegacyCleanup = { path: configPath, removed: [] }

  let raw: string
  try {
    raw = await readFile(configPath, 'utf-8')
  } catch {
    // File doesn't exist — nothing was ever written here. Never create it: this file holds the host's
    // entire user state, and an empty {} would look like erasing the account.
    return none
  }

  let config: any
  try {
    config = JSON.parse(raw)
  } catch {
    // Exists but unreadable. Writing our guess now would replace everything the file holds with a blank
    // slate. Refuse and change nothing instead.
    throw new Error(
      `${configPath} is not valid JSON — refusing to touch it.\n` +
        `It holds the host's entire user state, so nothing was changed. Remove any ` +
        `${legacyServerNames.map(n => `"${n}"`).join(', ')} entry under "mcpServers" by hand, then re-run.`,
    )
  }

  const servers = config?.mcpServers
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    return none
  }

  // Exact match only — a user's own "dot-agent-mine" is not ours to delete. Top-level mcpServers only:
  // entries nested under a per-project config (e.g. Claude Code's projects[*].mcpServers) were never
  // written by this CLI.
  const removed = legacyServerNames.filter(name => Object.prototype.hasOwnProperty.call(servers, name))
  if (removed.length === 0) {
    return none
  }

  for (const name of removed) delete servers[name]

  // Atomic write given the stakes: a crash mid-write must not truncate the rest of the file.
  const tmpPath = `${configPath}.tmp`
  await writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8')
  await rename(tmpPath, configPath)

  return { path: configPath, removed }
}

interface MarketplaceListEntry {
  name: string
  source?: string
  path?: string
  repo?: string
}

interface PluginListEntry {
  id: string
  version?: string
  enabled?: boolean
}

interface PluginInstallOutcome {
  marketplaceName: string
  marketplaceSource: string
  marketplaceAdded: boolean
  pluginId: string
  pluginVersion?: string
  pluginEnabled?: boolean
}

async function findMarketplace(t: PluginTarget): Promise<MarketplaceListEntry | undefined> {
  const { stdout } = await runHostCommand(t.bin, ['plugin', 'marketplace', 'list', '--json'])
  let list: unknown
  try {
    list = JSON.parse(stdout)
  } catch {
    // Malformed/unexpected output — fall through as "not found" and let the add/install calls below
    // surface a real error if something is actually wrong, rather than throwing a raw SyntaxError here.
    return undefined
  }
  return Array.isArray(list) ? list.find((m): m is MarketplaceListEntry => m?.name === t.marketplace.name) : undefined
}

async function addMarketplace(t: PluginTarget): Promise<void> {
  const sparse = t.marketplace.sparse ?? []
  const args = ['plugin', 'marketplace', 'add', t.marketplace.source, ...(sparse.length ? ['--sparse', ...sparse] : [])]
  try {
    await runHostCommand(t.bin, args)
  } catch (err) {
    // One narrow retry: a host predating --sparse rejects the flag outright. Anything else rethrows.
    const e = err as HostCommandError
    if (sparse.length > 0 && e instanceof HostCommandError && e.reason === 'failed' && /unknown option/i.test(e.stderr ?? '')) {
      await runHostCommand(t.bin, ['plugin', 'marketplace', 'add', t.marketplace.source])
      return
    }
    throw err
  }
}

async function findInstalledPlugin(t: PluginTarget, id: string): Promise<PluginListEntry | undefined> {
  const { stdout } = await runHostCommand(t.bin, ['plugin', 'list', '--json'])
  let list: unknown
  try {
    list = JSON.parse(stdout)
  } catch {
    return undefined
  }
  return Array.isArray(list) ? list.find((p): p is PluginListEntry => p?.id === id) : undefined
}

/**
 * Installs the host's native dot-agent plugin (ADR-DA00-08). `claude plugin install` is already
 * idempotent at the host — re-running against an installed plugin exits 0 — so this never pre-checks
 * for that; it only reads the plugin list back afterward, purely to report version/enabled. If a
 * marketplace of the expected name already exists, even pointing somewhere else entirely (a local dev
 * checkout is the common case on a contributor's own machine), it is used as-is and never re-pointed —
 * `marketplace add` runs only when no marketplace by that name exists yet.
 */
async function installHostPlugin(t: PluginTarget): Promise<PluginInstallOutcome> {
  const id = `${t.plugin}@${t.marketplace.name}`

  const existing = await findMarketplace(t)

  let marketplaceAdded = false
  let marketplaceSource = existing?.path ?? existing?.repo ?? existing?.source ?? t.marketplace.source
  if (!existing) {
    await addMarketplace(t)
    marketplaceAdded = true
    marketplaceSource = t.marketplace.source
  }

  await runHostCommand(t.bin, ['plugin', 'install', id, '--scope', 'user'])

  const entry = await findInstalledPlugin(t, id)

  return {
    marketplaceName: t.marketplace.name,
    marketplaceSource,
    marketplaceAdded,
    pluginId: id,
    pluginVersion: entry?.version,
    pluginEnabled: entry?.enabled,
  }
}

async function configurePluginTarget(targetName: TargetName, target: PluginTarget): Promise<ConfigureResult> {
  const install = await installHostPlugin(target)
  const cleanup = await removeLegacyMcpEntries(target.legacyConfigPath, target.legacyServerNames)

  return {
    target: targetName,
    pluginId: install.pluginId,
    pluginVersion: install.pluginVersion,
    pluginEnabled: install.pluginEnabled,
    marketplaceName: install.marketplaceName,
    marketplaceSource: install.marketplaceSource,
    marketplaceAdded: install.marketplaceAdded,
    legacyConfigPath: cleanup.path,
    legacyEntriesRemoved: cleanup.removed,
  }
}

async function configureFileTarget(targetName: TargetName, target: FileTarget, doSkill: boolean, doMcp: boolean): Promise<ConfigureResult> {
  const result: ConfigureResult = { target: targetName }

  if (doSkill) {
    if (target.skillDest) {
      const skillSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'run', 'SKILL.md')
      const skillContent = await readFile(skillSrc, 'utf-8')

      await mkdir(dirname(target.skillDest), { recursive: true })
      await writeFile(target.skillDest, skillContent, 'utf-8')

      result.dest = target.skillDest
      result.skillInstalled = true
    } else if (!doMcp) {
      result.skillSkippedReason = `${targetName} has no skill file — nothing to install.`
    }
  }

  if (doMcp) {
    const { path: mcpPath, registeredServers } = await configureMcpServer(target)
    result.mcpConfigPath = mcpPath
    result.mcpConfigured = true
    result.registeredServers = registeredServers
  }

  return result
}

export async function configure(options?: ConfigureOptions): Promise<ConfigureResult[]> {
  const targets: TargetName[] = []
  if (options?.claude) targets.push('claude')
  if (options?.gemini || options?.agy) targets.push('gemini')
  if (options?.murici) targets.push('murici')

  if (targets.length === 0) {
    targets.push('claude')
  }

  const doSkill = options?.skill ?? (!options?.mcp)
  const doMcp = options?.mcp ?? (!options?.skill)

  const allTargets = getTargets()
  const results: ConfigureResult[] = []

  // --skill/--mcp only mean something for a file-write target: a plugin target has one authority for
  // both (ADR-DA00-08), so the flags are ignored there and the full install+cleanup always runs.
  for (const targetName of targets) {
    const target = allTargets[targetName]
    results.push(
      target.kind === 'plugin'
        ? await configurePluginTarget(targetName, target)
        : await configureFileTarget(targetName, target, doSkill, doMcp),
    )
  }

  return results
}
