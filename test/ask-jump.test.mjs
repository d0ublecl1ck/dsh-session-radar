/**
 * Pure-lane test: the pending-ask queue. It is a fold over the pending order,
 * so it is testable without DOM, React, or the shell's services. The walk home
 * is the visited-conversation history (./session-history), not this module.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { nextAsk } from '../.test-build/client/ask-jump.js'

test('no pending ask has nowhere to go', () => {
  assert.equal(nextAsk([], 'a'), null)
})

test('the first ask press lands on the earliest waiting session', () => {
  assert.equal(nextAsk(['b', 'c'], 'a'), 'b')
})

test('a press with no current session still lands on the first ask', () => {
  assert.equal(nextAsk(['b', 'c'], null), 'b')
})

test('pressing again while the ask is still open cycles to the next one', () => {
  assert.equal(nextAsk(['b', 'c'], 'b'), 'c')
})

test('the queue wraps around', () => {
  assert.equal(nextAsk(['b', 'c'], 'c'), 'b')
})

test('the only open ask is already the current session, so the press does nothing', () => {
  assert.equal(nextAsk(['b'], 'b'), null)
})

test('a current session that is not waiting enters the queue at its head', () => {
  assert.equal(nextAsk(['c', 'd'], 'a'), 'c')
})
