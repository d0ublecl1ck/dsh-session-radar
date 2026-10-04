/**
 * Pure-lane test: the overview projection behind the waiting window. It reuses
 * the activity list's visibility and unread rules and only splits the rows it
 * already produced into the two zones the window renders.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTIVITY_ROW_LIMIT } from '../.test-build/activity-model.js'
import { OVERVIEW_LIMIT, buildOverview } from '../.test-build/overview.js'

// 2026-09-23 10:00 local.
const NOW = new Date(2026, 8, 23, 10, 0, 0).getTime()
const minutesAgo = minutes => NOW - minutes * 60_000

function session(id, overrides = {}) {
  return {
    id,
    displayTitle: id,
    blank: false,
    running: false,
    updatedAt: NOW,
    ...overrides,
  }
}

function inputs(rows, { statuses = new Map(), workspaces } = {}) {
  return {
    sessions: {
      ids: rows.map(row => row.id),
      byId: Object.fromEntries(rows.map(row => [row.id, row])),
    },
    statuses,
    workspaces: workspaces ?? { items: [], archivedSessionIds: [] },
  }
}

test('the overview splits waiting asks from unread completions', () => {
  const rows = [
    session('ask', { updatedAt: minutesAgo(2) }),
    session('done', { updatedAt: minutesAgo(5) }),
    session('quiet', { updatedAt: minutesAgo(9) }),
  ]
  const statuses = new Map([
    ['ask', { running: false, completionUnread: false, pendingInteraction: { kind: 'approval' } }],
    ['done', { running: false, completionUnread: true }],
  ])
  const overview = buildOverview(inputs(rows, { statuses }), NOW)
  assert.deepEqual(overview.ask.map(card => card.id), ['ask'])
  assert.deepEqual(overview.unread.map(card => card.id), ['done'])
  assert.equal(overview.ask[0].pending, 'approval')
  assert.equal(overview.unread[0].unread, true)
})

test('a Session that both waits and is unread appears only in the ask zone', () => {
  const rows = [session('both'), session('only-unread', { updatedAt: minutesAgo(30) })]
  const statuses = new Map([
    ['both', {
      running: false, completionUnread: true, pendingInteraction: { kind: 'question' },
    }],
    ['only-unread', { running: false, completionUnread: true }],
  ])
  const overview = buildOverview(inputs(rows, { statuses }), NOW)
  assert.deepEqual(overview.ask.map(card => card.id), ['both'])
  assert.deepEqual(overview.unread.map(card => card.id), ['only-unread'])
})

test('each zone keeps the activity order: newest update first', () => {
  const rows = [
    session('ask-old', { updatedAt: minutesAgo(40) }),
    session('unread-old', { updatedAt: minutesAgo(30) }),
    session('ask-new', { updatedAt: minutesAgo(1) }),
    session('unread-new', { updatedAt: minutesAgo(3) }),
  ]
  const statuses = new Map([
    ['ask-old', { running: false, completionUnread: false, pendingInteraction: { kind: 'approval' } }],
    ['ask-new', { running: false, completionUnread: false, pendingInteraction: { kind: 'plan-review' } }],
    ['unread-old', { running: false, completionUnread: true }],
    ['unread-new', { running: false, completionUnread: true }],
  ])
  const overview = buildOverview(inputs(rows, { statuses }), NOW)
  assert.deepEqual(overview.ask.map(card => card.id), ['ask-new', 'ask-old'])
  assert.deepEqual(overview.unread.map(card => card.id), ['unread-new', 'unread-old'])
})

test('each card carries the title, the folder label, and the open Session mark', () => {
  const rows = [
    session('owned', { displayTitle: '归档口径核对', cwd: '/host/other', updatedAt: minutesAgo(1) }),
    session('loose', { displayTitle: '无工作区会话', cwd: '/host/projects/zone-meter' }),
    session('open', { displayTitle: '当前对话', updatedAt: minutesAgo(4), retainedBy: { mainView: 1 } }),
  ]
  const statuses = new Map([
    ['owned', { running: false, completionUnread: false, pendingInteraction: { kind: 'approval' } }],
    ['loose', { running: false, completionUnread: true }],
    ['open', { running: false, completionUnread: true }],
  ])
  const workspaces = {
    items: [{ workspaceId: 'w1', title: 'session-radar', path: '/host/radar', sessionIds: ['owned'] }],
    archivedSessionIds: [],
  }
  const overview = buildOverview(inputs(rows, { statuses, workspaces }), NOW)
  assert.deepEqual(
    overview.ask.map(card => [card.title, card.folder, card.current]),
    [['归档口径核对', 'session-radar', false]],
  )
  // A Session with no Workspace label falls back to its working-directory
  // basename, and the conversation the operator already has open is marked so
  // the window can say which card they are standing on.
  assert.deepEqual(
    overview.unread.map(card => [card.title, card.folder, card.current]),
    [['无工作区会话', 'zone-meter', false], ['当前对话', '', true]],
  )
})

test('the overview hides the rows the browsing region hides', () => {
  const rows = [
    session('keep'),
    session('blank', { blank: true }),
    session('sub', { origin: 'subagent' }),
    session('archived'),
  ]
  const statuses = new Map([
    ['keep', { running: false, completionUnread: true }],
    ['blank', { running: false, completionUnread: true }],
    ['sub', { running: false, completionUnread: true }],
    ['archived', { running: false, completionUnread: true }],
  ])
  const overview = buildOverview(
    inputs(rows, { statuses, workspaces: { items: [], archivedSessionIds: ['archived'] } }),
    NOW,
  )
  assert.deepEqual(overview.unread.map(card => card.id), ['keep'])
})

test('an activity with nothing waiting yields two empty zones', () => {
  const overview = buildOverview(inputs([session('quiet')], {
    statuses: new Map([['quiet', { running: false, completionUnread: false }]]),
  }), NOW)
  assert.deepEqual(overview, { ask: [], unread: [] })
})

test('the row limit is the activity list limit', () => {
  assert.equal(OVERVIEW_LIMIT, ACTIVITY_ROW_LIMIT)
  const rows = []
  const statuses = new Map()
  for (let index = 0; index < ACTIVITY_ROW_LIMIT + 5; index += 1) {
    const id = 'session-' + String(index)
    rows.push(session(id, { updatedAt: minutesAgo(index) }))
    statuses.set(id, { running: false, completionUnread: true })
  }
  const overview = buildOverview(inputs(rows, { statuses }), NOW)
  assert.equal(overview.unread.length, ACTIVITY_ROW_LIMIT, 'the cap keeps the newest rows')
  assert.equal(overview.unread[0].id, 'session-0')
})
