// Contract test for the built browser half: the module-loader id, the exported
// apply/inject face, and the three registrations apply() performs (the bell,
// the status readout, and the namespace-gated settings row).
import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
after(() => { dom.window.close() })

const client = await import('../.test-build/client/index.js')
const {
  createWatchContext,
  root,
  pkg,
  FOOTER_SLOT,
  SETTINGS_SLOT,
  BELL_ID,
  STATUS_ID,
} = await import('./watch-harness.mjs')

const NS = 'unread-helper'

/** Mount the built client half against a fake Host and return its records. */
function mount(options = {}) {
  const mounted = createWatchContext(options)
  client.apply(mounted.ctx)
  return mounted
}

test('the browser module registers under the package name', () => {
  const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
  assert.match(source, /window\.__ModuleLoader__\.load\(\{/)
  assert.match(source, /id: "dsh-unread-helper"/)
  assert.equal(pkg.name, 'dsh-unread-helper')
})

test('the factory exports apply and the service inject list', () => {
  assert.equal(typeof client.apply, 'function')
  assert.ok(Array.isArray(client.inject))
  for (const service of ['slots', 'locale', 'configForms', 'sessions', 'uiSession', 'workspaces', 'uiWorkspace']) {
    assert.ok(client.inject.includes(service), 'inject must declare ' + service)
  }
})

test('applying registers the bell, the readout, the gated settings row, and both dictionaries', () => {
  const mounted = mount()

  assert.notEqual(document.querySelector('style[data-plugin="dsh-unread-helper"]'), null)

  assert.deepEqual(mounted.locales.map((entry) => entry.ns), [NS])
  assert.deepEqual(Object.keys(mounted.locales[0].dicts), ['zh', 'en'])
  assert.deepEqual(
    Object.keys(mounted.locales[0].dicts.zh).sort(),
    Object.keys(mounted.locales[0].dicts.en).sort(),
    'the English dictionary must mirror the Chinese key set',
  )

  const bell = mounted.byId(FOOTER_SLOT, BELL_ID)
  const readout = mounted.byId(FOOTER_SLOT, STATUS_ID)
  const settings = mounted.byId(SETTINGS_SLOT, NS)
  assert.notEqual(bell, undefined, 'the bell is registered')
  assert.notEqual(readout, undefined, 'the status readout is registered')
  assert.notEqual(settings, undefined, 'the settings row is registered')
  assert.equal(mounted.inSlot(FOOTER_SLOT).length, 2, 'the bell and the readout share the footer slot')
  assert.equal(mounted.inSlot(SETTINGS_SLOT).length, 1, 'the settings row is the only settings surface')
  assert.equal(typeof readout.component, 'function')
  assert.equal(typeof settings.component, 'function')

  const face = readout.options.inject()
  assert.equal(face.config.getSnapshot().threshold, 10)
  assert.equal(face.config.getSnapshot().variant, 'chips')
  assert.equal(typeof face.config.setThreshold, 'function')
  assert.equal(typeof face.config.setVisible, 'function')
  assert.equal(typeof face.config.setVariant, 'function')
})

test('the config source writes the Config field that matches a metric', async () => {
  const mounted = mount()
  const face = mounted.byId(FOOTER_SLOT, STATUS_ID).options.inject()
  face.config.setVisible('idle', false)
  face.config.setVariant('meter')
  face.config.setThreshold(20)
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(mounted.writes, [
    ['showIdle', false],
    ['variant', 'meter'],
    ['threshold', 20],
  ])
})

test('a deployment without the config namespace still shows the readout', () => {
  const mounted = mount({ serveNamespace: false })
  assert.equal(mounted.byId(FOOTER_SLOT, BELL_ID) !== undefined, true)
  assert.equal(mounted.byId(FOOTER_SLOT, STATUS_ID) !== undefined, true)
  assert.equal(mounted.inSlot(SETTINGS_SLOT).length, 0, 'the settings row must not register')
})

test('the readout stays an injectable list occupant next to the bell', () => {
  const mounted = mount()
  const bell = mounted.byId(FOOTER_SLOT, BELL_ID)
  const readout = mounted.byId(FOOTER_SLOT, STATUS_ID)
  assert.equal(typeof readout.options.order, 'number')
  assert.equal(typeof readout.options.inject, 'function')
  assert.equal(typeof readout.options.inject().config.getSnapshot(), 'object')
  assert.equal(readout.options.order, bell.options.order - 10, 'the readout leads the bell in the footer action list')
})
