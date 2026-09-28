/**
 * Unit lane for the manual-unread bridge: the Workspace browser's own
 * "mark unread" flag, which persists into localStorage under a versioned key
 * and therefore enters the bell as a set of its own.
 */
import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'

const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.Storage = window.Storage

// Captured before any watcher patches the prototype, so a test can write like
// the Desktop shell does (a same-document write with no wrapper involved).
const nativeSetItem = window.Storage.prototype.setItem

const {
  DESKTOP_STORAGE_SYNC_EVENT, WORKSPACE_VIEW_STORAGE_KEY,
  parseManualUnread, readManualUnread, watchManualUnread,
} = await import('../.test-build/client/manual-unread.js')

after(() => { dom.window.close() })
beforeEach(() => { window.localStorage.removeItem(WORKSPACE_VIEW_STORAGE_KEY) })

test('parseManualUnread tolerates absent, hostile, and partial documents', () => {
  assert.equal(parseManualUnread(null).size, 0)
  assert.equal(parseManualUnread('not json').size, 0)
  assert.equal(parseManualUnread('[]').size, 0)
  assert.equal(parseManualUnread('{}').size, 0)
  assert.equal(parseManualUnread(JSON.stringify({ unreadSessionIds: 'x' })).size, 0)
  assert.deepEqual(
    [...parseManualUnread(JSON.stringify({
      groupBy: 'workspace',
      unreadSessionIds: ['s1', '', 7, 's1', 's2'],
    }))],
    ['s1', 's2'],
  )
})

test('readManualUnread follows the persisted view store', () => {
  assert.equal(readManualUnread().size, 0)
  window.localStorage.setItem(WORKSPACE_VIEW_STORAGE_KEY, JSON.stringify({ unreadSessionIds: ['s1'] }))
  assert.deepEqual([...readManualUnread()], ['s1'])
  window.localStorage.setItem(WORKSPACE_VIEW_STORAGE_KEY, JSON.stringify({ unreadSessionIds: [] }))
  assert.equal(readManualUnread().size, 0)
})

test('watchManualUnread reports a same-document write and stops on dispose', () => {
  const seen = []
  const stop = watchManualUnread((ids) => { seen.push([...ids]) })
  window.localStorage.setItem(WORKSPACE_VIEW_STORAGE_KEY, JSON.stringify({ unreadSessionIds: ['s1'] }))
  assert.deepEqual(seen, [['s1']])
  // A write to an unrelated key is not the view store's business.
  window.localStorage.setItem('dsh.sidebar-right.v1.session-s1', '{"a":1}')
  assert.deepEqual(seen, [['s1']])
  window.localStorage.setItem(
    WORKSPACE_VIEW_STORAGE_KEY,
    JSON.stringify({ unreadSessionIds: ['s1', 's2'] }),
  )
  assert.deepEqual(seen, [['s1'], ['s1', 's2']])
  // A write that leaves the set unchanged notifies nobody.
  window.localStorage.setItem(
    WORKSPACE_VIEW_STORAGE_KEY,
    JSON.stringify({ groupBy: 'flat', unreadSessionIds: ['s1', 's2'] }),
  )
  assert.deepEqual(seen, [['s1'], ['s1', 's2']])
  stop()
  window.localStorage.setItem(WORKSPACE_VIEW_STORAGE_KEY, JSON.stringify({ unreadSessionIds: [] }))
  assert.deepEqual(seen, [['s1'], ['s1', 's2']], 'a disposed watcher says nothing')
})

test('watchManualUnread answers the Desktop storage-sync channel', () => {
  const seen = []
  const stop = watchManualUnread((ids) => { seen.push([...ids]) })
  // The Desktop shell writes through its own override and announces the change
  // on a window event; bypass the wrapper to exercise that channel alone.
  const payload = JSON.stringify({ unreadSessionIds: ['s3'] })
  nativeSetItem.call(window.localStorage, WORKSPACE_VIEW_STORAGE_KEY, payload)
  assert.deepEqual(seen, [], 'a bare write the wrapper did not see stays silent')
  window.dispatchEvent(new window.CustomEvent(DESKTOP_STORAGE_SYNC_EVENT, {
    detail: { type: 'set', key: WORKSPACE_VIEW_STORAGE_KEY, val: payload },
  }))
  assert.deepEqual(seen, [['s3']])
  stop()
})
