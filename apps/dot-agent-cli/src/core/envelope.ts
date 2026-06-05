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

import { AboutMe, Integrity, Skill } from '../types.js'

export function parseAboutme(json: any): AboutMe {
  if (!json.schemaVersion) throw new Error('Missing schemaVersion in aboutme.json')
  if (!json.id) throw new Error('Missing id in aboutme.json')
  if (!json.name) throw new Error('Missing name in aboutme.json')
  if (!json.description) throw new Error('Missing description in aboutme.json')
  if (!json.version) throw new Error('Missing version in aboutme.json')
  if (!json.domain) throw new Error('Missing domain in aboutme.json')
  if (!json.license) throw new Error('Missing license in aboutme.json')
  if (!json.persona) throw new Error('Missing persona in aboutme.json')
  if (!json.compiler) throw new Error('Missing compiler in aboutme.json')
  if (!Array.isArray(json.skills)) throw new Error('Missing skills array in aboutme.json')
  if (!Array.isArray(json.requires)) throw new Error('Missing requires array in aboutme.json')
  if (!json.integrity) throw new Error('Missing integrity in aboutme.json')

  return {
    schemaVersion: json.schemaVersion,
    id: json.id,
    name: json.name,
    description: json.description,
    version: json.version,
    domain: json.domain,
    license: json.license,
    persona: json.persona,
    compiler: json.compiler,
    commit: json.commit,
    skills: json.skills,
    requires: json.requires,
    integrity: json.integrity,
  }
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

export function buildAboutme(opts: BuildAboutmeOptions): AboutMe {
  return {
    schemaVersion: 'dot-agent/1.0',
    id: opts.id,
    name: opts.name,
    description: opts.description,
    version: opts.version,
    domain: opts.domain,
    license: opts.license || 'Apache-2.0',
    persona: opts.persona,
    compiler: opts.compiler,
    commit: opts.commit,
    skills: opts.skills || [],
    requires: opts.requires || [],
    integrity: opts.integrity,
  }
}

export function aboutmeToJson(aboutme: AboutMe): string {
  return JSON.stringify(aboutme, null, 2)
}
