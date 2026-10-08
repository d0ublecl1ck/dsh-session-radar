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
 * @module dsh-session-radar/client/ledger-source
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { currentSessionId } from './jump.js'

/** One unread Session as the host reports it. */
export interface LedgerUnreadRow {
  readonly sessionId: string
  readonly at: number
  readonly kind: string | null
  /** The reminder is a turn that never finished, not a finished one. */
  readonly interrupted: boolean
}

/** Everything the bell renders. */
export interface LedgerSnapshot {
  readonly now: number
  /**
   * When the host process started, or 0 before the first answer. The retry
   * dialog keys "already asked about this boot" on it.
   */
  readonly bootAt: number
  readonly unread: readonly LedgerUnreadRow[]
  /** Last bridge failure, or null. Rendered so a broken bridge is visible. */
  readonly error: string | null
}

/** Extras a read can report about why the operator is acknowledging. */
export interface LedgerReadOptions {
  /**
   * The operator reached the conversation's tail. That is the acknowledgement
   * of a restart-interrupted turn; a plain open leaves the marker armed.
   */
  readonly acknowledgeInterrupt?: boolean
  /**
   * Further Sessions this one read spends. A folded row stands in for
   * subagents that can never be addressed on their own, so their reminders are
   * spent here or never.
   */
  readonly also?: readonly SessionId[]
}

/** Observable ledger face handed to the component. */
export interface LedgerSource {
  getSnapshot(): LedgerSnapshot
  subscribe(listener: () => void): () => void
  read(sessionId: SessionId, options?: LedgerReadOptions): void
}

const ROUTE = '/session-radar'
const POLL_MS = 5000
/** The automatic restore that follows a restart is not an acknowledgement. */
const BOOT_SETTLE_MS = 3000

const EMPTY: LedgerSnapshot = {
  now: 0,
  bootAt: 0,
  unread: [],
  error: null,
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
      throw new Error('session-radar: host refused ' + endpoint + ' (HTTP ' + String(response.status) + ')')
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
    const current = currentSessionId(sessions.getSnapshot())
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
    read: (sessionId, options) => {
      const body: { sessionId: SessionId; acknowledgeInterrupt?: true; also?: SessionId[] } =
        options?.acknowledgeInterrupt === true
          ? { sessionId, acknowledgeInterrupt: true }
          : { sessionId }
      if (options?.also !== undefined && options.also.length > 0) body.also = [...options.also]
      void post('read', body)
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
  }, 'session-radar: bridge teardown')

  return source
}
