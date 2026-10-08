/**
 * Manual-unread bridge: the Session mark the operator sets by hand.
 *
 * The framework's `completionUnread` covers a Session that finished while the
 * operator was somewhere else, and this plugin's own completion edges cover the
 * ones watched live, but neither sees the row menu's "mark unread". That mark is
 * not part of any published snapshot: the Workspace browser
 * (`@deepseek-ai/dsh-client-ui-workspace`) keeps it in its private view store,
 * which is whole-value JSON persisted to `localStorage` under a versioned key.
 * This module is the one place that reads that key, so the rest of the plugin
 * keeps consuming plain sets.
 *
 * A same-document write fires no `storage` event, so the watcher also wraps the
 * storage write methods (restored on dispose) and answers the Desktop shell's
 * own `__dsh_storage_sync__` channel. Both triggers only re-read the key and
 * notify when the id set actually changed.
 *
 * @module dsh-session-radar/client/manual-unread
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The Workspace browser's persisted view-store key. */
export const WORKSPACE_VIEW_STORAGE_KEY = 'dsh.workspace.view.v5'

/** The Desktop shell's same-document storage-sync event. */
export const DESKTOP_STORAGE_SYNC_EVENT = '__dsh_storage_sync__'

/** The read face of a storage device. */
export interface ManualUnreadStorage {
  getItem(key: string): string | null
}

/** The write face the watcher wraps; the shape of `Storage.prototype`. */
interface WritableStorage {
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
}

/** Shared empty answer; callers treat it as immutable. */
const NONE: ReadonlySet<SessionId> = new Set<SessionId>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read the manual-unread ids out of a persisted view-store document.
 *
 * A missing, non-JSON, or oddly shaped value yields the empty set: a corrupt
 * store must never hide real reminders or throw in a render pass.
 *
 * @param raw - the stored document, as `localStorage.getItem` returned it.
 * @returns the marked Session ids, deduplicated.
 */
export function parseManualUnread(raw: string | null): ReadonlySet<SessionId> {
  if (raw === null) return NONE
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NONE
  }
  if (!isRecord(parsed)) return NONE
  const ids = parsed.unreadSessionIds
  if (!Array.isArray(ids)) return NONE
  const marked = new Set<SessionId>()
  for (const id of ids) {
    if (typeof id === 'string' && id !== '') marked.add(id as SessionId)
  }
  return marked
}

/** The page's own localStorage, when there is a page. */
function defaultStorage(): ManualUnreadStorage | undefined {
  try {
    const page = typeof window === 'undefined' ? undefined : window
    if (page?.localStorage !== undefined) return page.localStorage
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    // A blocked storage area (sandboxed frame, storage disabled) is just no set.
    return undefined
  }
}

/**
 * Read the browser's current manual-unread set.
 *
 * @param storage - storage to read; defaults to the page's `localStorage`.
 * @returns the marked Session ids, empty when the store is absent or unreadable.
 */
export function readManualUnread(
  storage: ManualUnreadStorage | undefined = defaultStorage(),
): ReadonlySet<SessionId> {
  if (storage === undefined) return NONE
  try {
    return parseManualUnread(storage.getItem(WORKSPACE_VIEW_STORAGE_KEY))
  } catch {
    return NONE
  }
}

function sameIds(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false
  for (const id of left) {
    if (!right.has(id)) return false
  }
  return true
}

/** The `Storage` constructor the page exposes, when it exposes one. */
function storageConstructor(): { prototype: WritableStorage } | undefined {
  const page = typeof window === 'undefined'
    ? undefined
    : (window as unknown as { Storage?: { prototype: WritableStorage } })
  if (page?.Storage !== undefined) return page.Storage
  if (typeof Storage === 'undefined') return undefined
  return { prototype: Storage.prototype as unknown as WritableStorage }
}

/**
 * Wrap the storage write methods so a same-document write is observable.
 *
 * Only writes that can change the view-store key are reported; the wrappers
 * call through unchanged and every method is restored on dispose, because the
 * storage prototype belongs to the page, not to this plugin.
 *
 * @param onWrite - called after a write that could touch the view store.
 * @returns a restore function.
 */
function watchStorageWrites(onWrite: () => void): () => void {
  const holder = storageConstructor()
  if (holder === undefined) return () => {}
  const prototype = holder.prototype
  const setItem = prototype.setItem
  const removeItem = prototype.removeItem
  const clear = prototype.clear
  if (typeof setItem !== 'function' || typeof removeItem !== 'function' || typeof clear !== 'function') {
    return () => {}
  }
  prototype.setItem = function wrappedSetItem(key: string, value: string): void {
    setItem.call(this, key, value)
    if (key === WORKSPACE_VIEW_STORAGE_KEY) onWrite()
  }
  prototype.removeItem = function wrappedRemoveItem(key: string): void {
    removeItem.call(this, key)
    if (key === WORKSPACE_VIEW_STORAGE_KEY) onWrite()
  }
  prototype.clear = function wrappedClear(): void {
    clear.call(this)
    onWrite()
  }
  return () => {
    prototype.setItem = setItem
    prototype.removeItem = removeItem
    prototype.clear = clear
  }
}

/** Whether a storage event could have touched the view store. */
function touchesViewStore(event: Event): boolean {
  const detail = (event as CustomEvent<{ type?: unknown; key?: unknown }>).detail
  if (isRecord(detail)) {
    if (detail.type === 'clear') return true
    if (typeof detail.key === 'string') return detail.key === WORKSPACE_VIEW_STORAGE_KEY
  }
  const key = (event as StorageEvent).key
  // A null key on a StorageEvent is a clear() of the whole area.
  if (key === null) return true
  return typeof key !== 'string' || key === WORKSPACE_VIEW_STORAGE_KEY
}

/**
 * The ids the operator just cleared by hand.
 *
 * A manual read is the operator's own acknowledgement, so the ledger has to
 * hear about it: without this, a green dot painted from a durable reminder
 * would outlive the very mark that was supposed to clear it.
 *
 * @param previous - the manual-unread set before the write.
 * @param next - the manual-unread set after it.
 * @returns the ids present before and gone now, in the previous set's order.
 */
export function droppedIds(
  previous: ReadonlySet<SessionId>,
  next: ReadonlySet<SessionId>,
): SessionId[] {
  const dropped: SessionId[] = []
  for (const id of previous) {
    if (!next.has(id)) dropped.push(id)
  }
  return dropped
}

/**
 * Watch the browser's manual-unread set and report every real change.
 *
 * @param onChange - called with the new set, and only when the id set changed.
 * @returns a dispose function that removes the listeners and the write wrappers.
 */
export function watchManualUnread(
  onChange: (ids: ReadonlySet<SessionId>) => void,
): () => void {
  const page = typeof window === 'undefined' ? undefined : window
  let current = readManualUnread()
  let disposed = false
  const sync = (): void => {
    if (disposed) return
    const next = readManualUnread()
    if (sameIds(current, next)) return
    current = next
    onChange(next)
  }
  const restore = watchStorageWrites(sync)
  const onStorageEvent = (event: Event): void => {
    if (touchesViewStore(event)) sync()
  }
  page?.addEventListener('storage', onStorageEvent)
  page?.addEventListener(DESKTOP_STORAGE_SYNC_EVENT, onStorageEvent)
  // Catch a write that landed between the first read and the listeners going up.
  sync()
  return () => {
    disposed = true
    restore()
    page?.removeEventListener('storage', onStorageEvent)
    page?.removeEventListener(DESKTOP_STORAGE_SYNC_EVENT, onStorageEvent)
  }
}
