// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { AboutMe, BuildAboutmeOptions } from './types.js'
import { DSL_VERSION } from './generated-version.js'

export function parseAboutme(json: any): AboutMe {
  if (!json.dslVersion) throw new Error('Missing dslVersion in aboutme.json')
  if (!json.id) throw new Error('Missing id in aboutme.json')
  if (!json.name) throw new Error('Missing name in aboutme.json')
  if (!json.description) throw new Error('Missing description in aboutme.json')
  if (!json.version) throw new Error('Missing version in aboutme.json')
  if (!json.domain) throw new Error('Missing domain in aboutme.json')
  if (!json.compiler) throw new Error('Missing compiler in aboutme.json')
  if (!Array.isArray(json.capabilities)) throw new Error('Missing capabilities array in aboutme.json')
  if (!Array.isArray(json.requires)) throw new Error('Missing requires array in aboutme.json')
  if (!json.integrity) throw new Error('Missing integrity in aboutme.json')

  return {
    dslVersion: json.dslVersion,
    id: json.id,
    name: json.name,
    description: json.description,
    version: json.version,
    domain: json.domain,
    license: json.license ?? '',
    persona: json.persona,
    purpose: json.purpose ?? 'unknown',
    compiler: json.compiler,
    commit: json.commit,
    capabilities: json.capabilities,
    requires: json.requires,
    integrity: json.integrity,
  }
}

export function buildAboutme(opts: BuildAboutmeOptions): AboutMe {
  return {
    dslVersion: `dot-agent/${DSL_VERSION}`,
    id: opts.id,
    name: opts.name,
    description: opts.description,
    version: opts.version,
    domain: opts.domain,
    license: opts.license ?? '',
    persona: opts.persona,
    purpose: opts.purpose ?? 'unknown',
    compiler: opts.compiler,
    commit: opts.commit,
    capabilities: opts.capabilities ?? [],
    requires: opts.requires ?? [],
    integrity: opts.integrity,
  }
}

export function aboutmeToJson(aboutme: AboutMe): string {
  return JSON.stringify(aboutme, null, 2)
}
