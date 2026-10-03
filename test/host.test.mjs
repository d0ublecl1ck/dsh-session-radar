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
  const dir = await mkdtemp(join(tmpdir(), 'unread-helper-host-'))
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
    const route = routes.get('/unread-helper')
    assert.ok(route, 'the host half must register its route')
    const req = new EventEmitter()
    req.method = 'POST'
    req.url = '/unread-helper/' + endpoint
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

test('a restored session whose tail was crash-repaired stays unread', async () => {
  const h = await harness()
  h.emit('session/created', crashTailSession('s1'))
  const body = await h.post('list')
  assert.equal(body.ok, true)
  assert.equal('interrupted' in body.value, false, 'the chip was removed; the snapshot carries no interrupted list')
  assert.deepEqual(body.value.unread, [{ sessionId: 's1', at: T(5), kind: 'interrupted' }])
})

test('a tail read acknowledges a restored interrupted Session for good', async () => {
  const h = await harness()
  h.emit('session/created', crashTailSession('s1'))
  const opened = await h.post('read', { sessionId: 's1' })
  assert.equal(opened.value.unread.length, 1, 'a plain open keeps the interrupted reminder')
  const read = await h.post('read', { sessionId: 's1', acknowledgeInterrupt: true })
  assert.deepEqual(read.value.unread, [], 'reaching the tail drops the marker for good')
})

test('sessions restored before the plugin mounted are scanned once', async () => {
  const h = await harness({ agents: { list: () => [{ session: crashTailSession('s0', T(3)) }] } })
  const body = await h.post('list')
  assert.deepEqual(body.value.unread, [{ sessionId: 's0', at: T(3), kind: 'interrupted' }])
})

test('a restored Session that finished normally is not a reminder', async () => {
  const h = await harness()
  h.emit('session/created', finishedSession('s1'))
  const body = await h.post('list')
  assert.deepEqual(body.value.unread, [], 'restoring a finished Session must not re-arm unread')
})

test('a live turn end after the scan resolves the restored orphan', async () => {
  const h = await harness()
  h.emit('session/created', crashTailSession('s1'))
  assert.equal((await h.post('list')).value.unread.length, 1)
  h.emit('session/event', { id: 's1' }, { type: 'turn/end', time: T(9), data: { turn: 2, reason: { kind: 'completed' } } })
  const body = await h.post('list')
  assert.deepEqual(
    body.value.unread,
    [{ sessionId: 's1', at: T(9), kind: 'completed' }],
    'the resumed turn supersedes the orphan',
  )
})

test('malformed sessions and event snapshots never throw', async () => {
  const h = await harness({ agents: { list: () => [{}, { session: null }, { session: { id: 's9' } }] } })
  h.emit('session/created', { id: 's2' })
  h.emit('session/created', { id: 's3', snapshotEvents: () => null })
  h.emit('session/created', { id: 's4', snapshotEvents: () => [{ type: 'turn/end', data: 7 }] })
  h.emit('session/created', null)
  const body = await h.post('list')
  assert.deepEqual(body.value.unread, [])
})
