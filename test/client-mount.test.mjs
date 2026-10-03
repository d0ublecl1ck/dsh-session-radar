/**
 * Client-lane test: mount the plugin's real client half against minimal fake
 * services (the session list, the Session UI status snapshot, and the
 * Workspace registry are plain objects), with the real sidebar anchor logic
 * and the real activity projection behind it.
 */
import assert from 'node:assert/strict'
import test, { after } from 'node:test'


// The DOM must exist before react-dom and the component are imported.
const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.Node = window.Node
// `navigator` is a getter-only global on modern node; redefine it for React DOM.
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.MutationObserver = window.MutationObserver
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Primitives the shell's own browser tests stub the same way: neither observer
// exists in jsdom and neither is load-bearing for these assertions.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { apply } = await import('../.test-build/client/index.js')
const { zh } = await import('../.test-build/client/locales.js')
const { buildSidebar } = await import('./sidebar-fixture.mjs')
const { WORKSPACE_VIEW_STORAGE_KEY } = await import('../.test-build/client/manual-unread.js')

/**
 * Mirror what the real UiWorkspaceService.openSession does to the Workspace
 * browser's private view store: opening a Session clears its manual unread
 * mark, which our bridge then reads back out of localStorage.
 */
function clearManualUnread(sessionId) {
  const raw = window.localStorage.getItem(WORKSPACE_VIEW_STORAGE_KEY)
  if (raw === null) return
  try {
    const document_ = JSON.parse(raw)
    window.localStorage.setItem(WORKSPACE_VIEW_STORAGE_KEY, JSON.stringify({
      ...document_,
      unreadSessionIds: (document_.unreadSessionIds ?? []).filter(id => id !== sessionId),
    }))
  } catch {
    // A hostile value is not the test's concern.
  }
}

// jsdom's visual mode owns a requestAnimationFrame loop; closing the window
// after the lane releases the event loop so the runner can exit.
after(() => { dom.window.close() })

/** Local-date instant, so the day buckets are deterministic in any timezone. */
function localAt(daysAgo, hour, minute = 0) {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour, minute).getTime()
}

const SESSIONS = [
  { id: 's1', displayTitle: '生成软著申请资料', blank: false, running: false, updatedAt: localAt(0, 9) },
  { id: 's2', displayTitle: '排查漏损计算时间因子错误', blank: false, running: false, updatedAt: localAt(1, 9) },
  { id: 's3', displayTitle: '对比新旧分区库结构差异', blank: false, running: true, updatedAt: localAt(0, 12) },
  { id: 's4', displayTitle: '', blank: true, running: false, updatedAt: localAt(0, 13) },
  { id: 's5', displayTitle: '子代理会话', blank: false, origin: 'subagent', running: false, updatedAt: localAt(0, 8) },
  { id: 's6', displayTitle: '已完成未查看但已归档', blank: false, running: false, updatedAt: localAt(0, 7), cwd: '/host/projects/zone-meter' },
]

const STATUSES = new Map([
  ['s1', { running: false, completionUnread: true }],
  ['s2', { running: false, completionUnread: true }],
  ['s3', { running: true, completionUnread: false }],
  ['s6', { running: false, completionUnread: true }],
])

const WORKSPACES = {
  items: [
    { workspaceId: 'w1', title: 'game', path: '/host/game', sessionIds: ['s1'] },
    { workspaceId: 'w2', title: 'iot-platform', path: '/host/iot-platform', sessionIds: ['s2'] },
    { workspaceId: 'w3', title: 'test', path: '/host/test', sessionIds: ['s3'] },
    { workspaceId: 'w4', title: 'archived-ws', path: '/host/archived', sessionIds: ['s6'] },
  ],
  archivedSessionIds: ['s6'],
}

/** Observable snapshot double with the DSH shape. */
function source(value) {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

/** Observable double the test can push updates through. */
function mutableSource(initial) {
  let value = initial
  const listeners = new Set()
  return {
    source: {
      getSnapshot: () => value,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    set(next) {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Minimal client context double that records what `apply` registers. */
function fakeContext(values = {}) {
  const disposers = []
  const opened = []
  // A plugin may register more than one action; keep them all and let the
  // tests address the bell by its id instead of by registration order.
  const registrations = new Map()
  // The shortcut registry is plugin-scope: `apply` registers one command, so
  // the double keeps the latest registration by id for the integration test.
  const shortcutCommands = new Map()
  const sessions = values.sessions ?? source({
    ids: SESSIONS.map(row => row.id),
    byId: Object.fromEntries(SESSIONS.map(row => [row.id, row])),
    phase: 'ready',
  })
  const statuses = values.statuses ?? source(STATUSES)
  const workspaces = values.workspaces ?? source(WORKSPACES)
  const ctx = {
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    locale: { register: () => () => {}, bind: () => translate },
    shortcuts: {
      register(command) {
        shortcutCommands.set(command.id, command)
        return () => { shortcutCommands.delete(command.id) }
      },
    },
    slots: {
      inject(_name, factory) { return factory() },
      register(options, component) {
        registrations.set(options.id, { options, component })
        return () => { registrations.delete(options.id) }
      },
    },
    get(name) {
      return name === 'sessions' ? { list: sessions } : { list: workspaces }
    },
    uiSession: { sessionStatus: statuses },
    uiWorkspace: {
      openSession: (sessionId) => {
        opened.push(['open', sessionId])
        // The real UiWorkspaceService.openSession clears the browser's manual
        // unread mark; the double mirrors it so the badge settles like it does.
        clearManualUnread(sessionId)
      },
      pinSession: (sessionId) => { opened.push(['pin', sessionId]); return Promise.resolve() },
      unpinSession: (sessionId) => { opened.push(['unpin', sessionId]); return Promise.resolve() },
      // The host refuses a plain archive while work still runs; the panel shows
      // its notice instead of pretending the row left the list.
      archiveSession: (sessionId) => { opened.push(['archive', sessionId]); return Promise.reject(new Error('busy')) },
    },
  }
  return {
    ctx,
    disposers,
    opened,
    get captured() { return registrations.get('unread-helper') },
    get all() { return registrations },
    shortcut(id) { return shortcutCommands.get(id) },
  }
}

/** Build the conversation column's chat region, as the shipped shell renders it. */
function buildConversation(document, sessionId, { followingTail = true } = {}) {
  const region = document.createElement('div')
  region.setAttribute('data-conversation-region', 'chat')
  region.setAttribute('data-conversation-session', sessionId)
  const scroll = document.createElement('div')
  scroll.setAttribute('data-conversation-scroll', '')
  const root = document.createElement('div')
  if (followingTail) root.setAttribute('data-chat-following-tail', '')
  scroll.appendChild(root)
  region.appendChild(scroll)
  document.body.appendChild(region)
  return { region, root }
}

/** Two frames: one for the mutation observer, one for the frame it schedules. */
function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Bind the plugin's own Chinese dictionary, so a missing key fails the test. */
function translate(key, params) {
  const template = zh[key]
  assert.ok(template !== undefined, `missing locale key: ${key}`)
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name]))
}

/** Render one tree and return the handle plus a click helper. */
async function mount(element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await React.act(async () => { root.render(element) })
  return {
    container,
    async render(next) {
      await React.act(async () => { root.render(next) })
    },
    async click(node) {
      await React.act(async () => {
        node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    },
    async contextMenu(node) {
      await React.act(async () => {
        node.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      })
    },
    async press(node) {
      await React.act(async () => {
        node.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      })
    },
    async unmount() {
      await React.act(async () => { root.unmount() })
      container.remove()
    },
  }
}

test('the client half registers one sidebar foot action and injects the framework sources', () => {
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  assert.equal(handle.all.size, 1, 'the chip was removed: the bell is the only registered action')
  assert.equal(captured().options.name, 'sidebar.footer.action')
  assert.equal(captured().options.id, 'unread-helper')
  assert.equal(captured().options.locale, 'unread-helper')
  const injected = captured().options.inject()
  assert.deepEqual(Object.keys(injected).sort(), [
    'archiveSession', 'askJump', 'ledger', 'openSession', 'pinSession', 'sessions', 'statuses',
    'unpinSession', 'unreadJump', 'workspaces',
  ])
  assert.equal(document.querySelector('style[data-plugin="dsh-unread-helper"]') !== null, true)
  for (const dispose of [...disposers].reverse()) dispose()
  assert.equal(document.querySelector('style[data-plugin="dsh-unread-helper"]'), null)
})

test('the bell renders beside the search control with the unread badge', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  const bell = document.querySelector('.ab-bell')
  assert.ok(bell, 'the bell mounts into the sidebar header')
  assert.equal(bell.parentElement.parentElement, shell.header)
  assert.equal(bell.parentElement.previousElementSibling, shell.searchSlot, 'the bell sits beside the search control')
  assert.equal(bell.parentElement.nextElementSibling, shell.actions)
  assert.equal(bell.getAttribute('aria-pressed'), 'false')
  assert.equal(bell.getAttribute('aria-label'), '定位下一个未读，2 个会话已完成未查看')
  assert.equal(document.querySelector('.ab-badge').textContent, '2')
  assert.equal(document.querySelector('.ab-panel'), null)

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
  assert.equal(document.querySelector('.ab-bell'), null)
  assert.equal(document.querySelector('.ab-bell-host'), null)
  assert.equal(document.querySelector('style[data-plugin="dsh-unread-helper"]'), null)
  assert.equal(shell.header.children.length, 3, 'the shell keeps only its own children')
})

test('right-clicking the bell swaps in the day-grouped activity list and back', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, opened, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  await view.contextMenu(document.querySelector('.ab-bell'))
  const panel = document.querySelector('.ab-panel')
  assert.ok(panel, 'the panel replaces the workspace list')
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-pressed'), 'true')
  assert.equal(document.querySelector('.ab-bell').className, 'ab-bell ab-bell-active')
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-label'), '打开最近活动')
  assert.equal(panel.parentElement.parentElement, shell.listArea, 'the panel covers the list seat')
  assert.equal(shell.list.inert, true, 'the covered rows leave the tab order')

  assert.deepEqual(
    [...panel.querySelectorAll('.ab-group-label')].map(node => node.textContent),
    ['今天', '昨天'],
  )
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row')].map(node => node.querySelector('.ab-row-title').textContent),
    ['对比新旧分区库结构差异', '生成软著申请资料', '排查漏损计算时间因子错误'],
  )
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row-folder-text')].map(node => node.textContent),
    ['test', 'game', 'iot-platform'],
  )
  // Rows carry their status for assistive tech: finished-unviewed first.
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row')].map(node => node.querySelector('.ab-sr-only')?.textContent ?? null),
    ['运行中', '已完成未查看', '已完成未查看'],
  )
  // The finished-unviewed rows render the shipped green "done" dot; running
  // rows render the ongoing loader dot.
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row [data-state-dot]')].map(node => node.getAttribute('data-state-dot')),
    ['ongoing', 'done', 'done'],
  )
  // The panel is the list and nothing else: no added heading, no extra
  // affordance above the day sections.
  assert.equal(panel.querySelector('.ab-panel-head'), null)
  assert.equal(panel.textContent.startsWith('今天'), true, 'the first day section leads the panel')
  assert.equal(panel.textContent.includes('最近活动'), false, 'no added title copy')
  assert.equal(panel.textContent.includes('全部已读'), false)
  assert.doesNotMatch(panel.textContent, /子代理会话/, 'subagent rows stay hidden')
  assert.doesNotMatch(panel.textContent, /已完成未查看但已归档/, 'archived rows stay hidden')

  // Every row keeps the shipped row affordances: pin and archive, revealed on
  // hover/focus, acting without opening the session.
  const firstRow = panel.querySelector('.ab-row')
  assert.deepEqual(
    [...firstRow.querySelectorAll('.ab-icon-button')].map(node => node.getAttribute('aria-label')),
    ['置顶', '归档'],
  )
  await view.click(firstRow.querySelector('.ab-icon-button'))
  assert.deepEqual(opened, [['pin', 's3']], 'the pin affordance does not open the session')
  await view.click(firstRow.querySelectorAll('.ab-icon-button')[1])
  assert.deepEqual(opened, [['pin', 's3'], ['archive', 's3']])
  assert.equal(
    panel.querySelector('.ab-panel-notice').textContent,
    '归档失败：该会话还有运行中的工作',
    'a refused archive says so instead of dropping the row',
  )

  await view.click(panel.querySelector('.ab-row'))
  assert.deepEqual(opened, [['pin', 's3'], ['archive', 's3'], ['open', 's3']], 'a row opens its session')
  assert.equal(document.querySelector('.ab-badge').textContent, '2', 'opening does not touch other rows')

  await view.contextMenu(document.querySelector('.ab-bell'))
  assert.equal(document.querySelector('.ab-panel'), null)
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-pressed'), 'false')
  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '定位下一个未读，2 个会话已完成未查看',
    'the closed bell falls back to the unread label',
  )
  assert.equal(shell.list.inert, false, 'the restored rows rejoin the tab order')
  assert.equal(
    document.querySelector('.ab-panel-host'),
    null,
    'a closed activity list leaves no hit target over the workspace list',
  )

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
  assert.equal(document.body.textContent.includes('最近活动'), false)
})

test('Escape closes the activity list', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  await view.contextMenu(document.querySelector('.ab-bell'))
  assert.ok(document.querySelector('.ab-panel'))
  await React.act(async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  assert.equal(document.querySelector('.ab-panel'), null)
  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('a press on neighbouring sidebar chrome hands the region back', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  await view.contextMenu(document.querySelector('.ab-bell'))
  assert.ok(document.querySelector('.ab-panel'))
  // A neighbouring plugin's tab must not end up under the activity list.
  await view.press(shell.tab)
  assert.equal(document.querySelector('.ab-panel'), null, 'the region goes back to the other surface')
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-pressed'), 'false')

  // Pressing the activity surface itself keeps it open, and so does a press in
  // the conversation column (outside the sidebar).
  await view.contextMenu(document.querySelector('.ab-bell'))
  const row = document.querySelector('.ab-row')
  await view.press(row)
  assert.ok(document.querySelector('.ab-panel'), 'the list survives its own presses')
  await view.press(document.body)
  assert.ok(document.querySelector('.ab-panel'), 'the conversation column does not close the list')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('a turn seen finishing raises the badge until its Session is opened', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const statuses = mutableSource(new Map())
  const one = [{
    id: 's1',
    displayTitle: '跑任务的会话',
    blank: false,
    running: false,
    updatedAt: Date.now(),
    retainedBy: { mainView: 1 },
  }]
  const handle = fakeContext({
    statuses: statuses.source,
    sessions: source({
      ids: one.map(row => row.id),
      byId: Object.fromEntries(one.map(row => [row.id, row])),
      phase: 'ready',
    }),
    workspaces: source({ items: [], archivedSessionIds: [] }),
  })
  const { ctx, disposers, opened } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  assert.equal(document.querySelector('.ab-badge'), null)

  const running = new Map([['s1', { running: true, completionUnread: false }]])
  await React.act(async () => { statuses.set(running) })
  assert.equal(document.querySelector('.ab-badge'), null, 'a running turn is not a completion')

  const stopped = new Map([['s1', { running: false, completionUnread: false }]])
  await React.act(async () => { statuses.set(stopped) })
  assert.equal(document.querySelector('.ab-badge').textContent, '1')
  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '定位下一个未读，1 个会话已完成未查看',
  )

  await view.contextMenu(document.querySelector('.ab-bell'))
  const row = document.querySelector('.ab-row')
  assert.equal(
    row.className,
    'ab-row ab-row-current',
    'the open Session carries the shipped selected fill',
  )
  assert.deepEqual(
    [...row.querySelectorAll('[data-state-dot]')].map(node => node.getAttribute('data-state-dot')),
    ['done'],
  )
  await view.click(row)
  assert.deepEqual(opened, [['open', 's1']])
  assert.equal(document.querySelector('.ab-badge'), null, 'opening the Session acknowledges it')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('the collapsed sidebar drops the bell and closes the activity list', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const element = (wide) => React.createElement(captured().component, { wide, t: translate, ...injected })
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  await view.contextMenu(document.querySelector('.ab-bell'))
  assert.ok(document.querySelector('.ab-panel'))

  await view.render(element(false))
  assert.equal(document.querySelector('.ab-bell'), null)
  assert.equal(document.querySelector('.ab-panel'), null)

  await view.render(element(true))
  assert.ok(document.querySelector('.ab-bell'), 'the bell returns on expand')
  assert.equal(document.querySelector('.ab-panel'), null, 'the activity list does not reopen by itself')
  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('clicking the bell reveals and opens the next unread Session, wrapping around', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, opened, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  // The sidebar renders both unread Sessions as rows, in the jump order the
  // activity projection already sorted them into.
  const revealed = new Map()
  for (const id of ['s1', 's2']) {
    const row = document.createElement('div')
    row.setAttribute('data-row-key', 'session:' + id)
    let count = 0
    row.scrollIntoView = () => { count += 1 }
    revealed.set(id, () => count)
    shell.list.appendChild(row)
  }

  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '定位下一个未读，2 个会话已完成未查看',
  )

  await view.click(document.querySelector('.ab-bell'))
  assert.deepEqual(opened, [['open', 's1']], 'the first press lands on the first unread Session')
  assert.equal(revealed.get('s1')(), 1, 'the row is scrolled into view')

  await view.click(document.querySelector('.ab-bell'))
  assert.deepEqual(opened, [['open', 's1'], ['open', 's2']], 'the second press advances')

  await view.click(document.querySelector('.ab-bell'))
  assert.deepEqual(
    opened,
    [['open', 's1'], ['open', 's2'], ['open', 's1']],
    'the walk wraps back to the first unread Session',
  )

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('the registered unread-jump shortcut runs the bell\'s jump', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, opened, disposers } = handle
  const captured = () => handle.captured
  apply(ctx)

  const command = handle.shortcut('unread-helper.jumpUnread')
  assert.ok(command, 'apply registers the unread-jump command')
  assert.equal(command.label(), '定位下一个未读')
  assert.deepEqual(command.defaults, {
    'desktop:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
    'desktop:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
    'desktop:linux': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
    'web:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
    'web:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
  })
  // Before the bell mounts there is nothing to jump with.
  assert.deepEqual(
    command.resolve({ region: 'page', modal: null, target: null }),
    { status: 'blocked', reason: '没有未读会话' },
  )

  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  const revealed = []
  for (const id of ['s1', 's2']) {
    const row = document.createElement('div')
    row.setAttribute('data-row-key', 'session:' + id)
    row.scrollIntoView = () => { revealed.push(id) }
    shell.list.appendChild(row)
  }

  const resolution = command.resolve({ region: 'page', modal: null, target: null })
  assert.equal(resolution.status, 'handled')
  resolution.run()
  assert.deepEqual(opened, [['open', 's1']], 'the shortcut lands on the next unread Session')
  assert.deepEqual(revealed, ['s1'], 'the shortcut also reveals the sidebar row')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('a Session marked unread by hand raises the badge until it is opened', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  window.localStorage.removeItem(WORKSPACE_VIEW_STORAGE_KEY)
  const rows = [
    { id: 's1', displayTitle: '手动标记未读', blank: false, running: false, updatedAt: localAt(0, 9) },
    { id: 's2', displayTitle: '普通会话', blank: false, running: false, updatedAt: localAt(0, 8) },
  ]
  const handle = fakeContext({
    sessions: source({
      ids: rows.map(row => row.id),
      byId: Object.fromEntries(rows.map(row => [row.id, row])),
      phase: 'ready',
    }),
    statuses: source(new Map()),
    workspaces: source({ items: [], archivedSessionIds: [] }),
  })
  const { ctx, opened, disposers } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  assert.equal(document.querySelector('.ab-badge'), null, 'the store holds no manual mark yet')

  await React.act(async () => {
    window.localStorage.setItem(
      WORKSPACE_VIEW_STORAGE_KEY,
      JSON.stringify({ groupBy: 'workspace', unreadSessionIds: ['s1'] }),
    )
  })
  assert.equal(document.querySelector('.ab-badge').textContent, '1')
  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '定位下一个未读，1 个会话已完成未查看',
  )

  await view.contextMenu(document.querySelector('.ab-bell'))
  const row = document.querySelector('.ab-row')
  assert.equal(row.querySelector('.ab-row-title').textContent, '手动标记未读')
  assert.equal(row.querySelector('.ab-sr-only').textContent, '标为未读')

  await view.click(row)
  assert.deepEqual(opened, [['open', 's1']])
  assert.equal(document.querySelector('.ab-badge'), null, 'opening clears the manual mark')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
  window.localStorage.removeItem(WORKSPACE_VIEW_STORAGE_KEY)
})

test('a completion is unread while scrolled up and read once the conversation reaches its tail', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const badge = () => document.querySelector('.ab-badge')?.textContent ?? null
  const statuses = mutableSource(new Map())
  const row = {
    id: 's1', displayTitle: '当前对话', blank: false, running: false,
    updatedAt: Date.now(), retainedBy: { mainView: 1 },
  }
  const handle = fakeContext({
    statuses: statuses.source,
    sessions: source({ ids: ['s1'], byId: { s1: row }, phase: 'ready' }),
    workspaces: source({ items: [], archivedSessionIds: [] }),
  })
  const { ctx, disposers } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const conversation = buildConversation(document, 's1', { followingTail: false })
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  assert.equal(badge(), null)

  // A turn ends while the operator reads history above the tail.
  await React.act(async () => { statuses.set(new Map([['s1', { running: true, completionUnread: false }]])) })
  await React.act(async () => { statuses.set(new Map([['s1', { running: false, completionUnread: false }]])) })
  assert.equal(badge(), '1', 'new content below is unread')

  // Reaching the tail reads it, and reading is permanent.
  await React.act(async () => {
    conversation.root.setAttribute('data-chat-following-tail', '')
    await nextFrame()
  })
  assert.equal(badge(), null, 'the tail is read')
  await React.act(async () => {
    conversation.root.removeAttribute('data-chat-following-tail')
    await nextFrame()
  })
  assert.equal(badge(), null, 'a read completion does not come back')

  // A turn watched to completion at the tail never raises the badge.
  await React.act(async () => {
    conversation.root.setAttribute('data-chat-following-tail', '')
    await nextFrame()
  })
  await React.act(async () => { statuses.set(new Map([['s1', { running: true, completionUnread: false }]])) })
  await React.act(async () => { statuses.set(new Map([['s1', { running: false, completionUnread: false }]])) })
  assert.equal(badge(), null, 'a completion at the tail never badges')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('a conversation at its tail tells the host ledger the Session is read', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const row = {
    id: 's1', displayTitle: '当前对话', blank: false, running: false,
    updatedAt: Date.now(), retainedBy: { mainView: 1 },
  }
  const empty = {
    now: Date.now(), unread: [],
  }
  const listed = { ...empty, unread: [{ sessionId: 's1', at: Date.now(), kind: 'completed' }] }
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    calls.push({
      target,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    })
    return { json: async () => ({ ok: true, value: target.endsWith('/read') ? empty : listed }) }
  }
  try {
    const handle = fakeContext({
      sessions: source({ ids: ['s1'], byId: { s1: row }, phase: 'ready' }),
      statuses: source(new Map()),
      workspaces: source({ items: [], archivedSessionIds: [] }),
    })
    const { ctx, disposers } = handle
    const captured = () => handle.captured
    apply(ctx)
    const injected = captured().options.inject()
    buildConversation(document, 's1', { followingTail: true })
    const view = await mount(React.createElement(captured().component, {
      wide: true, t: translate, ...injected,
    }))
    await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    assert.equal(document.querySelector('.ab-badge'), null, 'the tail never badges')
    assert.ok(
      calls.some(call => call.target.endsWith('/unread-helper/read') && call.body?.sessionId === 's1'),
      'the host ledger is told the Session is read',
    )

    await view.unmount()
    for (const dispose of [...disposers].reverse()) dispose()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a session awaiting the operator raises a warning badge apart from the unread badge', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const sessions = [
    { id: 'a', displayTitle: 'A', blank: false, running: false, updatedAt: localAt(0, 12), retainedBy: { mainView: 1 } },
    { id: 'b', displayTitle: 'B', blank: false, running: false, updatedAt: localAt(0, 11) },
    { id: 'c', displayTitle: 'C', blank: false, running: false, updatedAt: localAt(0, 10) },
  ]
  const statuses = new Map([
    ['a', { running: false, completionUnread: true }],
    ['b', { running: false, completionUnread: false, pendingInteraction: { kind: 'question' } }],
    ['c', { running: false, completionUnread: false, pendingInteraction: { kind: 'approval' } }],
  ])
  const handle = fakeContext({
    sessions: source({
      ids: sessions.map(row => row.id),
      byId: Object.fromEntries(sessions.map(row => [row.id, row])),
      phase: 'ready',
    }),
    statuses: source(statuses),
    workspaces: source({ items: [], archivedSessionIds: [] }),
  })
  const { ctx, disposers } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  // The red badge keeps counting unread completions; the asks get their own
  // warning-coloured badge so the two reminders never blur into one number.
  assert.equal(document.querySelector('.ab-badge').textContent, '1', 'the unread badge is untouched')
  const askBadge = document.querySelector('.ab-badge-ask')
  assert.ok(askBadge, 'the pending asks carry their own badge')
  assert.equal(askBadge.textContent, '2')
  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '定位下一个未读，1 个会话已完成未查看 · 等待你处理 2 个',
  )

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('the O shortcut walks the pending asks and retraces the path back', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  let value = {
    ids: ['a', 'b', 'c'],
    byId: {
      a: { id: 'a', displayTitle: 'A', blank: false, running: false, updatedAt: localAt(0, 10), retainedBy: { mainView: 1 } },
      b: { id: 'b', displayTitle: 'B', blank: false, running: false, updatedAt: localAt(0, 11) },
      c: { id: 'c', displayTitle: 'C', blank: false, running: false, updatedAt: localAt(0, 12) },
    },
    phase: 'ready',
  }
  const sessionsState = mutableSource(value)
  const statusesState = mutableSource(new Map([
    ['b', { running: false, completionUnread: false, pendingInteraction: { kind: 'question' } }],
    ['c', { running: false, completionUnread: false, pendingInteraction: { kind: 'question' } }],
  ]))
  const handle = fakeContext({
    sessions: sessionsState.source,
    statuses: statusesState.source,
    workspaces: source({ items: [], archivedSessionIds: [] }),
  })
  const { ctx, opened, disposers } = handle
  // The real openSession moves mainView; the double mirrors that so the walk
  // can tell where it currently stands.
  ctx.uiWorkspace.openSession = (sessionId) => {
    opened.push(['open', sessionId])
    value = {
      ...value,
      byId: Object.fromEntries(Object.entries(value.byId).map(([id, row]) => [
        id, { ...row, retainedBy: { mainView: id === sessionId ? 1 : 0 } },
      ])),
    }
    sessionsState.set(value)
  }
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  const command = handle.shortcut('unread-helper.jumpAsk')
  assert.ok(command, 'apply registers the ask-jump command')
  const press = async () => {
    const resolution = command.resolve({ region: 'page', modal: null, target: null })
    if (resolution.status === 'handled') await React.act(async () => { resolution.run() })
    return resolution
  }

  // A is where the operator was; B and C both wait. B asked first, so it leads.
  await press()
  assert.deepEqual(opened, [['open', 'b']], 'the first press lands on the earliest pending ask')
  assert.equal(
    document.querySelector('.ab-badge-ask').textContent,
    '2',
    'opening an ask does not answer it: the badge waits for the real reply',
  )

  // The operator answers B: the framework clears its pending interaction.
  await React.act(async () => {
    statusesState.set(new Map([
      ['c', { running: false, completionUnread: false, pendingInteraction: { kind: 'question' } }],
    ]))
  })
  assert.equal(document.querySelector('.ab-badge-ask').textContent, '1')

  await press()
  assert.deepEqual(
    opened,
    [['open', 'b'], ['open', 'c']],
    'with another ask open the press follows the queue',
  )

  // C is answered too; nothing waits any more.
  await React.act(async () => { statusesState.set(new Map()) })
  assert.equal(document.querySelector('.ab-badge-ask'), null, 'a cleared ask drops out of the badge')

  await press()
  assert.deepEqual(
    opened,
    [['open', 'b'], ['open', 'c'], ['open', 'b']],
    'with no ask left it returns to the session it came from',
  )

  await press()
  assert.deepEqual(
    opened,
    [['open', 'b'], ['open', 'c'], ['open', 'b'], ['open', 'a']],
    'and then to the one before that',
  )

  assert.deepEqual(
    await press(),
    { status: 'blocked', reason: '没有等待处理的会话' },
    'an exhausted trail leaves nothing to jump to',
  )

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})
