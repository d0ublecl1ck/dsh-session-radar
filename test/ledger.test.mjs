import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acknowledgeInterrupt,
  adoptAbandonedTurns,
  clearSupersededChildren,
  emptyLedger,
  isRestartInterrupt,
  LEDGER_VERSION,
  listUnread,
  markRead,
  normalizeLedger,
  recordAttention,
  recordTurnEnd,
  recordTurnStart,
  restartInterruptedTail,
} from '../.test-build/ledger.js'
import * as ledgerModule from '../.test-build/ledger.js'

const T = (n) => 1_700_000_000_000 + n

test('a turn end marks the session unread', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'completed', cause: null })
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(1), kind: 'completed', interrupted: false }])
})

test('markRead clears unread and a newer turn end re-arms it', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'completed', cause: null })
  markRead(ledger, 's1', T(2))
  assert.deepEqual(listUnread(ledger), [])
  recordTurnEnd(ledger, { sessionId: 's1', at: T(3), kind: 'completed', cause: null })
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(3), kind: 'completed', interrupted: false }])
})

test('attention alone is unread, and the newer of the two wins', () => {
  const ledger = emptyLedger()
  recordAttention(ledger, { sessionId: 's1', at: T(9), kind: 'question' })
  recordTurnEnd(ledger, { sessionId: 's1', at: T(7), kind: 'completed', cause: null })
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(9), kind: 'question', interrupted: false }])
})

test('aborted by host disposal is interrupted; aborted by the user is not', () => {
  const disposed = emptyLedger()
  recordTurnEnd(disposed, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  assert.equal(disposed.sessions.s1.interruptedAt, T(1), 'the disposed turn is flagged as a restart orphan')
  assert.deepEqual(listUnread(disposed), [{ sessionId: 's1', at: T(1), kind: 'aborted', interrupted: true }])

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

test('reaching the tail acknowledges an interrupted turn', () => {
  const ledger = emptyLedger()
  recordTurnEnd(ledger, { sessionId: 's1', at: T(1), kind: 'aborted', cause: 'disposed' })
  markRead(ledger, 's1', T(2))
  assert.equal(listUnread(ledger).length, 1, 'a read marker alone keeps the reminder')
  acknowledgeInterrupt(ledger, 's1')
  assert.equal(ledger.sessions.s1.interruptedAt, null, 'the tail acknowledgement drops the marker')
  assert.deepEqual(listUnread(ledger), [], 'and the reminder does not come back')
  assert.equal(acknowledgeInterrupt(ledger, 'missing'), undefined, 'an unknown Session is a no-op')
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
  assert.deepEqual(listUnread(round), [{ sessionId: 's1', at: T(1), kind: 'aborted', interrupted: true }])
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
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(4), kind: 'interrupted', interrupted: true }])
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

test('an open turn is remembered, and its boundary closes it', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 's1', at: T(1) })
  assert.equal(ledger.sessions.s1.runningSince, T(1), 'the open turn is on the record')
  assert.deepEqual(listUnread(ledger), [], 'a turn still running is not a reminder')
  recordTurnEnd(ledger, { sessionId: 's1', at: T(3), kind: 'completed', cause: null })
  assert.equal(ledger.sessions.s1.runningSince, null, 'the boundary closes the open turn')
})

test('a turn the previous process left open becomes an interrupted reminder', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 's1', at: T(5) })
  assert.equal(adoptAbandonedTurns(ledger, T(9)), 1, 'the abandoned turn was adopted')
  assert.equal(ledger.sessions.s1.runningSince, null, 'the open marker is spent')
  assert.equal(ledger.sessions.s1.interruptedAt, T(5), 'the orphan is dated at its own turn start')
  assert.deepEqual(listUnread(ledger), [{ sessionId: 's1', at: T(5), kind: 'interrupted', interrupted: true }])
})

test('a turn this process opened is not an abandonment', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 's1', at: T(9) })
  assert.equal(adoptAbandonedTurns(ledger, T(9)), 1, 'the marker is still spent')
  assert.equal(ledger.sessions.s1.interruptedAt, null, 'a remount only re-read the file')
  assert.deepEqual(listUnread(ledger), [], 'nothing was cut off')
})

test('a turn whose boundary is newer than its start is not an abandonment', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 's1', at: T(5) })
  recordTurnEnd(ledger, { sessionId: 's1', at: T(6), kind: 'completed', cause: null })
  ledger.sessions.s1.runningSince = T(5) // a file written before the boundary landed
  assert.equal(adoptAbandonedTurns(ledger, T(9)), 1)
  assert.equal(ledger.sessions.s1.interruptedAt, null, 'the later boundary is the newer fact')
})

test('the open-turn marker survives a round trip, and older ledgers read as none', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 's1', at: T(5) })
  const round = normalizeLedger(JSON.parse(JSON.stringify(ledger)))
  assert.equal(round.sessions.s1.runningSince, T(5), 'the marker is durable')
  const older = normalizeLedger({
    version: 1,
    sessions: { s2: { lastTurnEndAt: T(1), lastTurnEndKind: 'completed', lastReadAt: null } },
  })
  assert.equal(older.sessions.s2.runningSince, null, 'a ledger written before the field existed has no open turn')
})

test('the chip-only interrupted reader is gone from the ledger surface', () => {
  assert.equal('listInterrupted' in ledgerModule, false, 'the chip was removed; nothing reads an interrupted list')
})

test('a parent starting a new turn spends the cut-off turns of its children', () => {
  const ledger = emptyLedger()
  // Three turns the previous process left open: two of one parent, one of another.
  recordTurnStart(ledger, { sessionId: 'kid1', at: T(1), parentId: 'p' })
  recordTurnStart(ledger, { sessionId: 'kid2', at: T(4), parentId: 'p' })
  recordTurnStart(ledger, { sessionId: 'other', at: T(1), parentId: 'q' })
  assert.equal(adoptAbandonedTurns(ledger, T(9)), 3, 'the restart adopts them all')
  assert.equal(ledger.sessions.kid2.interruptedAt, T(4))

  assert.equal(
    clearSupersededChildren(ledger, { parentId: 'p', at: T(3) }),
    1,
    'only the child that was cut before the new turn is superseded',
  )
  assert.equal(ledger.sessions.kid1.interruptedAt, null, 'the parent has moved past that cut')
  assert.equal(ledger.sessions.kid2.interruptedAt, T(4), 'a turn cut during the new turn still needs the operator')
  assert.equal(ledger.sessions.other.interruptedAt, T(1), 'another parent\u2019s children are untouched')
  assert.equal(ledger.sessions.kid1.parentId, 'p', 'spending the marker leaves the link alone')
})

test('clearing is a no-op without a match, and never guesses an instant', () => {
  const ledger = emptyLedger()
  assert.equal(clearSupersededChildren(ledger, { parentId: 'p', at: T(5) }), 0, 'nothing recorded, nothing spent')
  recordTurnStart(ledger, { sessionId: 'kid', at: T(1), parentId: 'p' })
  adoptAbandonedTurns(ledger, T(9))
  assert.equal(
    clearSupersededChildren(ledger, { parentId: 'p', at: Number.NaN }),
    0,
    'an unusable instant must not spend every marker',
  )
  assert.equal(ledger.sessions.kid.interruptedAt, T(1))
  assert.equal(
    clearSupersededChildren(ledger, { parentId: 'p', at: T(1) }),
    0,
    'the cut and the new turn at the same instant is not a supersession',
  )
  assert.equal(ledger.sessions.kid.interruptedAt, T(1))
})

test('a remembered parent survives a round trip, and older ledgers read as top-level', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 'kid', at: T(1), parentId: 'p' })
  const round = normalizeLedger(JSON.parse(JSON.stringify(ledger)))
  assert.equal(round.sessions.kid.parentId, 'p', 'the link is durable')
  const older = normalizeLedger({
    version: 2,
    sessions: { kid: { lastTurnEndAt: T(1), lastTurnEndKind: 'completed', interruptedAt: T(1), lastReadAt: null } },
  })
  assert.equal(older.sessions.kid.parentId, null, 'a ledger written before the field existed has no parent')
  assert.equal(LEDGER_VERSION, 3, 'the persisted shape carries the parent link')
})

test('a later turn without a readable parent keeps the link already known', () => {
  const ledger = emptyLedger()
  recordTurnStart(ledger, { sessionId: 'kid', at: T(1), parentId: 'p' })
  recordTurnEnd(ledger, { sessionId: 'kid', at: T(2), kind: 'completed', cause: null })
  recordTurnStart(ledger, { sessionId: 'kid', at: T(3) })
  assert.equal(ledger.sessions.kid.parentId, 'p', 'a link is write-once; a missing header must not erase it')
})
