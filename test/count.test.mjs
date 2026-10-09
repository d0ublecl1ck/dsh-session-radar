// Unit tests for the merged status counter and the preference vocabulary.
// Imported from .test-build/ (compiled by scripts/build-tests.mjs) so the
// tests beat on the same pure modules the browser bundle inlines.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_THRESHOLD,
  METRICS,
  classifySessions,
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

/**
 * Build a Session list snapshot that also carries each parent's direct-subagent
 * catalog, the way SessionListState carries projectionsBySession.
 */
function listWithSubagents(rows, catalogs) {
  return {
    ...list(...rows),
    projectionsBySession: Object.fromEntries(
      Object.entries(catalogs).map(([parentId, childIds]) => [
        parentId,
        { values: { subagentCatalog: childIds.map((id) => ({ id })) }, state: 'ready', error: null },
      ]),
    ),
  }
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

test('classifySessions lists each ordinary Session under the metric that owns it', () => {
  const sessions = list(
    ['run', { updatedAt: 5 }],
    ['ask', { updatedAt: 4 }],
    ['unread', { updatedAt: 3 }],
    ['idle', { updatedAt: 2 }],
    ['arch', { updatedAt: 1 }],
    ['child', { updatedAt: 9, parentId: 'run' }],
    ['origin', { updatedAt: 9, origin: 'subagent' }],
    ['blank', { updatedAt: 9, blank: true }],
    ['ghost', undefined],
  )
  const buckets = classifySessions(
    sessions,
    ['arch'],
    statuses(
      ['run', { running: true }],
      ['ask', { pendingInteraction: { kind: 'question' } }],
      ['unread', { running: false, completionUnread: true }],
      ['idle', { running: false, completionUnread: false }],
    ),
  )
  assert.deepEqual(buckets.running, ['run'])
  assert.deepEqual(buckets.pending, ['ask'])
  assert.deepEqual(buckets.unread, ['unread'])
  assert.deepEqual(buckets.idle, ['idle'])
  assert.deepEqual(buckets.unarchived, ['run', 'ask', 'unread', 'idle'])
  assert.deepEqual(buckets.archived, ['arch'])
})

test('classifySessions leads with the newest update and keeps undated rows last', () => {
  const sessions = list(
    ['older', { updatedAt: 10 }],
    ['undated', {}],
    ['newer', { updatedAt: 30 }],
    ['ghost', undefined],
  )
  assert.deepEqual(classifySessions(sessions, [], new Map()).idle, ['newer', 'older', 'undated'])
})

test('the buckets and the counts come from the same fold', () => {
  const sessions = list(
    ['run', { updatedAt: 4 }],
    ['unread', { updatedAt: 3 }],
    ['idle', { updatedAt: 2 }],
    ['arch', { updatedAt: 1 }],
    ['blank', { blank: true }],
  )
  const statuses_ = statuses(['run', { running: true }], ['unread', { completionUnread: true }])
  const counts = countSessions(sessions, ['arch'], statuses_)
  const buckets = classifySessions(sessions, ['arch'], statuses_)
  for (const metric of METRICS) {
    assert.equal(counts[metric], buckets[metric].length, 'the ' + metric + ' count is its bucket size')
  }
})

test('classifySessions answers six empty buckets for a malformed snapshot', () => {
  const empty = { running: [], unread: [], pending: [], idle: [], unarchived: [], archived: [] }
  assert.deepEqual(classifySessions(undefined, undefined, undefined), empty)
  assert.deepEqual(classifySessions({ ids: undefined, byId: {} }, []), empty)
})

test('a parent with a live subagent counts as running', () => {
  const sessions = listWithSubagents([['parent', { updatedAt: 1 }]], { parent: ['kid'] })
  const counts = countSessions(
    sessions,
    [],
    statuses(['parent', { running: false, completionUnread: false }], ['kid', { running: true }]),
  )
  assert.equal(counts.running, 1, 'the shell calls a parent with a live child ongoing')
  assert.equal(counts.idle, 0)
})

test('the walk bucket visits the parent the running number counted', () => {
  const sessions = listWithSubagents(
    [['parent', { updatedAt: 2 }], ['other', { updatedAt: 1 }]],
    { parent: ['kid'] },
  )
  const buckets = classifySessions(
    sessions,
    [],
    statuses(['parent', { running: false }], ['other', { running: false }], ['kid', { running: true }]),
  )
  assert.deepEqual(buckets.running, ['parent'])
  assert.deepEqual(buckets.idle, ['other'])
  assert.equal(buckets.running.length + buckets.idle.length, buckets.unarchived.length)
})

test('a child the status stream still reports wins over a missing list row', () => {
  const sessions = listWithSubagents([['parent', {}]], { parent: ['kid'] })
  const counts = countSessions(sessions, [], statuses(['parent', { running: false }], ['kid', { running: true }]))
  assert.equal(counts.running, 1, 'the status stream is the primary evidence, the row only a fallback')
})

test('a parent whose subagents all stopped falls back to its own state', () => {
  const sessions = listWithSubagents(
    [['done', { updatedAt: 2 }], ['quiet', { updatedAt: 1 }]],
    { done: ['kid1'], quiet: ['kid2'] },
  )
  const counts = countSessions(
    sessions,
    [],
    statuses(
      ['done', { running: false, completionUnread: true }],
      ['quiet', { running: false, completionUnread: false }],
      ['kid1', { running: false }],
      ['kid2', { running: false }],
    ),
  )
  assert.equal(counts.running, 0, 'a finished child leaves no live activity behind')
  assert.equal(counts.unread, 1)
  assert.equal(counts.idle, 1)
})

test('a live subagent outranks its parent own completion reminder', () => {
  const sessions = listWithSubagents([['parent', {}]], { parent: ['kid'] })
  const counts = countSessions(
    sessions,
    [],
    statuses(['parent', { running: false, completionUnread: true }], ['kid', { running: true }]),
  )
  assert.equal(counts.running, 1, 'the shell paints that row ongoing, not completed')
  assert.equal(counts.unread, 0)
})

test('a parent waiting for an answer stays pending while its subagent runs', () => {
  const sessions = listWithSubagents([['parent', {}]], { parent: ['kid'] })
  const counts = countSessions(
    sessions,
    [],
    statuses(['parent', { running: false, pendingInteraction: { kind: 'approval' } }], ['kid', { running: true }]),
  )
  assert.equal(counts.pending, 1, 'waiting for the operator still outranks background activity')
  assert.equal(counts.running, 0)
})

test('an archived parent stays archived while its subagent runs', () => {
  const sessions = listWithSubagents([['parent', {}]], { parent: ['kid'] })
  const counts = countSessions(sessions, ['parent'], statuses(['kid', { running: true }]))
  assert.deepEqual(counts, { running: 0, unread: 0, pending: 0, idle: 0, unarchived: 0, archived: 1 })
})

test('a child Session is never a row of its own, only evidence for its parent', () => {
  const sessions = listWithSubagents(
    [['parent', {}], ['kid', { parentId: 'parent', running: true }]],
    { parent: ['kid'] },
  )
  const counts = countSessions(sessions, [], statuses(['kid', { running: true }]))
  assert.equal(counts.unarchived, 1, 'only the parent is an ordinary Session')
  assert.equal(counts.running, 1, 'and it runs because the child does')
})

test('a child the status stream has not reached still makes its parent run', () => {
  const sessions = listWithSubagents(
    [['parent', {}], ['kid', { parentId: 'parent', running: true }]],
    { parent: ['kid'] },
  )
  assert.equal(countSessions(sessions, [], undefined).running, 1, 'the list row is the fallback')
})

test('a parent runs only on evidence: empty, malformed, or unresolvable catalogs leave it alone', () => {
  const shellWithoutProjections = list(['parent', {}])
  assert.equal(
    countSessions(shellWithoutProjections, [], statuses(['parent', { running: false }])).running,
    0,
    'a snapshot from a shell that carries no projection store keeps the old rule',
  )

  const empty = listWithSubagents([['parent', {}]], { parent: [] })
  assert.equal(countSessions(empty, [], statuses(['parent', { running: false }])).running, 0)

  const notAList = {
    ...list(['parent', {}]),
    projectionsBySession: { parent: { values: { subagentCatalog: 'not-a-list' } } },
  }
  assert.equal(countSessions(notAList, [], statuses(['parent', { running: false }])).running, 0)

  const unnamed = {
    ...list(['parent', {}]),
    projectionsBySession: { parent: { values: { subagentCatalog: [null, {}, undefined] } } },
  }
  assert.equal(countSessions(unnamed, [], statuses(['parent', { running: false }])).running, 0)

  const noEvidence = listWithSubagents([['parent', {}]], { parent: ['ghost'] })
  assert.equal(
    countSessions(noEvidence, [], statuses(['parent', { running: false }])).running,
    0,
    'a child named only by the catalog has no running evidence',
  )
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
