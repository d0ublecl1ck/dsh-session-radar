import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
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

async function harness({ agents, legacy, state } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'session-radar-host-'))
  if (legacy !== undefined) {
    await writeFile(join(dir, 'unread-helper.json'), JSON.stringify(legacy), 'utf8')
  }
  if (state !== undefined) {
    await writeFile(join(dir, 'session-radar.json'), JSON.stringify(state), 'utf8')
  }
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
    const route = routes.get('/session-radar')
    assert.ok(route, 'the host half must register its route')
    const req = new EventEmitter()
    req.method = 'POST'
    req.url = '/session-radar/' + endpoint
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
  assert.deepEqual(body.value.unread, [{ sessionId: 's1', at: T(5), kind: 'interrupted', interrupted: true }])
})

test('the snapshot carries the instant this process started', async () => {
  const before = Date.now()
  const h = await harness()
  const body = await h.post('list')
  assert.equal(typeof body.value.bootAt, 'number', 'the browser half needs one boot identity to settle on')
  assert.ok(body.value.bootAt <= Date.now(), 'a boot instant is never in the future')
  assert.ok(body.value.bootAt >= before - 60_000, 'and it is this process, not an older one')
  assert.equal(body.value.bootAt, (await h.post('list')).value.bootAt, 'the same boot keeps its identity across reads')
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
  assert.deepEqual(body.value.unread, [{ sessionId: 's0', at: T(3), kind: 'interrupted', interrupted: true }])
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
    [{ sessionId: 's1', at: T(9), kind: 'completed', interrupted: false }],
    'the resumed turn supersedes the orphan',
  )
})

test('a ledger written before the rename is carried over exactly once', async () => {
  const migrated = {
    version: 1,
    sessions: {
      s1: {
        lastTurnEndAt: T(7),
        lastTurnEndKind: 'completed',
        interruptedAt: null,
        lastAttentionAt: null,
        lastAttentionKind: null,
        lastReadAt: null,
      },
    },
  }
  const h = await harness({ legacy: migrated })
  const body = await h.post('list')
  assert.deepEqual(
    body.value.unread,
    [{ sessionId: 's1', at: T(7), kind: 'completed', interrupted: false }],
    'the pre-rename ledger still decides what is unread',
  )
  assert.ok(
    h.warnings.some((message) => message.includes('carried the ledger over')),
    'the carry-over is announced instead of happening silently',
  )
  const written = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(written.version, 3, 'the carried ledger is written back in the current shape')
  assert.equal(written.sessions.s1.lastTurnEndAt, T(7), 'the carried fact is preserved')
  assert.equal(written.sessions.s1.lastTurnEndKind, 'completed')
  assert.equal(written.sessions.s1.runningSince, null, 'a ledger without the field carries no open turn')
  const untouched = JSON.parse(await readFile(join(h.dir, 'unread-helper.json'), 'utf8'))
  assert.deepEqual(untouched, migrated, 'the legacy file is left in place, not deleted')
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

/** One persisted row, in the shape a previous process would have left behind. */
function entry(overrides = {}) {
  return {
    lastTurnEndAt: null,
    lastTurnEndKind: null,
    interruptedAt: null,
    lastAttentionAt: null,
    lastAttentionKind: null,
    lastReadAt: null,
    runningSince: null,
    ...overrides,
  }
}

test('a turn the previous process left open is a reminder on the next start', async () => {
  const h = await harness({
    state: {
      version: 2,
      sessions: { s1: entry({ lastTurnEndAt: T(2), lastTurnEndKind: 'completed', lastReadAt: T(3), runningSince: T(4) }) },
    },
  })
  const body = await h.post('list')
  assert.deepEqual(
    body.value.unread,
    [{ sessionId: 's1', at: T(4), kind: 'interrupted', interrupted: true }],
    'the run that never finished survives the restart as a reminder',
  )
  const written = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(written.sessions.s1.runningSince, null, 'the spent marker is written back')
  assert.equal(written.sessions.s1.interruptedAt, T(4))
})

test('a turn opened in this process is not mistaken for a restart orphan', async () => {
  const h = await harness()
  h.emit('session/event', { id: 's1' }, { type: 'turn/start', time: T(1), data: { turn: 1 } })
  assert.deepEqual((await h.post('list')).value.unread, [], 'a running turn is not a reminder')
  await new Promise((resolve) => setTimeout(resolve, 400))
  const running = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(running.sessions.s1.runningSince, T(1), 'the open turn is persisted')
  h.emit('session/event', { id: 's1' }, { type: 'turn/end', time: T(2), data: { turn: 1, reason: { kind: 'completed' } } })
  await new Promise((resolve) => setTimeout(resolve, 400))
  const closed = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(closed.sessions.s1.runningSince, null, 'the boundary closes the open turn')
  assert.deepEqual(
    (await h.post('list')).value.unread,
    [{ sessionId: 's1', at: T(2), kind: 'completed', interrupted: false }],
    'and the finished turn is the reminder',
  )
})

test('a turn still running at mount is not a restart orphan', async () => {
  const h = await harness({
    state: { version: 2, sessions: { s1: entry({ runningSince: Date.now() }) } },
  })
  const body = await h.post('list')
  assert.deepEqual(body.value.unread, [], 'a marker from this process means the mount only re-read the file')
})

test('a parent starting a new turn spends the reminders of the subagents it left behind', async () => {
  const h = await harness({
    state: {
      version: 3,
      sessions: {
        kid: entry({ interruptedAt: T(3), parentId: 'p' }),
        other: entry({ interruptedAt: T(3), parentId: 'q' }),
      },
    },
  })
  assert.deepEqual(
    (await h.post('list')).value.unread.map((row) => row.sessionId),
    ['kid', 'other'],
    'both cut-off subagents are reminders to start with',
  )
  h.emit('session/event', { id: 'p', header: { origin: 'user' } }, { type: 'turn/start', time: T(9), data: { turn: 2 } })
  assert.deepEqual(
    (await h.post('list')).value.unread.map((row) => row.sessionId),
    ['other'],
    'the parent that ran again has taken its own subagents over',
  )
  await new Promise((resolve) => setTimeout(resolve, 400))
  const written = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(written.sessions.kid.interruptedAt, null, 'the spent marker is written back')
  assert.equal(written.sessions.other.interruptedAt, T(3), 'and another parent\u2019s child is left armed')
})

test('a live turn records the parent the host read off the session header', async () => {
  const h = await harness()
  h.emit(
    'session/event',
    { id: 'kid', header: { origin: 'subagent', parentSession: 'p' } },
    { type: 'turn/start', time: T(1), data: { turn: 1 } },
  )
  await new Promise((resolve) => setTimeout(resolve, 400))
  const written = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(written.sessions.kid.parentId, 'p', 'the header is the only place the link exists')
})

test('one read spends every Session a folded row stands in for', async () => {
  const h = await harness({
    state: {
      version: 3,
      sessions: {
        kid: entry({ interruptedAt: T(3), parentId: 'p' }),
        kid2: entry({ interruptedAt: T(4), parentId: 'p' }),
      },
    },
  })
  assert.equal((await h.post('list')).value.unread.length, 2)
  const spent = await h.post('read', { sessionId: 'p', acknowledgeInterrupt: true, also: ['kid', 'kid2'] })
  assert.deepEqual(spent.value.unread, [], 'the row\u2019s acknowledgement reaches the subagents that armed it')
  await new Promise((resolve) => setTimeout(resolve, 400))
  const written = JSON.parse(await readFile(join(h.dir, 'session-radar.json'), 'utf8'))
  assert.equal(written.sessions.kid.interruptedAt, null)
  assert.equal(written.sessions.kid2.interruptedAt, null)
})
