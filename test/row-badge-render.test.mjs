/**
 * Render lane for the Session row badge: the official row renders the
 * `sidebar.session.row.leading` seat only when the row's own primary status is
 * idle and the Workspace browser's manual unread flag is unset. After a restart
 * the framework's completion flag is empty, so this seat is the one place a
 * ledger reminder can still paint the same green dot.
 */
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
after(() => { dom.window.close() })

const { apply } = await import('../.test-build/client/index.js')
const { createWatchContext, translate } = await import('./watch-harness.mjs')

const ROW_SLOT = 'sidebar.session.row.leading'
const BADGE_ID = 'session-radar.row-badge'

/** A ledger face whose snapshot carries exactly the reminder ids given. */
function ledgerOf(ids) {
  const unread = ids.map((sessionId) => ({ sessionId, at: 0, kind: null, interrupted: false }))
  return {
    getSnapshot: () => ({ now: 0, bootAt: 0, unread, error: null }),
    subscribe: () => () => {},
    read: () => {},
  }
}

/** Render the registered badge for one Session. */
function renderBadge({ options = {}, sessionId = 's1', unread = ['s1'] } = {}) {
  const mounted = createWatchContext(options)
  apply(mounted.ctx)
  const entry = mounted.byId(ROW_SLOT, BADGE_ID)
  assert.notEqual(entry, undefined, 'the badge must register into the Session row leading seat')
  const face = entry.options.inject()
  return renderToStaticMarkup(createElement(entry.component, {
    sessionId,
    ledger: ledgerOf(unread),
    config: face.config,
    t: translate(mounted),
  }))
}

test('a ledger reminder paints the done dot on its own Session row', () => {
  const markup = renderBadge()
  assert.match(markup, /data-state-dot="done"/, 'the badge renders the official done dot')
  assert.match(markup, /已完成未查看/, 'and carries the unread label for a screen reader')
})

test('a ledger reminder on another Session leaves the row empty', () => {
  assert.equal(renderBadge({ unread: ['s2'] }), '')
})

test('the row badge follows its preference switch', () => {
  assert.equal(renderBadge({ options: { value: { showRowBadge: false } } }), '')
  assert.notEqual(renderBadge({ options: { value: { showRowBadge: true } } }), '')
})
