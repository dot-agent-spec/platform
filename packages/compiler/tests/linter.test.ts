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

import { describe, it, expect } from 'vitest'
import { lintDescription, lintBehavior } from '../src/linter.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_DESCRIPTION = `\
agent Doctor
  domain health.example.com
  license MIT

description
  Clinical diagnostic agent.

capabilities
  DiagnoseAction "Emit a structured diagnosis"

input Patient
output Prescription
`

const VALID_BEHAVIOR = `\
state init
  transition to responsive

state responsive
  goal "How can I help?"
  interact
  on intent "examine" transition to examine
  on intent "done" transition to init
  on offtopic transition to responsive

state examine
  goal "Review patient history."
  interact
  on intent "complete" transition to responsive
  on offtopic transition to responsive
`

// ── lintDescription ───────────────────────────────────────────────────────────

describe('lintDescription — valid input', () => {
  it('returns no messages for a well-formed description', async () => {
    const msgs = await lintDescription(VALID_DESCRIPTION)
    expect(msgs.filter(m => m.severity === 'error')).toHaveLength(0)
  })
})

describe('lintDescription — W003 default domain', () => {
  it('warns when domain is still "example.com"', async () => {
    const src = VALID_DESCRIPTION.replace('health.example.com', 'example.com')
    const msgs = await lintDescription(src)
    const w003 = msgs.filter(m => m.code === 'W003')
    expect(w003).toHaveLength(1)
    expect(w003[0].severity).toBe('warning')
    expect(w003[0].message).toMatch(/example\.com/)
  })

  it('does NOT warn for a non-default domain', async () => {
    const msgs = await lintDescription(VALID_DESCRIPTION)
    expect(msgs.filter(m => m.code === 'W003')).toHaveLength(0)
  })
})

describe('lintDescription — syntax errors (E004)', () => {
  it('reports E004 for malformed description syntax', async () => {
    const broken = `\
agent @@INVALID@@
  domain
  license
`
    const msgs = await lintDescription(broken)
    expect(msgs.some(m => m.code === 'E004')).toBe(true)
    expect(msgs.every(m => m.severity === 'error' || m.severity === 'warning')).toBe(true)
  })
})

describe('lintDescription — file label', () => {
  it('uses "agent.description" as default file label', async () => {
    const msgs = await lintDescription(VALID_DESCRIPTION)
    msgs.forEach(m => expect(m.file).toBe('agent.description'))
  })

  it('uses a custom file label when provided', async () => {
    const broken = 'agent @@BAD@@\n  domain'
    const msgs = await lintDescription(broken, 'custom/path.description')
    msgs.forEach(m => expect(m.file).toBe('custom/path.description'))
  })
})

// ── lintBehavior ──────────────────────────────────────────────────────────────

describe('lintBehavior — valid input', () => {
  it('returns no errors for a well-formed behavior', async () => {
    const msgs = await lintBehavior(VALID_BEHAVIOR)
    expect(msgs.filter(m => m.severity === 'error')).toHaveLength(0)
  })
})

describe('lintBehavior — E005 dangling transition', () => {
  it('reports E005 for a transition to an undefined state', async () => {
    const src = `\
state init
  transition to nonexistent_state

state responsive
  goal "Ready."
  interact
  on intent "x" transition to init
  on offtopic transition to responsive
`
    const msgs = await lintBehavior(src)
    const e005 = msgs.filter(m => m.code === 'E005')
    expect(e005).toHaveLength(1)
    expect(e005[0].message).toMatch(/nonexistent_state/)
  })

  it('reports W005 (warning) for dotted external state references', async () => {
    const src = `\
state init
  transition to other.flow.state

state responsive
  goal "Ready."
  interact
  on intent "x" transition to init
  on offtopic transition to responsive
`
    const msgs = await lintBehavior(src)
    const w005 = msgs.filter(m => m.code === 'W005')
    expect(w005).toHaveLength(1)
    expect(w005[0].severity).toBe('warning')
  })
})

describe('lintBehavior — W002 long text block', () => {
  it('warns when a text block exceeds 280 characters', async () => {
    const longText = 'x'.repeat(300)
    const src = `\
state init
  transition to responsive

state responsive
  goal "${longText}"
  interact
  on intent "x" transition to responsive
  on offtopic transition to responsive
`
    const msgs = await lintBehavior(src)
    const w002 = msgs.filter(m => m.code === 'W002')
    expect(w002.length).toBeGreaterThanOrEqual(1)
    expect(w002[0].severity).toBe('warning')
  })

  it('does NOT warn for text blocks within 280 characters', async () => {
    const msgs = await lintBehavior(VALID_BEHAVIOR)
    expect(msgs.filter(m => m.code === 'W002')).toHaveLength(0)
  })
})

describe('lintBehavior — syntax errors (E004)', () => {
  it('reports E004 for broken behavior syntax', async () => {
    const broken = 'state @@@@\n  ??? garbage\n'
    const msgs = await lintBehavior(broken)
    expect(msgs.some(m => m.code === 'E004')).toBe(true)
  })
})

describe('lintBehavior — LintMessage shape', () => {
  it('every message has required fields', async () => {
    const broken = 'state @bad\n  transition to nowhere\n'
    const msgs = await lintBehavior(broken)
    for (const m of msgs) {
      expect(m).toHaveProperty('file')
      expect(m).toHaveProperty('line')
      expect(m).toHaveProperty('col')
      expect(m).toHaveProperty('severity')
      expect(m).toHaveProperty('code')
      expect(m).toHaveProperty('message')
      expect(typeof m.line).toBe('number')
      expect(typeof m.col).toBe('number')
    }
  })
})

describe('lintBehavior — file label', () => {
  it('uses "agent.behavior" as default file label', async () => {
    const msgs = await lintBehavior(VALID_BEHAVIOR)
    msgs.forEach(m => expect(m.file).toBe('agent.behavior'))
  })
})
