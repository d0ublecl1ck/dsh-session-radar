/**
 * Browser-side bridge to the host ledger.
 *
 * The host owns the cross-restart memory. The Typert Remote path is closed to a
 * hand-written contribution (the gateway validates descriptors against
 * generated metadata), so this module posts to the plugin's own webServer
 * route instead — same origin, browser cookie, and the connection's trust
 * fence on the host side.
 *
 * Failures are published, never swallowed: a bridge that fails silently is
 * indistinguishable from "nothing to show", which is exactly the bug this file
 * was written to avoid.
 *
 * @module dsh-session-ledger/client/ledger-source
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One unread Session as the host reports it. */
export interface LedgerUnreadRow {
  readonly sessionId: string
  readonly at: number
  readonly kind: string | null
}

/** One Session whose turn a restart cut off. */
export interface LedgerInterruptedRow {
  readonly sessionId: string
  readonly at: number
}

/** Everything the chip renders. */
export interface LedgerSnapshot {
  readonly now: number
  readonly unread: readonly LedgerUnreadRow[]
  readonly interrupted: readonly LedgerInterruptedRow[]
  /** Last bridge failure, or null. Rendered so a broken bridge is visible. */
  readonly error: string | null
}

/** Observable ledger face handed to the component. */
export interface LedgerSource {
  getSnapshot(): LedgerSnapshot
  subscribe(listener: () => void): () => void
  read(sessionId: SessionId): void
}

const ROUTE = '/session-ledger'
const POLL_MS = 5000
/** The automatic restore that follows a restart is not an acknowledgement. */
const BOOT_SETTLE_MS = 3000

const EMPTY: LedgerSnapshot = {
  now: 0,
  unread: [],
  interrupted: [],
  error: null,
}

/** Id of the Session the conversation column currently shows, if any. */
function mainViewId(sessions: { getSnapshot(): SessionListState }): SessionId | null {
  const state = sessions.getSnapshot()
  for (const id of state.ids) {
    const row = state.byId[id] as { retainedBy?: { mainView?: number } } | undefined
    if ((row?.retainedBy?.mainView ?? 0) > 0) return id
  }
  return null
}

/**
 * Create the ledger source and keep it mounted for the plugin's lifetime.
 *
 * @param _ctx - client root context (kept for the effect scope).
 * @param sessions - the Session list the read acknowledgement watches.
 * @returns the observable ledger face.
 */
export function createLedgerSource(
  _ctx: Context,
  sessions: { getSnapshot(): SessionListState; subscribe(listener: () => void): () => void },
): LedgerSource {
  let snapshot: LedgerSnapshot = EMPTY
  let disposed = false
  let settled = false
  let bootMain: SessionId | null = null
  const listeners = new Set<() => void>()

  const publish = (next: LedgerSnapshot): void => {
    snapshot = next
    for (const listener of [...listeners]) listener()
  }

  const settleTimer = setTimeout(() => {
    settled = true
  }, BOOT_SETTLE_MS)
  ;(settleTimer as unknown as { unref?: () => void }).unref?.()

  async function post(endpoint: string, body?: unknown): Promise<LedgerSnapshot> {
    const response = await fetch(ROUTE + '/' + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const payload = (await response.json()) as { ok?: boolean; value?: LedgerSnapshot }
    if (payload?.ok !== true || payload.value === undefined) {
      throw new Error('session-ledger: host refused ' + endpoint + ' (HTTP ' + String(response.status) + ')')
    }
    return { ...payload.value, error: null }
  }

  async function refresh(): Promise<void> {
    if (disposed) return
    try {
      const next = await post('list')
      if (!disposed) publish(next)
    } catch (error: unknown) {
      // Keep the last known rows, but say so: silence hid a dead bridge once.
      if (!disposed) publish({ ...snapshot, error: String((error as Error)?.message ?? error) })
    }
  }

  const onSessionsChanged = (): void => {
    const current = mainViewId(sessions)
    if (current === null) return
    if (!settled) {
      bootMain ??= current
      return
    }
    if (current === bootMain) return
    bootMain = current
    source.read(current)
  }

  const poll = setInterval(() => void refresh(), POLL_MS)
  ;(poll as unknown as { unref?: () => void }).unref?.()

  const source: LedgerSource = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    read: (sessionId) => {
      void post('read', { sessionId })
        .then((next) => { if (!disposed) publish(next) })
        .catch((error: unknown) => {
          if (!disposed) publish({ ...snapshot, error: String((error as Error)?.message ?? error) })
        })
    },
  }

  const unsubscribe = sessions.subscribe(onSessionsChanged)
  void refresh()

  _ctx.effect(() => () => {
    disposed = true
    clearInterval(poll)
    clearTimeout(settleTimer)
    unsubscribe()
    listeners.clear()
  }, 'session-ledger: bridge teardown')

  return source
}
