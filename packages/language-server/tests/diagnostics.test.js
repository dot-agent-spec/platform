// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { diagnose } from '../features/diagnostics.js'
import { setWorkspaceRoots } from '../merge-graph.js'

// file:// URIs so fileURLToPath doesn't throw
const BEHAVIOR_URI = 'file:///test.behavior'
const DESC_URI     = 'file:///test.description'

// ── behavior ──────────────────────────────────────────────────────────────────

// Valid oriented state: goal + interact + on intent (block) + on offtopic (block)
const VALID_BEHAVIOR = `\
state init
  transition to responsive

state responsive
  goal "How can I help?"
  interact
  on intent "go"
    transition to init
  on offtopic
    transition to responsive
`

describe('diagnose — behavior — valid', () => {
    it('returns no errors for well-formed behavior', async () => {
        const diags = await diagnose(BEHAVIOR_URI, 'behavior', VALID_BEHAVIOR)
        const errors = diags.filter(d => d.severity === 1) // DiagnosticSeverity.Error
        expect(errors).toHaveLength(0)
    })
})

describe('diagnose — behavior — E005 dangling transition', () => {
    it('reports error for transition to undefined state', async () => {
        const text = 'state init\n  transition to ghost\n'
        const diags = await diagnose(BEHAVIOR_URI, 'behavior', text)
        const e005 = diags.filter(d => d.message.includes('E005'))
        expect(e005.length).toBeGreaterThan(0)
        expect(e005[0].severity).toBe(1) // Error
    })
})

describe('diagnose — behavior — W002 long text', () => {
    it('warns when goal text exceeds 280 characters', async () => {
        const long = 'a'.repeat(281)
        const text = `state init\n  goal "${long}"\n  transition to init\n`
        const diags = await diagnose(BEHAVIOR_URI, 'behavior', text)
        const w002 = diags.filter(d => d.message.includes('W002'))
        expect(w002.length).toBeGreaterThan(0)
        expect(w002[0].severity).toBe(2) // Warning
    })
})

// ── description ───────────────────────────────────────────────────────────────

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

describe('diagnose — description — valid', () => {
    it('returns no errors for well-formed description', async () => {
        const diags = await diagnose(DESC_URI, 'description', VALID_DESCRIPTION)
        const errors = diags.filter(d => d.severity === 1)
        expect(errors).toHaveLength(0)
    })
})

describe('diagnose — description — W003 default domain', () => {
    it('warns when domain is still "example.com"', async () => {
        const text = VALID_DESCRIPTION.replace('health.example.com', 'example.com')
        const diags = await diagnose(DESC_URI, 'description', text)
        const w003 = diags.filter(d => d.message.includes('W003'))
        expect(w003.length).toBeGreaterThan(0)
        expect(w003[0].severity).toBe(2) // Warning
    })
})

describe('diagnose — behavior — E016 missing init state', () => {
    it('reports error when no init state exists', async () => {
        const text = 'state lobby\n  goal "Welcome"\n  interact\n'
        const diags = await diagnose(BEHAVIOR_URI, 'behavior', text)
        const e016 = diags.filter(d => d.message.includes('E016'))
        expect(e016.length).toBeGreaterThan(0)
        expect(e016[0].severity).toBe(1) // Error
    })
})

// ── unknown langId ────────────────────────────────────────────────────────────

describe('diagnose — unknown langId', () => {
    it('returns empty array', async () => {
        const diags = await diagnose(BEHAVIOR_URI, 'unknown', 'anything')
        expect(diags).toHaveLength(0)
    })
})

// ── merge: fragment files & line-shift regressions ─────────────────────────────
//
// Reproduces the real-world bug: an agent with `main.behavior` (has `merge`)
// and a fragment file it merges in that has no `merge` of its own. These
// tests need real files on disk because findAgentRoot/findMergeRoot/
// consolidate all read the agent directory, unlike the in-memory cases above.

let tmpDir

async function makeMergedAgent(files) {
    tmpDir = await mkdtemp(join(tmpdir(), 'language-server-diagnostics-test-'))
    setWorkspaceRoots([tmpDir])
    await writeFile(
        join(tmpDir, 'agent.description'),
        'agent Tour\n  domain example.com\n  license MIT\n\ndescription\n  Tour agent.\n\nbehavior main.behavior\n'
    )
    for (const [name, content] of Object.entries(files)) {
        await writeFile(join(tmpDir, name), content)
    }
    return tmpDir
}

function uriFor(dir, name) {
    return pathToFileURL(join(dir, name)).toString()
}

afterEach(async () => {
    setWorkspaceRoots([])
    if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true })
        tmpDir = ''
    }
})

const MAIN_BEHAVIOR = `\
merge "fragment.behavior"

state init
  transition to responsive

state responsive
  goal "Welcome to the tour."
  interact
  on intent "start" transition to frag_state_a
  on intent "start" transition to responsive
  on offtopic transition to responsive
`

const FRAGMENT_BEHAVIOR = `\
state frag_state_a
  goal "Fragment step."
  interact
  on intent "next" transition to responsive
  on offtopic transition to responsive
`

describe('diagnose — merge — fragment file merged by another file', () => {
    it('does not report E005 for a transition target defined in the parent file', async () => {
        const dir = await makeMergedAgent({ 'main.behavior': MAIN_BEHAVIOR, 'fragment.behavior': FRAGMENT_BEHAVIOR })
        const diags = await diagnose(uriFor(dir, 'fragment.behavior'), 'behavior', FRAGMENT_BEHAVIOR)
        const e005 = diags.filter(d => d.message.includes('E005'))
        expect(e005).toHaveLength(0)
    })

    it('does not report E016 (missing init) on a fragment that has no init of its own', async () => {
        const dir = await makeMergedAgent({ 'main.behavior': MAIN_BEHAVIOR, 'fragment.behavior': FRAGMENT_BEHAVIOR })
        const diags = await diagnose(uriFor(dir, 'fragment.behavior'), 'behavior', FRAGMENT_BEHAVIOR)
        const e016 = diags.filter(d => d.message.includes('E016'))
        expect(e016).toHaveLength(0)
    })

    it('still reports whole-tree E016 when neither the root nor the fragment declares init', async () => {
        const noInitMain = MAIN_BEHAVIOR.replace('state init\n  transition to responsive\n\n', '')
        const dir = await makeMergedAgent({ 'main.behavior': noInitMain, 'fragment.behavior': FRAGMENT_BEHAVIOR })
        const diags = await diagnose(uriFor(dir, 'main.behavior'), 'behavior', noInitMain)
        const e016 = diags.filter(d => d.message.includes('E016'))
        expect(e016.length).toBeGreaterThan(0)
    })
})

describe('diagnose — merge — local diagnostics keep this file\'s own line numbers', () => {
    it('reports W008 (duplicate intent) at its real line in main.behavior, not shifted by the merged fragment', async () => {
        const dir = await makeMergedAgent({ 'main.behavior': MAIN_BEHAVIOR, 'fragment.behavior': FRAGMENT_BEHAVIOR })
        const diags = await diagnose(uriFor(dir, 'main.behavior'), 'behavior', MAIN_BEHAVIOR)
        const w008 = diags.filter(d => d.message.includes('W008'))
        expect(w008).toHaveLength(1)
        // line 10 (1-indexed) is the duplicate `on intent "start"` inside `state responsive`
        expect(w008[0].range.start.line).toBe(9)
    })
})
