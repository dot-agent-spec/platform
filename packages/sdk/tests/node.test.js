// SPDX-License-Identifier: Apache-2.0

import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { loadAgent } from '../dist/index.mjs'
import { AgentSession } from '../dist/index.mjs'

const ABOUTME = {
  dslVersion: 'dot-agent/0.1-alpha',
  id: 'test/sdk-test:0.1.0:abc123',
  name: 'sdk-test',
  description: 'SDK integration test agent',
  version: '0.1.0',
  domain: 'test',
  license: 'Apache-2.0',
  persona: 'Test persona',
  compiler: '@dot-agent/compiler@0.1.0',
  skills: [],
  requires: [],
  capabilities: [],
  integrity: { sha256: 'abc123' },
}

const BEHAVIOR = `
state init
  goal "Hello from SDK"
  interact
  on intent "next" transition to goodbye
  on offtopic transition to init

state goodbye
  goal "All done"
  interact
  on intent "restart" transition to init
  on offtopic transition to goodbye
`

const DESCRIPTION = '# SDK Test Agent\nA test agent for SDK integration tests.'

async function buildTestBundle() {
  const zip = new JSZip()
  zip.file('.agent/aboutme.json', JSON.stringify(ABOUTME))
  zip.file('.agent/files.json', JSON.stringify({
    description: 'sdk-test.description',
    behavior: 'sdk-test.behavior',
  }))
  zip.file('sdk-test.description', DESCRIPTION)
  zip.file('sdk-test.behavior', BEHAVIOR)
  return zip.generateAsync({ type: 'uint8array' })
}

test('loadAgent parses bundle and returns AgentBundle', async () => {
  const bytes = await buildTestBundle()
  const bundle = await loadAgent(bytes)

  assert.equal(bundle.id, ABOUTME.id)
  assert.equal(bundle.aboutme.name, ABOUTME.name)
  assert.equal(bundle.files.behavior, BEHAVIOR)
  assert.equal(bundle.files.description, DESCRIPTION)
  assert.ok(Array.isArray(bundle.files.guides))
  assert.ok(Array.isArray(bundle.files.knowledge))
})

test('loadAgent rejects invalid magic bytes', async () => {
  const invalid = new Uint8Array([0x00, 0x01, 0x02, 0x03])
  await assert.rejects(
    () => loadAgent(invalid),
    /invalid magic bytes/
  )
})

test('AgentSession.create initializes kernel without start', async () => {
  const bytes = await buildTestBundle()
  const bundle = await loadAgent(bytes)
  const session = await AgentSession.create(bundle)

  // Before start(), state should be empty
  assert.equal(session.getState(), '')
  session.dispose()
})

test('AgentSession.start() dispatches initial goal and interact effects', async () => {
  const bytes = await buildTestBundle()
  const bundle = await loadAgent(bytes)
  const session = await AgentSession.create(bundle)

  const collected = []
  session.registerHandler('goal', (e) => collected.push(e))
  session.registerHandler('request_interact', (e) => collected.push(e))

  session.start()

  // Effects are dispatched synchronously in dispatchRaw
  // Give any async handlers a tick to settle
  await new Promise(r => setImmediate(r))

  assert.ok(collected.length >= 1, `Expected at least 1 effect, got ${collected.length}`)
  const goalEffect = collected.find(e => e.type === 'goal')
  assert.ok(goalEffect, 'Expected a goal effect')
  assert.equal(goalEffect.text, 'Hello from SDK')

  assert.equal(session.getState(), 'init')
  session.dispose()
})

test('AgentSession.sendIntent transitions state', async () => {
  const bytes = await buildTestBundle()
  const bundle = await loadAgent(bytes)
  const session = await AgentSession.create(bundle)

  const collected = []
  session.registerHandler('goal', (e) => collected.push(e))
  session.registerHandler('request_interact', (e) => collected.push(e))
  session.registerHandler('transition', (e) => collected.push(e))

  session.start()
  assert.equal(session.getState(), 'init')

  collected.length = 0
  session.sendIntent('next')
  await new Promise(r => setImmediate(r))

  assert.equal(session.getState(), 'goodbye')
  const goalAfter = collected.find(e => e.type === 'goal')
  assert.ok(goalAfter, 'Expected goal effect after transition')
  assert.equal(goalAfter.text, 'All done')

  session.dispose()
})

test('AgentSession.getValidIntents returns intents for current state', async () => {
  const bytes = await buildTestBundle()
  const bundle = await loadAgent(bytes)
  const session = await AgentSession.create(bundle)
  session.start()

  const intents = session.getValidIntents()
  assert.ok(Array.isArray(intents), 'getValidIntents should return an array')
  assert.ok(intents.some(i => i === 'next' || (typeof i === 'object' && i.intent === 'next')),
    `Expected "next" in intents, got: ${JSON.stringify(intents)}`)

  session.dispose()
})

test('AgentSession.getGraph returns topology', async () => {
  const bytes = await buildTestBundle()
  const bundle = await loadAgent(bytes)
  const session = await AgentSession.create(bundle)
  session.start()

  const scxml = session.getGraph()
  assert.ok(typeof scxml === 'string' && scxml.includes('<scxml'), 'getGraph should return SCXML')
  assert.ok(scxml.includes('id="init"'), 'graph should contain init state')
  assert.ok(scxml.match(/id="init"[^>]*_active="true"|_active="true"[^>]*id="init"/),
    'init state should be the active state')

  session.dispose()
})

// ── teach / guide content resolution ─────────────────────────────────────────
//
// The Rust tests build the content map by hand and call the engine directly, so they skip the two
// seams that only exist on this side: the JSON boundary of `set_content_files`, and the agreement
// between the bundle key `load.ts` produces and the key the kernel looks up. These pin both.
//
// They run against `../dist`, so they need the chain built first:
//   npm run build -w packages/kernel-dsl   (cargo test + wasm32-wasip1 + wasm-bindgen + wasi-stub)
//   npm run build -w packages/compiler && npm run build -w packages/sdk
// `cargo test -p dot-agent-kernel-dsl` alone cannot reach any of this.

const CONTENT_BEHAVIOR = `
state init
  goal "Talk about cars"
  guide "guides/tone.md"
  teach "knowledge/cars.md"
  teach "./knowledge/cars.md"
  teach "Never guess a price."
  interact
  on intent "next" transition to goodbye
  on offtopic transition to init

state goodbye
  goal "All done"
  interact
  on intent "restart" transition to init
  on offtopic transition to goodbye
`

const CARS_MD = '# Car categories\nCompact, SUV, van.'
const TONE_MD = 'Stay concise.'

async function buildContentBundle() {
  const zip = new JSZip()
  zip.file('.agent/aboutme.json', JSON.stringify(ABOUTME))
  zip.file('.agent/files.json', JSON.stringify({
    description: 'sdk-test.description',
    behavior: 'sdk-test.behavior',
    knowledge: ['knowledge/cars.md'],
    guides: ['guides/tone.md'],
  }))
  zip.file('sdk-test.description', DESCRIPTION)
  zip.file('sdk-test.behavior', CONTENT_BEHAVIOR)
  zip.file('knowledge/cars.md', CARS_MD)
  zip.file('guides/tone.md', TONE_MD)
  return zip.generateAsync({ type: 'uint8array' })
}

async function collectContentEffects(startOptions) {
  const bytes = await buildContentBundle()
  const bundle = await loadAgent(bytes)
  const session = await AgentSession.create(bundle)

  const teach = []
  const guide = []
  session.registerHandler('teach', (e) => teach.push(e))
  session.registerHandler('guide', (e) => guide.push(e))

  if (startOptions === undefined) session.start()
  else session.start(startOptions)
  await new Promise(r => setImmediate(r))

  session.dispose()
  return { teach, guide }
}

test('AgentSession.start() fills teach/guide content from the bundle files', async () => {
  const { teach, guide } = await collectContentEffects()

  assert.equal(teach.length, 3, `Expected 3 teach effects, got ${teach.length}`)
  assert.equal(teach[0].text, 'knowledge/cars.md', 'the literal path must survive untouched')
  assert.equal(teach[0].content, CARS_MD, 'content must come from files.knowledge')

  assert.equal(guide.length, 1)
  assert.equal(guide[0].text, 'guides/tone.md')
  assert.equal(guide[0].content, TONE_MD, 'content must come from files.guides')
})

test('AgentSession.start() resolves a ./-prefixed reference, as the packer bundles it', async () => {
  // The packer's normalizeRefPath strips the leading './' before choosing the bundle key, so this
  // form packs clean. If the kernel stopped normalizing, it would arrive with content null.
  const { teach } = await collectContentEffects()

  assert.equal(teach[1].text, './knowledge/cars.md', 'the literal argument is still the path given')
  assert.equal(teach[1].content, CARS_MD, 'the lookup key must be normalized as the packer does')
})

test('AgentSession.start() leaves inline prose unresolved', async () => {
  const { teach } = await collectContentEffects()

  assert.equal(teach[2].text, 'Never guess a price.')
  assert.equal(teach[2].content, null, 'prose is not a bundle key and must not resolve')
})

test('AgentSession.start({ resolveContent: false }) keeps bare paths', async () => {
  // The opt-out the CLI's MCP server uses: it serves the files itself as dot-agent://<path>.
  const { teach, guide } = await collectContentEffects({ resolveContent: false })

  assert.equal(teach[0].text, 'knowledge/cars.md', 'the path is still delivered')
  assert.equal(teach[0].content, null, 'no content map was handed over, so nothing resolves')
  assert.equal(guide[0].content, null)
})
