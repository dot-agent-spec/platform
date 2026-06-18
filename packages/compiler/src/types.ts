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

export type LangId = 'description' | 'behavior'

export interface FSMStatement {
  type: string
  [key: string]: unknown
}

export interface FSMStateDef {
  name: string
  body: FSMStatement[]
}

export interface FSMTriggerDecl {
  event: string
  body: FSMStatement[]
}

export interface FSMDefinition {
  merges: string[]
  global_triggers: FSMTriggerDecl[]
  states: FSMStateDef[]
}

export interface LintMessage {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface IdParts {
  namespace: string
  name: string
  version?: string
  digest?: string
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
    inputType?: string | object
    outputType?: string | object
    public?: boolean
  }>
  [key: string]: any
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

export interface BuildAboutmeOptions {
  id: string
  name: string
  description: string
  version: string
  domain: string
  license?: string
  persona: string
  compiler: string
  commit?: string
  skills?: Skill[]
  requires?: string[]
  integrity: Integrity
}
