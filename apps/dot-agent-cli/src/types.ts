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

import type { AboutMe, LintMessage, PackOptions, PackResult, Integrity } from '@dot-agent/compiler'

export type { AboutMe, LintMessage, PackOptions, PackResult, Integrity }

export interface InitOptions {
  name?: string
  domain?: string
  dir?: string
}

export interface InitResult {
  dir: string
  files: string[]
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
