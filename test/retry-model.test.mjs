/**
 * Unit lane for the restart-retry dialog's pure half: which interrupted
 * Sessions the dialog offers, what starts checked, and the serial send plan.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRetryCandidates,
  candidateSources,
  defaultSelection,
  retrySelected,
  selectedIds,
  toggleAll,
  toggleOne,
} from '../.test-build/client/retry-model.js'

const T = (n) => 1_700_000_000_000 + n

function inputs(overrides = {}) {
  return {
    reminders: [
      { sessionId: 'a', at: T(3), interrupted: true },
      { sessionId: 'b', at: T(2), interrupted: true },
      { sessionId: 'c', at: T(1), interrupted: false },
    ],
    sessions: {
      ids: ['a', 'b', 'c'],
      byId: {
        a: { id: 'a', displayTitle: '给报表补口径', cwd: '/host/zone-meter', running: false, updatedAt: T(3) },
        b: { id: 'b', displayTitle: '修爬虫', cwd: '/host/crawler', running: true, updatedAt: T(2) },
        c: { id: 'c', displayTitle: '已完成', cwd: '/host/other', running: false, updatedAt: T(1) },
      },
    },
    workspaces: { items: [{ workspaceId: 'w1', title: 'zone-meter', path: '/host/zone-meter', sessionIds: ['a'] }] },
    ...overrides,
  }
}

test('only interrupted reminders the Session list still shows become candidates', () => {
  const rows = buildRetryCandidates(inputs())
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b'], 'the finished reminder is not a retry')
  assert.deepEqual(
    rows.map((row) => row.title),
    ['给报表补口径', '修爬虫'],
  )
  assert.equal(rows[0].folder, 'zone-meter', 'the owning Workspace names the folder when it has one')
  assert.equal(rows[1].folder, 'crawler', 'otherwise the working directory does')
  assert.deepEqual(rows.map((row) => row.running), [false, true], 'a Session that is already running is still listed')
  assert.deepEqual(rows.map((row) => row.at), [T(3), T(2)])
})

test('a subagent reminder that is still running is offered as its top-level Session', () => {
  const rows = buildRetryCandidates(inputs({
    reminders: [
      { sessionId: 'kid', at: T(5), interrupted: false },
      { sessionId: 'a', at: T(3), interrupted: false },
    ],
    sessions: {
      ids: ['a', 'kid'],
      byId: {
        a: { id: 'a', displayTitle: '外部任务', cwd: '/host/a', running: false, updatedAt: T(3) },
        kid: {
          id: 'kid', displayTitle: '你是实现子代理', cwd: '/host/a', running: true,
          updatedAt: T(5), origin: 'subagent', parentId: 'a',
        },
      },
    },
  }))
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a'],
    'the host refuses a prompt for a subagent Session, so its parent is the one to wake',
  )
  assert.equal(rows[0].at, T(5), 'the row is dated by the reason it was offered')
})

test('an interrupted subagent is offered as its top-level Session even after its own reminder was read', () => {
  const rows = buildRetryCandidates(inputs({
    reminders: [],
    sessions: {
      ids: ['a', 'kid'],
      byId: {
        a: { id: 'a', displayTitle: '外部任务', cwd: '/host/a', running: false, updatedAt: T(3) },
        kid: {
          id: 'kid', displayTitle: '你是实现子代理', cwd: '/host/a', running: true,
          updatedAt: T(5), parentId: 'a',
        },
      },
    },
  }))
  assert.deepEqual(rows.map((row) => row.id), ['a'], 'a child still running keeps its parent on the list')
  assert.equal(rows[0].running, false, 'the parent is idle, so it stays retryable')
})

test('several unfinished subagents of one parent collapse into a single row, dated by the newest', () => {
  const rows = buildRetryCandidates(inputs({
    reminders: [
      { sessionId: 'kid2', at: T(7), interrupted: true },
      { sessionId: 'kid1', at: T(4), interrupted: true },
    ],
    sessions: {
      ids: ['a', 'kid1', 'kid2'],
      byId: {
        a: { id: 'a', displayTitle: '外部任务', cwd: '/host/a', running: false, updatedAt: T(3) },
        kid1: { id: 'kid1', displayTitle: '子代理一', cwd: '/host/a', running: false, updatedAt: T(4), origin: 'subagent', parentId: 'a' },
        kid2: { id: 'kid2', displayTitle: '子代理二', cwd: '/host/a', running: false, updatedAt: T(7), origin: 'subagent', parentId: 'a' },
      },
    },
  }))
  assert.deepEqual(rows.map((row) => row.id), ['a'])
  assert.equal(rows[0].at, T(7), 'one row per parent, dated by its newest unfinished child')
})

test('a subagent whose parent is gone is not offered at all', () => {
  // The host answers a subagent prompt with `session/not-found`, so offering the
  // subagent itself would be a row whose button can never work.
  const rows = buildRetryCandidates(inputs({
    reminders: [{ sessionId: 'deep', at: T(2), interrupted: true }],
    sessions: {
      ids: ['a', 'deep'],
      byId: {
        a: { id: 'a', displayTitle: '外部任务', cwd: '/host/a', running: false, updatedAt: T(3) },
        deep: {
          id: 'deep', displayTitle: '更深一层', cwd: '/host/a', running: false, updatedAt: T(2),
          origin: 'subagent', parentId: 'missing',
        },
      },
    },
  }))
  assert.deepEqual(rows, [], 'nothing addressable means nothing to offer')
})

test('a reminder whose Session left the list is not offered', () => {
  const rows = buildRetryCandidates(inputs({
    reminders: [{ sessionId: 'gone', at: T(9), interrupted: true }],
  }))
  assert.deepEqual(rows, [], 'nothing to address means nothing to send')
})

test('every candidate that is not already running starts checked', () => {
  const rows = buildRetryCandidates(inputs())
  assert.deepEqual([...defaultSelection(rows)], ['a'])
  assert.deepEqual(selectedIds(rows, defaultSelection(rows)), ['a'])
})

test('the selection follows the list order and never names a running Session', () => {
  const rows = buildRetryCandidates(inputs())
  const all = toggleAll(rows, new Set())
  assert.deepEqual(selectedIds(rows, all), ['a'], 'running rows are never selectable')
  const none = toggleAll(rows, all)
  assert.deepEqual(selectedIds(rows, none), [])
  const picked = toggleOne(toggleOne(none, 'a'), 'b')
  assert.deepEqual(selectedIds(rows, picked), ['a'], 'a running Session cannot be picked either')
})

test('an id no row carries never reaches the send plan', () => {
  const rows = buildRetryCandidates(inputs())
  const withGhost = toggleOne(defaultSelection(rows), 'ghost')
  assert.deepEqual(selectedIds(rows, withGhost), ['a'], 'only ids the dialog actually lists are sent')
})

test('the retry sends one prompt at a time and acknowledges only the accepted ones', async () => {
  const order = []
  const acknowledged = []
  const outcome = await retrySelected({
    ids: ['a', 'b'],
    send: async (id) => {
      order.push('send:' + id)
      if (id === 'b') return { ok: false, message: '没人在跑了' }
      return { ok: true }
    },
    acknowledge: (id) => {
      order.push('ack:' + id)
      acknowledged.push(id)
    },
  })
  assert.deepEqual(order, ['send:a', 'ack:a', 'send:b'], 'each prompt settles before the next is sent')
  assert.deepEqual(acknowledged, ['a'], 'a refused prompt keeps its reminder')
  assert.deepEqual(outcome.sent, ['a'])
  assert.deepEqual(outcome.failed, [{ id: 'b', message: '没人在跑了' }])
})

test('a folded row carries the subagents it stands in for', () => {
  const rows = buildRetryCandidates(inputs({
    reminders: [
      { sessionId: 'kid2', at: T(7), interrupted: true },
      { sessionId: 'kid1', at: T(4), interrupted: true },
      { sessionId: 'a', at: T(3), interrupted: true },
    ],
    sessions: {
      ids: ['a', 'kid1', 'kid2'],
      byId: {
        a: { id: 'a', displayTitle: '外部任务', cwd: '/host/a', running: false, updatedAt: T(3) },
        kid1: { id: 'kid1', displayTitle: '子代理一', cwd: '/host/a', running: false, updatedAt: T(4), origin: 'subagent', parentId: 'a' },
        kid2: { id: 'kid2', displayTitle: '子代理二', cwd: '/host/a', running: false, updatedAt: T(7), origin: 'subagent', parentId: 'a' },
      },
    },
  }))
  assert.deepEqual(rows.map((row) => row.id), ['a'])
  assert.deepEqual(rows[0].sources, ['kid2', 'kid1'], 'the parent stands in for both subagents, newest first')
  assert.equal(rows[0].at, T(7), 'and the row is dated by the newest of them')
  assert.deepEqual(candidateSources(rows, 'a'), ['kid2', 'kid1'], 'the send plan can ask what a row stands for')
})

test('a row carrying its own reminder stands in for nothing', () => {
  const rows = buildRetryCandidates(inputs())
  assert.deepEqual(rows.map((row) => row.sources), [[], []], 'its own reminder is not a source')
  assert.deepEqual(candidateSources(rows, 'a'), [])
  assert.deepEqual(candidateSources(rows, 'ghost'), [], 'an id no row carries has nothing to spend')
})

test('a row armed by its own reminder and by a subagent spends both', () => {
  const rows = buildRetryCandidates(inputs({
    reminders: [
      { sessionId: 'a', at: T(3), interrupted: true },
      { sessionId: 'kid', at: T(5), interrupted: true },
    ],
    sessions: {
      ids: ['a', 'kid'],
      byId: {
        a: { id: 'a', displayTitle: '外部任务', cwd: '/host/a', running: false, updatedAt: T(3) },
        kid: { id: 'kid', displayTitle: '子代理', cwd: '/host/a', running: false, updatedAt: T(5), origin: 'subagent', parentId: 'a' },
      },
    },
  }))
  assert.deepEqual(rows.map((row) => row.id), ['a'])
  assert.equal(rows[0].at, T(5), 'the newest reason dates the row')
  assert.deepEqual(rows[0].sources, ['kid'], 'the row itself is never one of its own sources')
})
