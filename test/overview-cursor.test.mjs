/**
 * Pure-lane test: the keyboard cursor behind the waiting window. The window
 * renders two zones, so the cursor is the pair "which zone, which card"; the
 * component keeps only the latest value and asks this module where a key press
 * moves it.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  moveCursor, seedCursor, selectedCard, zoneCards, zoneLength,
} from '../.test-build/client/overview-cursor.js'

function card(id, overrides = {}) {
  return {
    id,
    title: id,
    folder: '',
    updatedAt: 0,
    pending: undefined,
    unread: true,
    current: false,
    ...overrides,
  }
}

const WAITING = {
  ask: [card('a1', { pending: 'approval' }), card('a2', { pending: 'question' })],
  unread: [card('u1'), card('u2'), card('u3')],
}
const ONLY_UNREAD = { ask: [], unread: [card('u1'), card('u2')] }
const ONLY_ASK = { ask: [card('a1', { pending: 'plan-review' })], unread: [] }
const NOTHING = { ask: [], unread: [] }

test('the seed cursor leads with the ask zone when something waits there', () => {
  assert.deepEqual(seedCursor(WAITING), { zone: 'ask', index: 0 })
  assert.deepEqual(seedCursor(ONLY_UNREAD), { zone: 'unread', index: 0 })
  assert.deepEqual(seedCursor(ONLY_ASK), { zone: 'ask', index: 0 })
  assert.equal(seedCursor(NOTHING), null)
})

test('down and up walk one zone and wrap around its ends', () => {
  assert.deepEqual(moveCursor({ zone: 'ask', index: 0 }, WAITING, 'down'), { zone: 'ask', index: 1 })
  assert.deepEqual(moveCursor({ zone: 'ask', index: 1 }, WAITING, 'down'), { zone: 'ask', index: 0 })
  assert.deepEqual(moveCursor({ zone: 'ask', index: 0 }, WAITING, 'up'), { zone: 'ask', index: 1 })
  assert.deepEqual(moveCursor({ zone: 'unread', index: 2 }, ONLY_UNREAD, 'down'), { zone: 'unread', index: 0 })
  assert.deepEqual(moveCursor({ zone: 'unread', index: 0 }, ONLY_UNREAD, 'up'), { zone: 'unread', index: 1 })
})

test('left and right switch zone and land on its first card', () => {
  assert.deepEqual(moveCursor({ zone: 'ask', index: 0 }, WAITING, 'right'), { zone: 'unread', index: 0 })
  assert.deepEqual(moveCursor({ zone: 'unread', index: 2 }, WAITING, 'left'), { zone: 'ask', index: 0 })
  assert.deepEqual(moveCursor({ zone: 'unread', index: 1 }, WAITING, 'right'), { zone: 'ask', index: 0 })
})

test('a switch onto an empty zone leaves the cursor where it was', () => {
  assert.deepEqual(moveCursor({ zone: 'unread', index: 1 }, ONLY_UNREAD, 'left'), { zone: 'unread', index: 1 })
  assert.deepEqual(moveCursor({ zone: 'ask', index: 0 }, ONLY_ASK, 'right'), { zone: 'ask', index: 0 })
})

test('a press with no cursor yet seeds the start and then applies the step', () => {
  // The seed is the first ask; a following step moves from there like any other.
  assert.deepEqual(moveCursor(null, WAITING, 'down'), { zone: 'ask', index: 1 })
  assert.deepEqual(moveCursor(null, WAITING, 'up'), { zone: 'ask', index: 1 })
  // A switch out of an empty ask zone cannot move, so the seed stands.
  assert.deepEqual(moveCursor(null, ONLY_UNREAD, 'left'), { zone: 'unread', index: 0 })
  assert.equal(moveCursor(null, NOTHING, 'down'), null)
})

test('a cursor whose zone shrank is clamped back onto a real card', () => {
  assert.deepEqual(moveCursor({ zone: 'unread', index: 7 }, WAITING, 'down'), { zone: 'unread', index: 0 })
  assert.deepEqual(moveCursor({ zone: 'ask', index: 5 }, ONLY_ASK, 'up'), { zone: 'ask', index: 0 })
})

test('the selected card is the one the cursor stands on', () => {
  assert.equal(selectedCard(WAITING, { zone: 'ask', index: 1 }).id, 'a2')
  assert.equal(selectedCard(WAITING, { zone: 'unread', index: 0 }).id, 'u1')
  assert.equal(selectedCard(WAITING, null), null)
  assert.equal(selectedCard(NOTHING, { zone: 'ask', index: 0 }), null)
})

test('zone cards and zone length read the overview the window renders', () => {
  assert.deepEqual(zoneCards(WAITING, 'ask').map(entry => entry.id), ['a1', 'a2'])
  assert.deepEqual(zoneCards(WAITING, 'unread').map(entry => entry.id), ['u1', 'u2', 'u3'])
  assert.equal(zoneLength(WAITING, 'ask'), 2)
  assert.equal(zoneLength(NOTHING, 'unread'), 0)
})
