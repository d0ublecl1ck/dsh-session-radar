/**
 * Pure-lane test: the visited-conversation history behind the back/forward
 * commands. The whole walk is a fold over the entries plus the cursor, so it is
 * testable without DOM, React, or the shell's services.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyHistory, recordVisit, stepHistory } from '../.test-build/client/session-history.js'

const known = () => true

test('an empty history takes the first visit as its current entry', () => {
  assert.deepEqual(recordVisit(emptyHistory(), 'a'), { entries: ['a'], index: 0 })
})

test('a new conversation is appended and becomes current', () => {
  const history = { entries: ['a', 'b'], index: 1 }
  assert.deepEqual(recordVisit(history, 'c'), { entries: ['a', 'b', 'c'], index: 2 })
})

test('recording the conversation already on screen changes nothing', () => {
  const history = { entries: ['a', 'b'], index: 1 }
  assert.equal(recordVisit(history, 'b'), history, 'the same structure is kept, not rebuilt')
})

test('revisiting an earlier conversation just moves the cursor and keeps the forward entries', () => {
  assert.deepEqual(recordVisit({ entries: ['a', 'b', 'c'], index: 2 }, 'a'), { entries: ['a', 'b', 'c'], index: 0 })
})

test('a new conversation from a back position drops the forward entries', () => {
  assert.deepEqual(recordVisit({ entries: ['a', 'b', 'c'], index: 1 }, 'd'), { entries: ['a', 'b', 'd'], index: 2 })
})

test('with nowhere to go the walk leaves the history untouched', () => {
  const history = { entries: ['a'], index: 0 }
  assert.deepEqual(stepHistory(history, -1, known), { target: null, history })
  assert.deepEqual(stepHistory(history, 1, known), { target: null, history })
})

test('one step back opens the conversation before this one', () => {
  const history = { entries: ['a', 'b', 'c'], index: 2 }
  assert.deepEqual(stepHistory(history, -1, known), { target: 'b', history: { entries: ['a', 'b', 'c'], index: 1 } })
})

test('one step forward opens the conversation after this one', () => {
  const history = { entries: ['a', 'b', 'c'], index: 1 }
  assert.deepEqual(stepHistory(history, 1, known), { target: 'c', history: { entries: ['a', 'b', 'c'], index: 2 } })
})

test('a conversation that left the list is skipped, not opened', () => {
  const history = { entries: ['a', 'b', 'c'], index: 2 }
  assert.deepEqual(
    stepHistory(history, -1, (id) => id !== 'b'),
    { target: 'a', history: { entries: ['a', 'b', 'c'], index: 0 } },
  )
})

test('skipping every remaining entry ends the walk', () => {
  const history = { entries: ['a', 'b', 'c'], index: 2 }
  assert.deepEqual(stepHistory(history, -1, () => false), { target: null, history })
})
