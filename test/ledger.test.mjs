import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyLedger,
  listInterrupted,
  listUnread,
  markContinued,
  markRead,
  normalizeLedger,
  recordAttention,
  recordTurnEnd,
} from '../.test-build/ledger.js'

const T = (n) => 1_700_000_000_000 + n

test('a turn end marks the session unread', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'completed', cause: null })
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(1), kind: 'completed' }])
})

test('markRead clears unread and a newer turn end re-arms it', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'completed', cause: null })
  markRead(ledger, 's1', T(2))
  assert.deepEqual(listUnread(ledger), [])
  recordTurnEnd(ledger, { sessionId: 's1', at: T(3), kind: 'completed', cause: null })
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(3), kind: 'completed' }])
})

test('attention alone is unread, and the newer of the two wins', () => {
  const ledger = emptyLedger()
  recordAttention(ledger, { sessionId: 's1', at: T(9), kind: 'question' })
  recordTurnEnd(ledger, { sessionId: 's1', at: T(7), kind: 'completed', cause: null })
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(9), kind: 'question' }])
})

test('aborted by host disposal is interrupted; aborted by the user is not', () => {
  const disposed = emptyLedger()
  recordTurnEnd(disposed, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  assert.deepEqual(listInterrupted(disposed), [{ sessionId: 's1', at: T(1) }])

  const byUser = emptyLedger()
  recordTurnEnd(byUser, { sessionId: 's2', at: T(2), kind: 'aborted', cause: 'user' })
  assert.deepEqual(listInterrupted(byUser), [])
  assert.equal(listUnread(byUser).length, 1, 'but the operator still has not read it')
})

test('an interrupted session stays unread until it is continued', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  markRead(ledger, 's1', T(2))
  assert.equal(listUnread(ledger).length, 1, 'opening it does not excuse the missing turn')
  markContinued(ledger, 's1', T(3))
  assert.deepEqual(listInterrupted(ledger), [])
  assert.deepEqual(listUnread(ledger), [])
})

test('a later normal turn end clears an earlier interrupted flag', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  recordTurnEnd(ledger, { sessionId: 's1', at: T(2), kind: 'completed', cause: null })
  assert.deepEqual(listInterrupted(ledger), [])
})

test('a serialize/parse round trip preserves the reminder', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  recordTurnEnd(ledger, { sessionId: 's2', at: T(2), kind: 'completed', cause: null })
  markRead(ledger, 's2', T(3))
  const round = normalizeLedger(JSON.parse(JSON.stringify(ledger)))
  assert.deepEqual(listUnread(round), [{ sessionId: 's1', at: T(1), kind: 'aborted' }])
  assert.deepEqual(listInterrupted(round), [{ sessionId: 's1', at: T(1) }])
})

test('garbage input normalizes to an empty ledger instead of throwing', () => {
  for (const raw of [null, 'nope', 42, { sessions: 5 }, [], undefined]) {
    assert.deepEqual(listUnread(normalizeLedger(raw)), [])
    assert.deepEqual(listInterrupted(normalizeLedger(raw)), [])
  }
})

test('read markers never move backwards', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(5), kind: 'completed', cause: null })
  markRead(ledger, 's1', T(9))
  markRead(ledger, 's1', T(4))
  assert.deepEqual(listUnread(ledger), [], 'the older read mark must not re-arm the reminder')
})
