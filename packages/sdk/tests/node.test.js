import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { loadAgent } from '../dist/index.js'
import { AgentSession } from '../dist/index.js'

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
