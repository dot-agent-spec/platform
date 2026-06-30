import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

export interface InstallSkillResult {
  dest: string
}

export async function installSkill(): Promise<InstallSkillResult> {
  const skillSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dot-agent', 'SKILL.md')
  const skillContent = await readFile(skillSrc, 'utf-8')

  const dest = join(homedir(), '.claude', 'skills', 'dot-agent', 'SKILL.md')
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, skillContent, 'utf-8')

  return { dest }
}
