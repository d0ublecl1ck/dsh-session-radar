// Unit tests for the merged status counter and the preference vocabulary.
// Imported from .test-build/ (compiled by scripts/build-tests.mjs) so the
// tests beat on the same pure modules the browser bundle inlines.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_THRESHOLD,
  countSessions,
  countUnarchived,
  normalizeThreshold,
  shouldWarn,
} from '../.test-build/count.js'
import {
  DEFAULT_VARIANT,
  normalizeVariant,
  normalizeVisibility,
  visibleMetrics,
} from '../.test-build/config.js'

/** Build a Session list snapshot from [id, row] pairs. */
function list(...rows) {
  const ids = []
  const byId = {}
  for (const [id, row] of rows) {
    ids.push(id)
    byId[id] = row
  }
  return { ids, byId }
}

/** Build a status map from [id, status] pairs. */
function statuses(...rows) {
  return new Map(rows)
}

test('countUnarchived still counts every ordinary Session when nothing is archived', () => {
  const sessions = list(['a', {}], ['b', { title: 'x' }])
  assert.equal(countUnarchived(sessions, []), 2)
})

test('countUnarchived excludes archived, subagent, and blank rows', () => {
  const sessions = list(
    ['main', {}],
    ['child', { parentId: 'main' }],
    ['origin', { origin: 'subagent' }],
    ['blank', { blank: true }],
    ['gone', {}],
  )
  assert.equal(countUnarchived(sessions, ['gone']), 1)
})

test('countUnarchived skips ids without a matching row instead of miscounting', () => {
  const sessions = { ids: ['known', 'ghost'], byId: { known: {} } }
  assert.equal(countUnarchived(sessions, []), 1)
})

test('countSessions splits the archive axis', () => {
  const sessions = list(['a', {}], ['b', {}], ['c', { blank: true }], ['d', { parentId: 'a' }])
  const counts = countSessions(sessions, ['b'])
  assert.equal(counts.unarchived, 1)
  assert.equal(counts.archived, 1)
})

test('countSessions partitions the unarchived rows by precedence', () => {
  const sessions = list(['run', {}], ['ask', {}], ['new', {}], ['idle', {}], ['idle2', {}])
  const counts = countSessions(
    sessions,
    [],
    statuses(
      ['run', { running: true, completionUnread: false }],
      // Waiting for an answer while the Agent is technically alive: pending wins.
      ['ask', { running: true, pendingInteraction: { kind: 'approval' } }],
      ['new', { running: false, completionUnread: true }],
      ['idle', { running: false, completionUnread: false }],
    ),
  )
  assert.deepEqual(counts, { running: 1, unread: 1, pending: 1, idle: 2, unarchived: 5, archived: 0 })
})

test('the four activity buckets always sum to the unarchived count', () => {
  const sessions = list(['a', {}], ['b', {}], ['c', {}], ['d', { blank: true }], ['e', {}])
  const counts = countSessions(
    sessions,
    ['b'],
    statuses(['a', { running: true }], ['c', { completionUnread: true }]),
  )
  assert.equal(counts.running + counts.unread + counts.pending + counts.idle, counts.unarchived)
})

test('a status stream that has not established running falls back to the list row', () => {
  const sessions = list(['a', { running: true }], ['b', { running: false }])
  const counts = countSessions(sessions, [], statuses(['a', {}], ['b', {}]))
  assert.equal(counts.running, 1)
  assert.equal(counts.idle, 1)
})

test('a missing status stream still counts running from the list rows', () => {
  const sessions = list(['a', { running: true }], ['b', {}])
  const counts = countSessions(sessions, [], undefined)
  assert.equal(counts.running, 1)
  assert.equal(counts.idle, 1)
})

test('subagent and blank rows never reach any bucket', () => {
  const sessions = list(['child', { parentId: 'x', running: true }], ['blank', { blank: true, running: true }])
  const counts = countSessions(sessions, [], statuses(['child', { running: true }], ['blank', { running: true }]))
  assert.deepEqual(counts, { running: 0, unread: 0, pending: 0, idle: 0, unarchived: 0, archived: 0 })
})

test('missing or malformed snapshots count as zero rather than throwing', () => {
  const zero = { running: 0, unread: 0, pending: 0, idle: 0, unarchived: 0, archived: 0 }
  assert.deepEqual(countSessions(undefined, undefined, undefined), zero)
  assert.deepEqual(countSessions(null, null, null), zero)
  assert.deepEqual(countSessions({ ids: undefined, byId: {} }, []), zero)
})

test('non-string archive ids and list ids compare as strings', () => {
  const sessions = list(['42', {}], ['43', {}])
  const counts = countSessions(sessions, [42])
  assert.equal(counts.archived, 1)
  assert.equal(counts.unarchived, 1)
})

test('normalizeThreshold keeps positive integers and rejects the rest', () => {
  assert.equal(normalizeThreshold(7), 7)
  assert.equal(normalizeThreshold('12'), 12)
  assert.equal(normalizeThreshold(3.9), 3)
  assert.equal(normalizeThreshold(0), DEFAULT_THRESHOLD)
  assert.equal(normalizeThreshold(-4), DEFAULT_THRESHOLD)
  assert.equal(normalizeThreshold('abc'), DEFAULT_THRESHOLD)
  assert.equal(normalizeThreshold(undefined), DEFAULT_THRESHOLD)
  assert.equal(normalizeThreshold(Number.NaN), DEFAULT_THRESHOLD)
})

test('the warning starts strictly above the threshold', () => {
  assert.equal(shouldWarn(10, 10), false)
  assert.equal(shouldWarn(11, 10), true)
  assert.equal(shouldWarn(0, 10), false)
  assert.equal(shouldWarn(11, 0), true)
  assert.equal(shouldWarn(10, 0), false)
})

test('the shipped default threshold is 10', () => {
  assert.equal(DEFAULT_THRESHOLD, 10)
})

test('visibility defaults every metric on and only explicit booleans count', () => {
  assert.deepEqual(normalizeVisibility(undefined), {
    running: true,
    unread: true,
    pending: true,
    idle: true,
    unarchived: true,
    archived: true,
  })
  const hidden = normalizeVisibility({ showIdle: false, showArchived: 'no' })
  assert.equal(hidden.idle, false)
  assert.equal(hidden.archived, true, 'a non-boolean keeps the default instead of guessing')
  assert.equal(hidden.running, true)
})

test('visibleMetrics preserves display order and drops hidden metrics', () => {
  const visibility = normalizeVisibility({ showRunning: false, showArchived: false })
  assert.deepEqual(visibleMetrics(visibility), ['unread', 'pending', 'idle', 'unarchived'])
})

test('normalizeVariant keeps the two known layouts and falls back for the rest', () => {
  assert.equal(normalizeVariant('meter'), 'meter')
  assert.equal(normalizeVariant('chips'), 'chips')
  assert.equal(normalizeVariant('grid'), DEFAULT_VARIANT, 'a retired layout falls back instead of rendering nothing')
  assert.equal(normalizeVariant('COMPACT'), DEFAULT_VARIANT)
  assert.equal(normalizeVariant(undefined), DEFAULT_VARIANT)
  assert.equal(DEFAULT_VARIANT, 'chips')
})
