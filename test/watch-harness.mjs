/**
 * Shared helpers for the status-readout tests: snapshot fixtures, the standard
 * selector-hook doubles, a fake client context that records what the built
 * client half registers, and a translate function over the registered
 * dictionary.
 *
 * The readout and its settings row are driven through the real registrations
 * the client module performs, so a missing registration or a locale key that
 * drifted fails here rather than in the browser.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = dirname(dirname(fileURLToPath(import.meta.url)))
export const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Slot entry ids the merged client half registers. */
export const BELL_ID = 'unread-helper'
export const STATUS_ID = 'unread-helper.status'
export const SETTINGS_SLOT = 'settings.general.item'
export const FOOTER_SLOT = 'sidebar.footer.action'

/** Build a Session list snapshot of `count` ordinary rows. */
export function sessionRows(count, variants = {}) {
  const ids = []
  const byId = {}
  for (let index = 0; index < count; index += 1) {
    const id = 'session-' + String(index)
    ids.push(id)
    byId[id] = variants[id] ?? {}
  }
  return { ids, byId }
}

/** Build a Session status map from [id, status] pairs. */
export function statusMap(...rows) {
  return new Map(rows)
}

/** Fake standard selector hooks over a Session list, an archive set, and statuses. */
export function standardHooks(list, archived = [], items = [], statuses = new Map()) {
  const workspaces = { archivedSessionIds: archived, items }
  return {
    useSessions: (selector) => selector(list),
    useSessionStatus: (selector) => selector(statuses),
    useWorkspaces: (selector) => selector(workspaces),
  }
}

/**
 * Fake client context recording every registration, dictionary, effect
 * disposer, and config write the built client half performs.
 * @param options - threshold / variant / visibility / namespace overrides.
 */
export function createWatchContext(options = {}) {
  const registrations = []
  const locales = []
  const effects = []
  const writes = []
  const injections = []
  const value = {
    threshold: options.threshold ?? 10,
    variant: options.variant ?? 'chips',
    ...(options.value ?? {}),
  }
  const form = {
    getSnapshot: () => ({ value }),
    subscribe: () => () => {},
    set: async (field, next) => {
      writes.push([field, next])
      return options.acceptWrites === false ? false : true
    },
  }
  const sessions = options.sessions ?? { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} }
  const workspaces = options.workspaces ?? { getSnapshot: () => ({ items: [], archivedSessionIds: [] }), subscribe: () => () => {} }
  const statuses = options.statuses ?? { getSnapshot: () => new Map(), subscribe: () => () => {} }
  const ctx = {
    effect(callback, label) {
      effects.push(label)
      const disposer = callback()
      return () => { if (typeof disposer === 'function') disposer() }
    },
    slots: {
      inject(key, callback) {
        injections.push(key)
        const disposer = callback()
        return () => { if (typeof disposer === 'function') disposer() }
      },
      register(slotOptions, component) {
        registrations.push({ options: slotOptions, component })
        return () => {
          const index = registrations.findIndex((entry) => entry.options === slotOptions)
          if (index >= 0) registrations.splice(index, 1)
        }
      },
    },
    locale: {
      register(ns, dicts) {
        locales.push({ ns, dicts })
        return () => {}
      },
      bind(ns) {
        return (key, params) => translateFrom(locales.find((entry) => entry.ns === ns)?.dicts.zh ?? {}, key, params)
      },
    },
    shortcuts: { register: () => () => {} },
    get(name) {
      if (name === 'sessions') return { list: sessions }
      if (name === 'workspaces') return { list: workspaces }
      return undefined
    },
    uiSession: { sessionStatus: statuses },
    uiWorkspace: {
      openSession() {},
      pinSession() { return Promise.resolve() },
      unpinSession() { return Promise.resolve() },
      archiveSession() { return Promise.resolve() },
    },
    configForms: {
      get() { return form },
      whileServed(namespaces, register) {
        if (options.serveNamespace === false) return () => {}
        const disposer = register(new Set(namespaces))
        return () => { if (typeof disposer === 'function') disposer() }
      },
    },
  }
  return {
    ctx,
    registrations,
    locales,
    effects,
    writes,
    injections,
    form,
    byId(name, id) {
      return registrations.find((entry) => entry.options.name === name && entry.options.id === id)
    },
    inSlot(name) {
      return registrations.filter((entry) => entry.options.name === name)
    },
  }
}

function translateFrom(dict, key, params) {
  const template = dict[key]
  if (template === undefined) return key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name]))
}

/** Build a translate function over the registered dictionary of one locale. */
export function translate(mounted, locale = 'zh') {
  const dicts = mounted.locales[0]?.dicts?.[locale] ?? {}
  return (key, params) => translateFrom(dicts, key, params)
}
