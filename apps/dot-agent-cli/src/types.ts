export interface LintMessage {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface InitOptions {
  name?: string
  domain?: string
  dir?: string
}

export interface InitResult {
  dir: string
  files: string[]
}

export interface PackOptions {
  dir?: string
  out?: string
  commit?: string
  version?: string
}

export interface PackResult {
  path: string
  id: string
  warnings: LintMessage[]
}

export interface UnpackOptions {
  file: string
  out?: string
  force?: boolean
}

export interface UnpackResult {
  dir: string
  id: string
  files: string[]
  aboutme: AboutMe
}

export interface RunOptions {
  source: string
}

export interface FileEntry {
  path: string
  content: string
}

export interface AgentContext {
  id: string
  description: any
  behavior: any
  kernel: any
  files: {
    soul?: string
    guides: FileEntry[]
    knowledge: FileEntry[]
    behaviors: FileEntry[]
  }
  aboutme: AboutMe
  on(event: string, listener: (...args: any[]) => void): this
  emit(event: string, ...args: any[]): boolean
}

export interface Skill {
  id: string
  description: string
}

export interface Integrity {
  sha256: string
  types?: string
  files?: string
}

export interface AboutMe {
  schemaVersion: string
  id: string
  name: string
  description: string
  version: string
  domain: string
  license: string
  persona: string
  compiler: string
  commit?: string
  skills: Skill[]
  requires: string[]
  integrity: Integrity
}

export interface ParsedDescription {
  domain: string
  name: string
  version: string
  description: string
  capabilities: Array<{
    name: string
    type?: string
    description: string
  }>
  [key: string]: any
}

export interface ParsedBehavior {
  [key: string]: any
}
