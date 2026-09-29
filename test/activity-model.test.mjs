import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACTIVITY_ROW_LIMIT, buildActivityGroups, countUnread, dayBucket, pathBasename,
} from '../.test-build/activity-model.js'

// 2026-09-23 10:00 local — a Wednesday, so the weekday buckets are unambiguous.
const NOW = new Date(2026, 8, 23, 10, 0, 0).getTime()
const at = (year, month, day) => new Date(year, month - 1, day, 9, 0, 0).getTime()

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

test('dayBucket resolves today, yesterday, weekday names, and absolute dates', () => {
  assert.deepEqual(dayBucket(NOW, NOW), { key: 'today', kind: 'today' })
  assert.deepEqual(dayBucket(NOW, at(2026, 9, 22)), { key: 'yesterday', kind: 'yesterday' })
  assert.deepEqual(dayBucket(NOW, at(2026, 9, 21)), { key: 'weekday:1', kind: 'weekday', weekday: 1 })
  assert.deepEqual(dayBucket(NOW, at(2026, 9, 17)), { key: 'weekday:4', kind: 'weekday', weekday: 4 })
  assert.deepEqual(dayBucket(NOW, at(2026, 9, 16)), {
    key: 'date:2026-09-16', kind: 'date', year: 2026, month: 9, day: 16,
  })
})

test('buildActivityGroups hides rows the browsing region hides', () => {
  const rows = [
    session('keep'),
    session('blank', { blank: true }),
    session('sub', { origin: 'subagent' }),
    session('archived'),
  ]
  const groups = buildActivityGroups(
    inputs(rows, { workspaces: { items: [], archivedSessionIds: ['archived'] } }),
    NOW,
  )
  assert.deepEqual(groups.flatMap(group => group.rows.map(row => row.id)), ['keep'])
})

test('buildActivityGroups orders newest first and groups by day, newest day first', () => {
  const rows = [
    session('older', { updatedAt: at(2026, 9, 21) }),
    session('newest', { updatedAt: NOW }),
    session('middle', { updatedAt: at(2026, 9, 22) }),
    session('oldest', { updatedAt: at(2026, 9, 10) }),
  ]
  const groups = buildActivityGroups(inputs(rows), NOW)
  assert.deepEqual(groups.map(group => group.key), ['today', 'yesterday', 'weekday:1', 'date:2026-09-10'])
  assert.deepEqual(groups[0].rows.map(row => row.id), ['newest'])
  assert.deepEqual(groups[2].rows.map(row => row.id), ['older'])
})

test('buildActivityGroups breaks update-time ties deterministically', () => {
  const groups = buildActivityGroups(inputs([session('b'), session('a')]), NOW)
  assert.deepEqual(groups[0].rows.map(row => row.id), ['a', 'b'])
})

test('buildActivityGroups labels folders from the workspace, then the cwd', () => {
  const rows = [
    session('owned', { cwd: '/host/other' }),
    session('loose', { cwd: '/host/projects/zone-meter' }),
    session('bare'),
  ]
  const groups = buildActivityGroups(inputs(rows, {
    workspaces: {
      items: [{ workspaceId: 'w1', title: 'iot-platform', path: '/host/iot-platform', sessionIds: ['owned'] }],
      archivedSessionIds: [],
    },
  }), NOW)
  const folders = Object.fromEntries(
    groups.flatMap(group => group.rows.map(row => [row.id, row.folder])),
  )
  assert.deepEqual(folders, { owned: 'iot-platform', loose: 'zone-meter', bare: '' })
})

test('buildActivityGroups carries status facts onto rows', () => {
  const rows = [session('done'), session('busy'), session('asking')]
  const statuses = new Map([
    ['done', { running: false, completionUnread: true }],
    ['busy', { running: true, completionUnread: false }],
    ['asking', { running: false, completionUnread: false, pendingInteraction: { kind: 'approval' } }],
  ])
  const groups = buildActivityGroups(inputs(rows, { statuses }), NOW)
  const byId = Object.fromEntries(groups.flatMap(group => group.rows.map(row => [row.id, row])))
  assert.equal(byId.done.unread, true)
  assert.equal(byId.busy.running, true)
  assert.equal(byId.asking.pending, 'approval')
  assert.equal(byId.done.pending, undefined)
})

test('buildActivityGroups reports pin membership without changing the reminder', () => {
  const rows = [session('pinned'), session('fresh')]
  const statuses = new Map(rows.map(row => [row.id, { running: false, completionUnread: true }]))
  const source = inputs(rows, {
    statuses,
    workspaces: { items: [], archivedSessionIds: [], pinnedSessionIds: ['pinned'] },
  })
  const byId = Object.fromEntries(
    buildActivityGroups(source, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(byId.pinned.pinned, true)
  assert.equal(byId.pinned.unread, true, 'a pin does not read the session')
  assert.equal(byId.fresh.pinned, false)
  assert.equal(byId.fresh.unread, true)
  assert.equal(countUnread(source), 2)
})

test('a completion the surface watched itself also reads as unread', () => {
  const rows = [session('watched'), session('quiet')]
  const source = {
    ...inputs(rows),
    completedSince: new Set(['watched']),
  }
  const byId = Object.fromEntries(
    buildActivityGroups(source, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(byId.watched.unread, true, 'the framework cleared it because the Session was on screen')
  assert.equal(byId.quiet.unread, false)
  assert.equal(countUnread(source), 1)
})

test('the open Session is flagged so the row can show the selected fill', () => {
  const rows = [
    session('open', { retainedBy: { mainView: 1 } }),
    session('other', { retainedBy: { mainView: 0 } }),
  ]
  const byId = Object.fromEntries(
    buildActivityGroups(inputs(rows), NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(byId.open.current, true)
  assert.equal(byId.other.current, false)
})

test('buildActivityGroups caps rendered rows while the badge still counts them all', () => {
  const rows = Array.from({ length: ACTIVITY_ROW_LIMIT + 25 }, (_, index) => session(`s${index}`))
  const statuses = new Map(rows.map(row => [row.id, { running: false, completionUnread: true }]))
  const source = inputs(rows, { statuses })
  const rendered = buildActivityGroups(source, NOW).flatMap(group => group.rows)
  assert.equal(rendered.length, ACTIVITY_ROW_LIMIT)
  assert.equal(countUnread(source), ACTIVITY_ROW_LIMIT + 25)
})

test('countUnread ignores rows the list cannot show', () => {
  const rows = [session('a'), session('blank', { blank: true }), session('archived')]
  const statuses = new Map(rows.map(row => [row.id, { running: false, completionUnread: true }]))
  assert.equal(countUnread(inputs(rows, {
    statuses,
    workspaces: { items: [], archivedSessionIds: ['archived'] },
  })), 1)
})

test('pathBasename handles posix and windows separators', () => {
  assert.equal(pathBasename('/host/projects/zone-meter'), 'zone-meter')
  assert.equal(pathBasename('C:\\work\\iot-platform\\'), 'iot-platform')
  assert.equal(pathBasename('/'), undefined)
  assert.equal(pathBasename(undefined), undefined)
})

test('a Session marked unread by hand counts as unread, running or not', () => {
  const rows = [
    session('marked'),
    session('quiet'),
    session('busy', { running: true }),
    session('archived'),
  ]
  const source = {
    ...inputs(rows, { workspaces: { items: [], archivedSessionIds: ['archived'] } }),
    manualUnread: new Set(['marked', 'busy', 'archived']),
  }
  const byId = Object.fromEntries(
    buildActivityGroups(source, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(byId.marked.unread, true, 'the manual mark is a reminder')
  assert.equal(byId.marked.manual, true, 'the row can say why it is unread')
  assert.equal(byId.quiet.unread, false)
  assert.equal(byId.quiet.manual, false)
  assert.equal(byId.busy.unread, true, 'an explicit mark holds while the Session runs')
  assert.equal(byId.archived, undefined, 'a hidden row stays hidden')
  assert.equal(countUnread(source), 2, 'only the hidden row stays out of the badge')
})

test('the host ledger is its own unread source', () => {
  const rows = [session('remembered'), session('quiet')]
  const source = { ...inputs(rows), ledgerUnread: new Set(['remembered']) }
  const byId = Object.fromEntries(
    buildActivityGroups(source, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(byId.remembered.unread, true, 'a ledger reminder survives the reload')
  assert.equal(byId.quiet.unread, false)
  assert.equal(countUnread(source), 1)
})

test('the conversation at its tail reads as read until the operator scrolls away', () => {
  const rows = [session('open', { retainedBy: { mainView: 1 } }), session('other')]
  const statuses = new Map([['open', { running: false, completionUnread: true }]])
  const source = {
    ...inputs(rows, { statuses }),
    ledgerUnread: new Set(['open', 'other']),
    completedSince: new Set(['open']),
    viewingTail: 'open',
  }
  const byId = Object.fromEntries(
    buildActivityGroups(source, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(byId.open.unread, false, 'the operator is looking at the newest content')
  assert.equal(byId.other.unread, true, 'another Session is untouched')
  assert.equal(countUnread(source), 1)
})

test('an explicit mark survives reading the tail, and a foreign tail id suppresses nothing', () => {
  const rows = [session('open', { retainedBy: { mainView: 1 } }), session('foreign')]
  const manual = Object.fromEntries(
    buildActivityGroups({
      ...inputs(rows), manualUnread: new Set(['open']), viewingTail: 'open',
    }, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(manual.open.unread, true, 'the explicit mark is not a read')

  const foreign = Object.fromEntries(
    buildActivityGroups({
      ...inputs(rows), ledgerUnread: new Set(['foreign']), viewingTail: 'foreign',
    }, NOW).flatMap(group => group.rows.map(row => [row.id, row])),
  )
  assert.equal(foreign.foreign.unread, true, 'only the open conversation can be read by tail')
})
