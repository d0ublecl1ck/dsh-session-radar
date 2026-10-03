/**
 * Pure-lane test: the pending-ask jump. The walk is a fold over the pending
 * order plus a LIFO trail of the sessions the operator left behind, so it is
 * testable without DOM, React, or the shell's services.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { nextAskJump } from '../.test-build/client/ask-jump.js'

test('no pending ask and an empty trail has nowhere to go', () => {
  assert.deepEqual(nextAskJump([], 'a', []), { target: null, stack: [] })
})

test('the first ask press remembers the session it came from', () => {
  assert.deepEqual(nextAskJump(['b', 'c'], 'a', []), { target: 'b', stack: ['a'] })
})

test('a press with no current session still lands on the first ask', () => {
  assert.deepEqual(nextAskJump(['b', 'c'], null, []), { target: 'b', stack: [] })
})

test('after the first ask is handled the walk follows the queue and remembers each stop', () => {
  assert.deepEqual(nextAskJump(['c'], 'b', ['a']), { target: 'c', stack: ['a', 'b'] })
})

test('with every ask handled the walk returns along the trail, newest stop first', () => {
  assert.deepEqual(nextAskJump([], 'c', ['a', 'b']), { target: 'b', stack: ['a'] })
  assert.deepEqual(nextAskJump([], 'b', ['a']), { target: 'a', stack: [] })
})

test('an exhausted trail ends the walk instead of looping', () => {
  assert.deepEqual(nextAskJump([], 'a', []), { target: null, stack: [] })
})

test('pressing again while the ask is still open cycles to the next one', () => {
  assert.deepEqual(nextAskJump(['b', 'c'], 'b', ['a']), { target: 'c', stack: ['a'] })
})

test('the only open ask is already the current session, so the press does nothing', () => {
  assert.deepEqual(nextAskJump(['b'], 'b', ['a']), { target: null, stack: ['a'] })
})

test('a session already on the trail is never pushed twice', () => {
  assert.deepEqual(nextAskJump(['c'], 'a', ['a', 'b']), { target: 'c', stack: ['a', 'b'] })
})

test('the walk back never lands on the session it is already showing', () => {
  assert.deepEqual(nextAskJump([], 'b', ['a', 'b']), { target: 'a', stack: [] })
})

test('a trail that only holds the current session is consumed and ends the walk', () => {
  assert.deepEqual(nextAskJump([], 'a', ['a']), { target: null, stack: [] })
})
