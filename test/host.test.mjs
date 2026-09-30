import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { mount } from '../.test-build/host.js'

const T = (n) => 1_700_000_000_000 + n

/** A session whose stored tail is a crash-repaired turn, as DSH resumes it. */
function crashTailSession(id, time = T(5)) {
  return {
    id,
    header: { origin: 'user' },
    snapshotEvents: () => [
      { type: 'turn/start', seq: 1, time: T(1), data: { turn: 1 } },
      { type: 'assistant/message', seq: 2, time: T(2), data: {} },
      { type: 'turn/end', seq: 3, time, data: { turn: 1, reason: { kind: 'interrupted' } } },
      { type: 'session/end-seed', seq: 4, time, data: {} },
    ],
  }
}

/** A session that finished its last turn normally. */
function finishedSession(id) {
  return {
    id,
    header: { origin: 'user' },
    snapshotEvents: () => [
      { type: 'turn/start', seq: 1, time: T(1), data: { turn: 1 } },
      { type: 'turn/end', seq: 2, time: T(2), data: { turn: 1, reason: { kind: 'completed' } } },
    ],
  }
}

async function harness({ agents } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'session-ledger-host-'))
  const listeners = new Map()
  const routes = new Map()
  const warnings = []
  const ctx = {
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
      return ctx
    },
    effect(callback) {
      return callback()
    },
    get(name) {
      if (name === 'dshHomePath') return (file) => join(dir, file)
      if (name === 'agents') return agents
      return undefined
    },
    logger: { warn: (message) => warnings.push(message) },
    webServer: {
      register(route) {
        routes.set(route.path, route)
        return () => {}
      },
    },
  }
  mount(ctx)
  const emit = (event, ...args) => {
    for (const listener of listeners.get(event) ?? []) listener(...args)
  }
  const post = async (endpoint, body) => {
    const route = routes.get('/session-ledger')
    assert.ok(route, 'the host half must register its route')
    const req = new EventEmitter()
    req.method = 'POST'
    req.url = '/session-ledger/' + endpoint
    const res = {
      statusCode: 0,
      payload: '',
      setHeader() {},
      end(chunk) {
        this.payload = String(chunk ?? '')
      },
    }
    const pending = route.handler(req, res)
    req.emit('data', JSON.stringify(body ?? {}))
    req.emit('end')
    await pending
    assert.equal(res.statusCode, 200, res.payload)
    return JSON.parse(res.payload)
  }
  return { dir, listeners, warnings, emit, post }
}

test('a restored session whose tail was crash-repaired is reported as interrupted', async () => {
  const h = await harness()
  h.emit('session/created', crashTailSession('s1'))
  const body = await h.post('list')
  assert.equal(body.ok, true)
  assert.deepEqual(body.value.interrupted, [{ sessionId: 's1', at: T(5) }])
  assert.deepEqual(body.value.unread, [{ sessionId: 's1', at: T(5), kind: 'interrupted' }])
})

test('sessions restored before the plugin mounted are scanned once', async () => {
  const h = await harness({ agents: { list: () => [{ session: crashTailSession('s0', T(3)) }] } })
  const body = await h.post('list')
  assert.deepEqual(body.value.interrupted, [{ sessionId: 's0', at: T(3) }])
})

test('a restored Session that finished normally is not a reminder', async () => {
  const h = await harness()
  h.emit('session/created', finishedSession('s1'))
  const body = await h.post('list')
  assert.deepEqual(body.value.interrupted, [])
  assert.deepEqual(body.value.unread, [], 'restoring a finished Session must not re-arm unread')
})

test('a live turn end after the scan clears the interrupted marker', async () => {
  const h = await harness()
  h.emit('session/created', crashTailSession('s1'))
  assert.equal((await h.post('list')).value.interrupted.length, 1)
  h.emit('session/event', { id: 's1' }, { type: 'turn/end', time: T(9), data: { turn: 2, reason: { kind: 'completed' } } })
  const body = await h.post('list')
  assert.deepEqual(body.value.interrupted, [], 'the resumed turn resolves the orphan')
})

test('malformed sessions and event snapshots never throw', async () => {
  const h = await harness({ agents: { list: () => [{}, { session: null }, { session: { id: 's9' } }] } })
  h.emit('session/created', { id: 's2' })
  h.emit('session/created', { id: 's3', snapshotEvents: () => null })
  h.emit('session/created', { id: 's4', snapshotEvents: () => [{ type: 'turn/end', data: 7 }] })
  h.emit('session/created', null)
  const body = await h.post('list')
  assert.deepEqual(body.value.interrupted, [])
})
