/**
 * Unit lane for the row badge's two pure rules: the host ledger's reminder ids,
 * and the manual-unread ids the operator just cleared (their "mark as read" is
 * a read the ledger has to hear about, or the green dot would never go away).
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { ledgerUnreadIds } = await import('../.test-build/row-badge.js')
const { droppedIds } = await import('../.test-build/client/manual-unread.js')

test('ledgerUnreadIds collects one id per ledger reminder', () => {
  assert.deepEqual([...ledgerUnreadIds([])], [])
  assert.deepEqual(
    [...ledgerUnreadIds([
      { sessionId: 's1' }, { sessionId: 's2' }, { sessionId: 's1' },
    ])].sort(),
    ['s1', 's2'],
  )
})

test('ledgerUnreadIds tolerates a malformed reminder row', () => {
  assert.deepEqual([...ledgerUnreadIds([{ sessionId: '' }, { sessionId: 7 }, {}])], [])
})

test('droppedIds reports only the ids the operator just cleared', () => {
  assert.deepEqual(droppedIds(new Set(), new Set()), [])
  assert.deepEqual(droppedIds(new Set(), new Set(['s1'])), [], 'a fresh mark is not a read')
  assert.deepEqual(droppedIds(new Set(['s1', 's2']), new Set(['s1', 's2'])), [])
  assert.deepEqual(droppedIds(new Set(['s1', 's2']), new Set(['s2'])), ['s1'])
  assert.deepEqual(droppedIds(new Set(['s1', 's2']), new Set()), ['s1', 's2'])
})
