// SPDX-License-Identifier: Apache-2.0

// session.snapshot() / session.restore() — platform#17.
//
// Every snapshot here goes through JSON.stringify → JSON.parse before it is restored, because the
// contract is JSON-serialisability: a host stores the snapshot as text and a fresh process reads it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { loadAgent, AgentSession } from '../dist/index.mjs'

const ABOUTME = {
  dslVersion: 'dot-agent/0.1-alpha',
  id: 'test/snapshot-test:0.1.0:abc123',
  name: 'snapshot-test',
  description: 'SDK snapshot test agent',
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

// `init` has entry effects (goal, a counter bump, interact) that a rehydration must not replay:
// replaying the `+=` would also corrupt memory. `detail` nudges on its third prompt.
const BEHAVIOR = `
state init
  goal "Welcome"
  set session.visits += 1
  interact
  on intent "next" transition to detail
  on offtopic transition to init

state detail
  goal "Details"
  interact
  after 3 prompts
    set session.nudged = true
  end
  on intent "back" transition to init
  on offtopic transition to detail
`

const OTHER_BEHAVIOR = `
state init
  goal "Another agent"
  interact
  on intent "next" transition to detail

state detail
  goal "Elsewhere"
  interact
`

async function buildBundle({ id = ABOUTME.id, behavior = BEHAVIOR } = {}) {
  const zip = new JSZip()
  zip.file('.agent/aboutme.json', JSON.stringify({ ...ABOUTME, id }))
  zip.file('.agent/files.json', JSON.stringify({
    description: 'snap.description',
    behavior: 'snap.behavior',
  }))
  zip.file('snap.description', '# Snapshot test agent')
  zip.file('snap.behavior', behavior)
  return loadAgent(await zip.generateAsync({ type: 'uint8array' }))
}

const settle = () => new Promise(r => setImmediate(r))
const throughJson = (value) => JSON.parse(JSON.stringify(value))

function record(session) {
  const seen = []
  session.setEffectListener(e => seen.push(e))
  const handled = []
  for (const type of ['goal', 'request_interact', 'set_memory', 'transition']) {
    session.registerHandler(type, e => handled.push(e))
  }
  return { seen, handled }
}

// A session in `detail` with two prompts spent and memory of every type the kernel stores.
async function advancedSession() {
  const session = await AgentSession.create(await buildBundle())
  session.start()
  session.sendIntent('next')
  session.tickPrompt()
  session.tickPrompt()
  // Values chosen to break a naive encoding: strings that read as numbers, booleans and null;
  // quotes, a backslash, a newline and outer whitespace; numbers that are not integers.
  // injectMemory takes the kernel's own value encoding, so the strings go in quote-wrapped.
  session.injectMemory('user', 'looks_numeric', '"42"')
  session.injectMemory('user', 'looks_boolean', '"true"')
  session.injectMemory('user', 'looks_null', '"null"')
  session.injectMemory('user', 'awkward', '"  he said "hi" \\ back\nslash  "')
  session.injectMemory('user', 'empty', '""')
  session.injectMemory('context', 'ratio', '3.25')
  session.injectMemory('context', 'negative', '-17')
  session.injectMemory('context', 'huge', '1e21')
  session.injectMemory('worksession', 'flag', 'false')
  session.injectMemory('worksession', 'nothing', 'null')
  return session
}

test('snapshot survives JSON and restore reproduces state, prompt count and memory', async () => {
  const original = await advancedSession()
  const snapshot = throughJson(original.snapshot())
  const expectedMemory = original.getMemory()
  assert.equal(original.getState(), 'detail')
  original.dispose()

  const restored = await AgentSession.create(await buildBundle())
  restored.restore(snapshot)

  assert.equal(restored.getState(), 'detail')
  assert.deepEqual(restored.getMemory(), expectedMemory, 'memory must round-trip exactly')
  assert.ok(restored.getValidIntents().includes('back'))
  restored.dispose()
})

test('every memory value keeps its type and exact content across the round trip', async () => {
  const original = await advancedSession()
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  const restored = await AgentSession.create(await buildBundle())
  restored.restore(snapshot)
  const byKey = Object.fromEntries(
    entriesOf(restored.getMemory()).map(({ domain, key, value }) => [`${domain}.${key}`, value]),
  )

  assert.strictEqual(byKey['user.looks_numeric'], '42')
  assert.strictEqual(byKey['user.looks_boolean'], 'true')
  assert.strictEqual(byKey['user.looks_null'], 'null')
  assert.strictEqual(byKey['user.awkward'], '  he said "hi" \\ back\nslash  ')
  assert.strictEqual(byKey['user.empty'], '')
  assert.strictEqual(byKey['context.ratio'], 3.25)
  assert.strictEqual(byKey['context.negative'], -17)
  assert.strictEqual(byKey['context.huge'], 1e21)
  assert.strictEqual(byKey['worksession.flag'], false)
  assert.strictEqual(byKey['worksession.nothing'], null)
  assert.strictEqual(byKey['session.visits'], 1, 'the init entry must not run its += again')
  restored.dispose()
})

test('an `after N prompts` handler fires on the right prompt after restore', async () => {
  const original = await advancedSession()        // two prompts spent in `detail`
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  const restored = await AgentSession.create(await buildBundle())
  const { handled } = record(restored)
  restored.restore(snapshot)
  restored.tickPrompt()                            // the third prompt in `detail`
  await settle()

  const nudge = handled.find(e => e.type === 'set_memory' && e.key === 'nudged')
  assert.ok(nudge, `the third prompt must fire the handler, got ${JSON.stringify(handled)}`)
  restored.dispose()
})

test('restore emits none of the init state entry effects', async () => {
  const original = await advancedSession()
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  const restored = await AgentSession.create(await buildBundle())
  const { seen, handled } = record(restored)
  restored.restore(snapshot)
  await settle()

  assert.deepEqual(seen, [], 'the effect listener must not see the discarded load effects')
  assert.deepEqual(handled, [], 'no handler may receive the discarded load effects')
  restored.dispose()
})

test('a snapshot taken right after start restores into init without replaying it', async () => {
  const original = await AgentSession.create(await buildBundle())
  original.start()
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  const restored = await AgentSession.create(await buildBundle())
  const { seen } = record(restored)
  restored.restore(snapshot)
  await settle()

  assert.equal(restored.getState(), 'init')
  assert.deepEqual(seen, [])
  const visits = entriesOf(restored.getMemory()).find(e => e.key === 'visits')
  assert.strictEqual(visits.value, 1)
  restored.dispose()
})

test('the restored session keeps driving: an intent after restore emits its effects', async () => {
  const original = await advancedSession()
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  const restored = await AgentSession.create(await buildBundle())
  const { handled } = record(restored)
  restored.restore(snapshot)
  restored.sendIntent('back')
  await settle()

  assert.equal(restored.getState(), 'init')
  assert.ok(handled.some(e => e.type === 'goal' && e.text === 'Welcome'))
  restored.dispose()
})

// ── rejection: throw, stay unstarted, stay usable for start() ────────────────

async function assertRejectedAndStillStartable(snapshot, pattern) {
  const session = await AgentSession.create(await buildBundle())
  const { seen } = record(session)
  assert.throws(() => session.restore(snapshot), pattern)
  assert.equal(session.getState(), '', 'a rejected restore must leave the session unstarted')
  assert.deepEqual(seen, [], 'a rejected restore must emit nothing')

  session.start()
  await settle()
  assert.equal(session.getState(), 'init')
  assert.ok(seen.some(e => e.type === 'goal' && e.text === 'Welcome'), 'start() must still work')
  const visits = entriesOf(session.getMemory()).find(e => e.key === 'visits')
  assert.strictEqual(visits.value, 1, 'a rejected restore must leave no memory behind')
  session.dispose()
}

test('restore rejects a snapshot from a different agent', async () => {
  const other = await AgentSession.create(await buildBundle({
    id: 'test/other-agent:0.1.0:def456', behavior: OTHER_BEHAVIOR,
  }))
  other.start()
  other.sendIntent('next')
  const snapshot = throughJson(other.snapshot())
  other.dispose()

  await assertRejectedAndStillStartable(snapshot, /different agent/)
})

test('restore rejects a snapshot whose behavior changed under the same agent id', async () => {
  // Same id, different state graph: the kernel fingerprint is the backstop.
  const other = await AgentSession.create(await buildBundle({ behavior: OTHER_BEHAVIOR }))
  other.start()
  const snapshot = throughJson(other.snapshot())
  other.dispose()

  await assertRejectedAndStillStartable(snapshot, /different behavior/)
})

test('restore rejects malformed snapshots', async () => {
  const good = await advancedSession()
  const valid = throughJson(good.snapshot())
  good.dispose()

  const malformed = [
    null,
    42,
    'a string',
    [],
    {},
    { ...valid, kernel: undefined },
    { ...valid, kernel: 'not json' },
    { ...valid, memory: 'nope' },
    { ...valid, memory: [{ domain: 'nowhere', key: 'k', value: 1 }] },
    { ...valid, memory: [{ domain: 'user', key: 'k', value: { nested: true } }] },
    { ...valid, memory: [{ domain: 'user', key: 3, value: 1 }] },
  ]
  for (const snapshot of malformed) {
    await assertRejectedAndStillStartable(throughJson(snapshot ?? null), /snapshot/i)
  }
})

test('restore rejects an unknown snapshot version', async () => {
  const good = await advancedSession()
  const valid = throughJson(good.snapshot())
  good.dispose()

  const futures = [
    { ...valid, v: 999 },
    // The kernel's own version travels inside and is checked by the kernel.
    { ...valid, kernel: JSON.stringify({ ...JSON.parse(valid.kernel), v: 99 }) },
  ]
  for (const snapshot of futures) {
    await assertRejectedAndStillStartable(snapshot, /version/)
  }
})

test('restore rejects a snapshot naming a state the behavior does not declare', async () => {
  const good = await advancedSession()
  const valid = throughJson(good.snapshot())
  good.dispose()
  const snapshot = { ...valid, kernel: JSON.stringify({ ...JSON.parse(valid.kernel), state: 'nowhere' }) }

  await assertRejectedAndStillStartable(snapshot, /unknown state/)
})

// ── restored memory is the snapshot's, exactly ───────────────────────────────
//
// restore() has to load the behavior, and loading runs init's entry on the fresh kernel. Anything
// that entry writes which the original never wrote must not survive into the restored memory.

const CONDITIONAL_INIT = `
state init
  if user.name == null
    set session.anonymous = true
  end
  goal "g"
  interact
  on intent "next" transition to b

state b
  goal "b"
  interact
`

// Init transitions on load unless user.name is set, and `detour`'s entry writes memory.
const TRANSITIONING_INIT = `
state init
  if user.name == null
    transition to detour
  end
  goal "g"
  interact
  on intent "next" transition to b

state detour
  set session.via_detour = true
  goal "detour"
  interact
  on intent "next" transition to b

state b
  goal "b"
  interact
`

async function assertRestoredMemoryIsExact(behavior, expectedState) {
  const original = await AgentSession.create(await buildBundle({ behavior }))
  original.injectMemory('user', 'name', '"Ana"')
  original.start()
  if (expectedState === 'b') original.sendIntent('next')
  const expected = original.getMemory()
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  const restored = await AgentSession.create(await buildBundle({ behavior }))
  const { seen } = record(restored)
  restored.restore(snapshot)
  await settle()
  assert.deepEqual(restored.getMemory(), expected, 'restored memory must hold no key the original lacked')
  assert.equal(restored.getState(), expectedState)
  assert.deepEqual(seen, [])
  restored.dispose()
}

test('memory written by the reload of init does not leak into the restored memory', async () => {
  await assertRestoredMemoryIsExact(CONDITIONAL_INIT, 'b')
})

test('memory written by a state init transitions into on load does not leak either', async () => {
  await assertRestoredMemoryIsExact(TRANSITIONING_INIT, 'init')
})

test('a failed restore keeps memory injected before it, and start() then sees it', async () => {
  const good = await advancedSession()
  const valid = throughJson(good.snapshot())
  good.dispose()
  const refused = { ...valid, kernel: JSON.stringify({ ...JSON.parse(valid.kernel), state: 'nowhere' }) }

  const session = await AgentSession.create(await buildBundle())
  session.injectMemory('user', 'name', '"Ana"')
  session.injectMemory('user', 'quote', '"say "hi" \\ there "')
  assert.throws(() => session.restore(refused), /unknown state/)
  const byKey = () => Object.fromEntries(entriesOf(session.getMemory()).map(e => [`${e.domain}.${e.key}`, e.value]))
  assert.strictEqual(byKey()['user.name'], 'Ana', 'memory injected before the failed restore must survive it')
  assert.strictEqual(byKey()['user.quote'], 'say "hi" \\ there ')
  assert.equal(byKey()['session.visits'], undefined, 'nothing from the discarded load may remain')

  session.start()
  assert.strictEqual(byKey()['user.name'], 'Ana')
  assert.strictEqual(byKey()['session.visits'], 1)
  session.dispose()
})

test('the file resolver still serves merges on start() after a failed restore', async () => {
  const main = `merge "extra.behavior"

state init
  goal "main"
  interact
  on intent "go" transition to extra
`
  const extra = `state extra
  goal "from extra"
  interact
`
  const session = await AgentSession.create(await buildBundle({ behavior: main }))
  session.setFileResolver(p => (p === 'extra.behavior' ? extra : null))
  const { seen } = record(session)
  const foreign = {
    format: 'dot-agent/session-snapshot', v: 1, agent: ABOUTME.id,
    kernel: '{"v":1,"behavior":"0000000000000000","state":"init","prompt_count":0}', memory: [],
  }
  assert.throws(() => session.restore(foreign), /different behavior/)

  session.start()
  session.sendIntent('go')
  await settle()
  assert.equal(session.getState(), 'extra', `the merged state must load: ${JSON.stringify(seen)}`)
  assert.ok(!seen.some(e => e.type === 'parse_error'))
  session.dispose()
})

test('restore throws when the behavior fails to parse, and leaves the session unstarted', async () => {
  const good = await advancedSession()
  const snapshot = throughJson(good.snapshot())
  good.dispose()

  const broken = await AgentSession.create(await buildBundle({ behavior: 'state init\n  on intent "x" transition to\n' }))
  const { seen } = record(broken)
  assert.throws(() => broken.restore(snapshot), /failed to load/)
  assert.equal(broken.getState(), '')
  assert.deepEqual(seen, [], 'the parse_error effect of the discarded load must not be dispatched')
  assert.throws(() => broken.snapshot(), /not started|no behavior/)
  broken.dispose()
})

test('snapshot after a start() whose behavior failed to parse is refused', async () => {
  const broken = await AgentSession.create(await buildBundle({ behavior: 'state init\n  on intent "x" transition to\n' }))
  const { seen } = record(broken)
  broken.start()                                   // start() keeps its behaviour: it emits parse_error
  await settle()
  assert.ok(seen.some(e => e.type === 'parse_error'), 'start() still reports the parse error')
  assert.throws(() => broken.snapshot(), /no behavior loaded/)
  broken.dispose()
})

// ── lifecycle: restore replaces start ────────────────────────────────────────

test('restore on a started session is refused', async () => {
  const good = await advancedSession()
  const snapshot = throughJson(good.snapshot())
  good.dispose()

  const session = await AgentSession.create(await buildBundle())
  session.start()
  assert.throws(() => session.restore(snapshot), /already started/)
  assert.equal(session.getState(), 'init', 'the refused restore must not move the session')
  session.dispose()
})

test('start after restore is refused, and so is a second restore', async () => {
  const good = await advancedSession()
  const snapshot = throughJson(good.snapshot())
  good.dispose()

  const session = await AgentSession.create(await buildBundle())
  session.restore(snapshot)
  assert.throws(() => session.start(), /already restored/)
  assert.throws(() => session.restore(snapshot), /already started/)
  assert.equal(session.getState(), 'detail')
  session.dispose()
})

test('snapshot before start or restore is refused', async () => {
  const session = await AgentSession.create(await buildBundle())
  assert.throws(() => session.snapshot(), /not started/)
  session.dispose()
})

test('restore takes resolveContent like start: teach content resolves after rehydration', async () => {
  const behavior = `
state init
  interact
  on intent "next" transition to detail

state detail
  interact
  on intent "learn" transition to lesson

state lesson
  teach "knowledge/facts.md"
  interact
`
  const zip = new JSZip()
  zip.file('.agent/aboutme.json', JSON.stringify(ABOUTME))
  zip.file('.agent/files.json', JSON.stringify({
    description: 'snap.description', behavior: 'snap.behavior', knowledge: ['knowledge/facts.md'],
  }))
  zip.file('snap.description', '# Snapshot test agent')
  zip.file('snap.behavior', behavior)
  zip.file('knowledge/facts.md', 'Water is wet.')
  const bytes = await zip.generateAsync({ type: 'uint8array' })

  const original = await AgentSession.create(await loadAgent(bytes))
  original.start()
  original.sendIntent('next')
  const snapshot = throughJson(original.snapshot())
  original.dispose()

  for (const [options, expected] of [[undefined, 'Water is wet.'], [{ resolveContent: false }, null]]) {
    const restored = await AgentSession.create(await loadAgent(bytes))
    const teach = []
    restored.registerHandler('teach', e => teach.push(e))
    if (options === undefined) restored.restore(snapshot)
    else restored.restore(snapshot, options)
    restored.sendIntent('learn')
    await settle()
    assert.equal(teach.length, 1)
    assert.strictEqual(teach[0].content, expected)
    restored.dispose()
  }
})

// getMemory() is documented as an array of entries; accept the kernel's `{ entries }` wrapper too,
// so these tests pin the snapshot behaviour and not that pre-existing shape question.
function entriesOf(memory) {
  return Array.isArray(memory) ? memory : memory.entries
}
