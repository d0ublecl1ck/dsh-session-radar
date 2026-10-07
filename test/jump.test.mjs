import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import {
  expandOwningGroup, findSessionRow, nextUnreadId, owningWorkspaceKey, sessionIdOfRowKey, sessionRowKey,
} from '../.test-build/client/jump.js'

test('no unread Session yields no jump target', () => {
  assert.equal(nextUnreadId([], null), null)
  assert.equal(nextUnreadId([], 'a'), null)
})

test('the first click lands on the first unread Session', () => {
  assert.equal(nextUnreadId(['a', 'b', 'c'], null), 'a')
})

test('the next click advances to the following unread Session', () => {
  assert.equal(nextUnreadId(['a', 'b', 'c'], 'a'), 'b')
  assert.equal(nextUnreadId(['a', 'b', 'c'], 'b'), 'c')
})

test('the last unread Session wraps around to the first', () => {
  assert.equal(nextUnreadId(['a', 'b', 'c'], 'c'), 'a')
})

test('a single unread Session keeps being the target', () => {
  assert.equal(nextUnreadId(['a'], null), 'a')
  assert.equal(nextUnreadId(['a'], 'a'), 'a')
})

test('a cursor that is no longer unread falls back to the first', () => {
  assert.equal(nextUnreadId(['a', 'b'], 'gone'), 'a')
})

test('the sidebar row key is the shipped data-row-key shape', () => {
  assert.equal(sessionRowKey('session-1'), 'session:session-1')
})

test('the row lookup finds the Session row inside the list seat', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const { document } = dom.window
  const listArea = document.createElement('div')
  const other = document.createElement('div')
  other.setAttribute('data-row-key', 'session:other')
  const row = document.createElement('div')
  row.setAttribute('data-row-key', 'session:target')
  listArea.append(other, row)
  document.body.append(listArea)
  assert.equal(findSessionRow(listArea, 'target'), row)
  assert.equal(findSessionRow(listArea, 'missing'), undefined)
  assert.equal(findSessionRow(null, 'target'), undefined)
})

/** Sidebar fixture: w1 collapsed, w2 expanded with one member row. */
function sidebarWithGroups() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const { document } = dom.window
  const listArea = document.createElement('div')
  const collapsed = document.createElement('div')
  collapsed.setAttribute('data-row-key', 'workspace:w1')
  const expanded = document.createElement('div')
  expanded.setAttribute('data-row-key', 'workspace:w2')
  const member = document.createElement('div')
  member.setAttribute('data-row-key', 'session:b1')
  listArea.append(collapsed, expanded, member)
  document.body.append(listArea)
  return { listArea, collapsed, expanded }
}

test('the owning Workspace of a Session is resolved from the registry', () => {
  const items = [
    { workspaceId: 'w1', sessionIds: ['a'] },
    { workspaceId: 'w2', sessionIds: ['b'] },
  ]
  assert.equal(owningWorkspaceKey(items, 'b'), 'w2')
  assert.equal(owningWorkspaceKey(items, 'a'), 'w1')
  assert.equal(owningWorkspaceKey(items, 'gone'), undefined)
})

test('the Session behind a sidebar row key is read back out of it', () => {
  assert.equal(sessionIdOfRowKey(sessionRowKey('s1')), 's1')
  assert.equal(sessionIdOfRowKey('session:'), null, 'a key without an id names no Session')
  assert.equal(sessionIdOfRowKey('workspace:w1'), null, 'a Workspace row is not a Session')
  assert.equal(sessionIdOfRowKey('s1'), null, 'a bare id is not a row key')
  for (const value of [null, undefined, 7, '']) {
    assert.equal(sessionIdOfRowKey(value), null, String(value))
  }
})

test('a collapsed group is expanded by pressing its row, an expanded one is left alone', () => {
  const { listArea, collapsed, expanded } = sidebarWithGroups()
  let collapsedPresses = 0
  let expandedPresses = 0
  collapsed.addEventListener('click', () => { collapsedPresses += 1 })
  expanded.addEventListener('click', () => { expandedPresses += 1 })

  assert.equal(expandOwningGroup(listArea, 'w1'), true, 'the collapsed group is pressed')
  assert.equal(collapsedPresses, 1)
  assert.equal(expandOwningGroup(listArea, 'w2'), false, 'a group with a rendered member is not pressed')
  assert.equal(expandedPresses, 0)
  assert.equal(expandOwningGroup(listArea, 'missing'), false)
  assert.equal(expandOwningGroup(null, 'w1'), false)
})
