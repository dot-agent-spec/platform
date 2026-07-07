import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

export interface InstallSkillResult {
  dest: string
  mcpConfigPath?: string
  mcpConfigured?: boolean
}

export interface InstallSkillOptions {
  claude?: boolean
  gemini?: boolean
  agy?: boolean
  mcp?: boolean
}

async function configureMcpServer(target: 'claude' | 'gemini'): Promise<{ path: string }> {
  const configPath = target === 'claude'
    ? join(homedir(), '.claude.json')
    : join(homedir(), '.gemini', 'antigravity-ide', 'mcp_config.json')

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

  config.mcpServers['dot-agent'] = {
    command: 'dot-agent',
    args: ['run', '--helper']
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

  return { path: configPath }
}

export async function installSkill(options?: InstallSkillOptions): Promise<InstallSkillResult[]> {
  const skillSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dot-agent', 'SKILL.md')
  const skillContent = await readFile(skillSrc, 'utf-8')

  const targets: Array<'claude' | 'gemini'> = []
  if (options?.claude) targets.push('claude')
  if (options?.gemini || options?.agy) targets.push('gemini')

  if (targets.length === 0) {
    targets.push('claude')
  }

  const results: InstallSkillResult[] = []

  for (const target of targets) {
    const dest = target === 'gemini'
      ? join(homedir(), '.gemini', 'config', 'skills', 'dot-agent', 'SKILL.md')
      : join(homedir(), '.claude', 'skills', 'dot-agent', 'SKILL.md')

    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, skillContent, 'utf-8')

    const result: InstallSkillResult = { dest }

    if (options?.mcp) {
      const { path: mcpPath } = await configureMcpServer(target)
      result.mcpConfigPath = mcpPath
      result.mcpConfigured = true
    }

    results.push(result)
  }

  return results
}
