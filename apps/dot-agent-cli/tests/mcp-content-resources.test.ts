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

// Regression coverage for the `{name}` -> `{+name}` fix: mcp-howto.test.ts and
// server-mcp.test.ts mock ResourceTemplate entirely, so they exercise a resource
// handler's internal logic but never the URI routing in front of it. A plain
// `{name}` variable compiles to a regex that excludes `/` — it can never match a
// nested reference like `knowledge/sub/deep.md` — so this test uses the REAL SDK
// class against the exact pattern strings mcp-run.ts registers.

import { describe, it, expect } from 'vitest'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'

describe('knowledge/guides resource URI templates', () => {
  it('matches a nested knowledge reference', () => {
    const template = new ResourceTemplate('dot-agent://knowledge/{+name}', { list: undefined })
    expect(template.uriTemplate.toString()).toBe('dot-agent://knowledge/{+name}') // sanity: still the pattern we expect

    const match = template.uriTemplate.match('dot-agent://knowledge/sub/deep.md')
    expect(match).toEqual({ name: 'sub/deep.md' })
  })

  it('matches a flat knowledge reference', () => {
    const template = new ResourceTemplate('dot-agent://knowledge/{+name}', { list: undefined })
    const match = template.uriTemplate.match('dot-agent://knowledge/local-models.md')
    expect(match).toEqual({ name: 'local-models.md' })
  })

  it('matches a nested guides reference', () => {
    const template = new ResourceTemplate('dot-agent://guides/{+name}', { list: undefined })
    const match = template.uriTemplate.match('dot-agent://guides/sub/plan.md')
    expect(match).toEqual({ name: 'sub/plan.md' })
  })

  it('a plain {name} variable (the pre-fix pattern) fails to match a nested reference', () => {
    const template = new ResourceTemplate('dot-agent://knowledge/{name}', { list: undefined })
    const match = template.uriTemplate.match('dot-agent://knowledge/sub/deep.md')
    expect(match).toBeNull()
  })
})
