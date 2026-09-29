/**
 * Unit lane for the conversation-tail anchors: which Session's visible
 * conversation is scrolled to (or following) its tail.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { JSDOM } = await import('jsdom')
const { tailSessionId } = await import('../.test-build/client/conversation-tail.js')

/** Build a document from a fragment, detached from any live page. */
function doc(html) {
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document
}

/** The shipped chat region shape: region > scrollport > chat root. */
function region(sessionId, { followingTail = false } = {}) {
  const tail = followingTail ? ' data-chat-following-tail=""' : ''
  return `<div data-conversation-region="chat" data-conversation-session="${sessionId}">`
    + `<div data-conversation-scroll><div class="chat-root"${tail}></div></div></div>`
}

test('tailSessionId resolves the Session whose conversation follows its tail', () => {
  assert.equal(tailSessionId(doc(region('session-a', { followingTail: true }))), 'session-a')
})

test('tailSessionId is null while the conversation is scrolled up or absent', () => {
  assert.equal(tailSessionId(doc(region('session-a'))), null, 'scrolled up')
  assert.equal(tailSessionId(doc('')), null, 'no conversation at all')
  assert.equal(
    tailSessionId(doc('<div data-conversation-region="chat"></div>')),
    null,
    'a session-less chat region has nothing to acknowledge',
  )
})

test('tailSessionId only trusts a following region inside the region itself', () => {
  const outside = doc(region('session-a') + '<div data-chat-following-tail=""></div>')
  assert.equal(tailSessionId(outside), null, 'a stray tail marker elsewhere does not count')
})
