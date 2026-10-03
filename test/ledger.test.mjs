import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyLedger,
  isRestartInterrupt,
  listUnread,
  markRead,
  normalizeLedger,
  recordAttention,
  recordTurnEnd,
  restartInterruptedTail,
} from '../.test-build/ledger.js'
import * as ledgerModule from '../.test-build/ledger.js'

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
  assert.equal(disposed.sessions.s1.interruptedAt, T(1), 'the disposed turn is flagged as a restart orphan')
  assert.deepEqual(listUnread(disposed), [{ sessionId: 's1', at: T(1), kind: 'aborted' }])

  const byUser = emptyLedger()
  recordTurnEnd(byUser, { sessionId: 's2', at: T(2), kind: 'aborted', cause: 'user' })
  assert.equal(byUser.sessions.s2.interruptedAt, null, 'an operator cancel is not a restart')
  assert.equal(listUnread(byUser).length, 1, 'but the operator still has not read it')
})

test('an interrupted session stays unread until a later turn ends', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  markRead(ledger, 's1', T(2))
  assert.equal(listUnread(ledger).length, 1, 'opening it does not excuse the missing turn')
  recordTurnEnd(ledger, { sessionId: 's1', at: T(3), kind: 'completed', cause: null })
  assert.equal(ledger.sessions.s1.interruptedAt, null, 'a later turn clears the interrupt flag')
  markRead(ledger, 's1', T(4))
  assert.deepEqual(listUnread(ledger), [])
})

test('a later normal turn end clears an earlier interrupted flag', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  recordTurnEnd(ledger, { sessionId: 's1', at: T(2), kind: 'completed', cause: null })
  assert.equal(ledger.sessions.s1.interruptedAt, null)
})

test('a serialize/parse round trip preserves the reminder', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  recordTurnEnd(ledger, { sessionId: 's2', at: T(2), kind: 'completed', cause: null })
  markRead(ledger, 's2', T(3))
  const round = normalizeLedger(JSON.parse(JSON.stringify(ledger)))
  assert.deepEqual(listUnread(round), [{ sessionId: 's1', at: T(1), kind: 'aborted' }])
  assert.equal(round.sessions.s1.interruptedAt, T(1), 'the orphan flag survives the round trip')
})

test('garbage input normalizes to an empty ledger instead of throwing', () => {
  for (const raw of [null, 'nope', 42, { sessions: 5 }, [], undefined]) {
    assert.deepEqual(listUnread(normalizeLedger(raw)), [])
  }
})

test('read markers never move backwards', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(5), kind: 'completed', cause: null })
  markRead(ledger, 's1', T(9))
  markRead(ledger, 's1', T(4))
  assert.deepEqual(listUnread(ledger), [], 'the older read mark must not re-arm the reminder')
})
test('a crash-repaired turn end is a restart interrupt too', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(4), kind: 'interrupted', cause: null })
  assert.equal(ledger.sessions.s1.interruptedAt, T(4))
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(4), kind: 'interrupted' }])
})

test('only the two restart signals count as an interrupt', () => {
  assert.equal(isRestartInterrupt('interrupted', null), true)
  assert.equal(isRestartInterrupt('aborted', 'disposed'), true)
  assert.equal(isRestartInterrupt('aborted', 'user'), false)
  assert.equal(isRestartInterrupt('aborted', 'parent'), false)
  assert.equal(isRestartInterrupt('completed', null), false)
  assert.equal(isRestartInterrupt('error', null), false)
  assert.equal(isRestartInterrupt('max-tokens', null), false)
})

test('the stored-history scanner reports only an orphaned restart tail', () => {
  const closer = { type: 'turn/end', time: T(5), data: { turn: 3, reason: { kind: 'interrupted' } } }
  assert.deepEqual(
    restartInterruptedTail([
      { type: 'turn/start', time: T(1), data: { turn: 3 } },
      { type: 'assistant/message', time: T(2), data: {} },
      closer,
      { type: 'session/end-seed', time: T(5), data: {} },
    ]),
    { at: T(5), kind: 'interrupted', cause: null },
  )
  assert.deepEqual(
    restartInterruptedTail([
      { type: 'turn/end', time: T(6), data: { turn: 2, reason: { kind: 'aborted', reason: { kind: 'disposed' } } } },
    ]),
    { at: T(6), kind: 'aborted', cause: 'disposed' },
  )
  assert.equal(
    restartInterruptedTail([closer, { type: 'turn/start', time: T(7), data: { turn: 4 } }]),
    null,
    'a later live turn supersedes the orphan',
  )
  assert.equal(
    restartInterruptedTail([closer, { type: 'user/message', time: T(7), data: { source: { kind: 'user' } } }]),
    null,
    'a user message supersedes the orphan',
  )
  for (const events of [
    [],
    [{ type: 'turn/end', time: T(1), data: { turn: 1, reason: { kind: 'completed' } } }],
    [{ type: 'turn/end', time: T(1), data: { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } } }],
    [{ type: 'turn/end', time: T(1), data: { turn: 1, reason: { kind: 'error', error: { code: 'X' } } } }],
    [{ type: 'turn/end', data: { reason: { kind: 'interrupted' } } }],
    [{ type: 'turn/end', time: Number.NaN, data: { reason: { kind: 'interrupted' } } }],
    [{ type: 'turn/end', time: T(1), data: null }],
    [{ type: 'turn/end', time: T(1) }],
    [{ type: 'turn/start', time: T(1), data: { turn: 1 } }],
  ]) {
    assert.equal(restartInterruptedTail(events), null, JSON.stringify(events))
  }
})

test('the chip-only interrupted reader is gone from the ledger surface', () => {
  assert.equal('listInterrupted' in ledgerModule, false, 'the chip was removed; nothing reads an interrupted list')
})
