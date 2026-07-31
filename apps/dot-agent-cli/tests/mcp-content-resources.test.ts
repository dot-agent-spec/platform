// SPDX-License-Identifier: Apache-2.0

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
