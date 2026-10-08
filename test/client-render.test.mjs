// Render test for the merged readout and its settings row, driven through the
// real registrations: mount the built client half, take the components it
// registered, and render them with the framework's standard selectors faked.
//
// The shell's real Tooltip is a portal owner, so the node-lane double renders
// only its anchor; assertions therefore read the anchor's own aria-label and
// data attributes instead of the tooltip copy.
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The DOM must exist before the built client half injects its stylesheet.
const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
after(() => { dom.window.close() })

const { apply } = await import('../.test-build/client/index.js')
const {
  createWatchContext,
  sessionRows,
  standardHooks,
  statusMap,
  translate,
  FOOTER_SLOT,
  STATUS_ID,
  SETTINGS_SLOT,
  BELL_ID,
} = await import('./watch-harness.mjs')

/** Mount the built client half against a fake Host and return its records. */
function mount(options = {}) {
  const mounted = createWatchContext(options)
  apply(mounted.ctx)
  return mounted
}

/** Render one registered component with the props the framework composes. */
function renderRegistered(mounted, name, id, extra, locale = 'zh') {
  const entry = mounted.byId(name, id)
  assert.notEqual(entry, undefined, name + '#' + id + ' must be registered')
  const face = entry.options.inject()
  const props = {
    wide: true,
    config: face.config,
    t: translate(mounted, locale),
    ...extra,
  }
  return renderToStaticMarkup(createElement(entry.component, props))
}

/**
 * The fixture shared by the readout tests: six ordinary Sessions split across
 * every metric, plus one subagent child and one blank seat that must not count.
 */
function fixture() {
  const list = sessionRows(8, {
    'session-6': { parentId: 'session-0' },
    'session-7': { blank: true },
  })
  const statuses = statusMap(
    ['session-0', { running: true }],
    ['session-1', { running: true, pendingInteraction: { kind: 'approval' } }],
    ['session-2', { running: false, completionUnread: true }],
    ['session-3', { running: false, completionUnread: false }],
    ['session-4', {}],
    ['session-5', {}],
  )
  const archived = ['session-4', 'session-5']
  return { list, statuses, archived }
}

test('the chips readout shows every visible metric with its own count', () => {
  const mounted = mount()
  const { list, statuses, archived } = fixture()
  const markup = renderRegistered(mounted, FOOTER_SLOT, STATUS_ID, standardHooks(list, archived, [], statuses))
  assert.match(markup, /data-variant="chips"/)
  for (const metric of ['running', 'unread', 'pending', 'idle', 'unarchived', 'archived']) {
    assert.match(markup, new RegExp('data-metric="' + metric + '"'), 'the ' + metric + ' chip is rendered')
  }
  assert.match(markup, /data-metric="running"[^>]*>[\s\S]*?sw-chip-count">1</)
  assert.match(markup, /data-metric="pending"[^>]*>[\s\S]*?sw-chip-count">1</)
  assert.match(markup, /data-metric="unread"[^>]*>[\s\S]*?sw-chip-count">1</)
  assert.match(markup, /data-metric="idle"[^>]*>[\s\S]*?sw-chip-count">1</)
  assert.match(markup, /data-metric="unarchived"[^>]*>[\s\S]*?sw-chip-count">4</)
  assert.match(markup, /data-metric="archived"[^>]*>[\s\S]*?sw-chip-count">2</)
})

test('only the enabled metrics are rendered', () => {
  const mounted = mount({ value: { showIdle: false, showArchived: false } })
  const { list, statuses, archived } = fixture()
  const markup = renderRegistered(mounted, FOOTER_SLOT, STATUS_ID, standardHooks(list, archived, [], statuses))
  assert.doesNotMatch(markup, /data-metric="idle"/)
  assert.doesNotMatch(markup, /data-metric="archived"/)
  assert.match(markup, /data-metric="running"/)
})

test('hiding every metric renders nothing at all', () => {
  const mounted = mount({
    value: {
      showRunning: false,
      showUnread: false,
      showPending: false,
      showIdle: false,
      showUnarchived: false,
      showArchived: false,
    },
  })
  const { list, statuses, archived } = fixture()
  const markup = renderRegistered(mounted, FOOTER_SLOT, STATUS_ID, standardHooks(list, archived, [], statuses))
  assert.equal(markup, '')
})

test('the unarchived metric turns warning-coloured past the threshold', () => {
  const { list, statuses, archived } = fixture()
  const above = mount({ threshold: 3 })
  const warned = renderRegistered(above, FOOTER_SLOT, STATUS_ID, standardHooks(list, archived, [], statuses))
  assert.match(warned, /data-metric="unarchived" data-warn="true"/)

  const below = mount({ threshold: 10 })
  const quiet = renderRegistered(below, FOOTER_SLOT, STATUS_ID, standardHooks(list, archived, [], statuses))
  assert.doesNotMatch(quiet, /data-metric="unarchived" data-warn="true"/)
})

test('the collapsed rail shows one mark with the unarchived count and the full name', () => {
  const mounted = mount()
  const { list, statuses, archived } = fixture()
  const markup = renderRegistered(mounted, FOOTER_SLOT, STATUS_ID, {
    wide: false,
    ...standardHooks(list, archived, [], statuses),
  })
  assert.match(markup, /class="sw-rail"/)
  assert.match(markup, /class="sw-rail-count"[^>]*>4</)
  assert.doesNotMatch(markup, /sw-chip/)
  assert.match(markup, /aria-label="会话状态：/)
  assert.match(markup, /未归档 4 个/)
})

test('the meter layout renders the bar and the same legend numbers', () => {
  const mounted = mount({ variant: 'meter' })
  const { list, statuses, archived } = fixture()
  const markup = renderRegistered(mounted, FOOTER_SLOT, STATUS_ID, standardHooks(list, archived, [], statuses))
  assert.match(markup, /data-variant="meter"/)
  assert.match(markup, /class="sw-meter-bar"/)
  assert.match(markup, /class="sw-meter-seg" data-metric="running"/)
  assert.match(markup, /data-metric="unarchived"[^>]*>[\s\S]*?sw-chip-count">4</)
})

test('the settings row offers every toggle, every layout, and the threshold input', () => {
  const mounted = mount({ threshold: 7, variant: 'grid' })
  const { list, statuses, archived } = fixture()
  const markup = renderRegistered(mounted, SETTINGS_SLOT, BELL_ID, standardHooks(list, archived, [], statuses))
  assert.match(markup, /会话状态读数/)
  for (const metric of ['running', 'unread', 'pending', 'idle', 'unarchived', 'archived']) {
    assert.match(markup, new RegExp('class="sw-toggle" data-metric="' + metric + '"'))
  }
  assert.match(markup, /class="sw-toggle sw-toggle-badge" data-metric="rowBadge"/, 'the durable row badge has its own switch')
  assert.match(markup, /重启后保留未读小标/, 'and says what it does')
  assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 7, 'one checkbox per metric plus the row badge')
  for (const label of ['胶囊', '比例条']) {
    assert.match(markup, new RegExp(label), 'the ' + label + ' layout control is offered')
  }
  assert.equal((markup.match(/sw-variant[" ]/g) ?? []).length, 2, 'exactly the two offered layouts render')
  assert.match(markup, /<input[^>]*type="number"/)
  assert.match(markup, /<input[^>]*value="7"/)
  assert.match(markup, /未归档会话阈值/)
})

test('the settings row localizes to English when the dictionary is bound', () => {
  const mounted = mount({ threshold: 7 })
  const markup = renderRegistered(mounted, SETTINGS_SLOT, BELL_ID, standardHooks(sessionRows(2)), 'en')
  assert.match(markup, /Session status readout/)
  assert.match(markup, /Unarchived session threshold/)
})
