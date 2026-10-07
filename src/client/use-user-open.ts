/**
 * React binding for "the operator opened this Session".
 *
 * One question the Session snapshots cannot answer is *who* put a conversation
 * on screen. DSH reopens the Session that was open when the process ended, and
 * that Session is usually the one a restart cut off — so the tail it shows by
 * itself must not count as a read. A press on a sidebar row, or one of the
 * plugin's own jumps, is the operator choosing; both land here.
 *
 * @module dsh-session-radar/client/use-user-open
 */
import { useCallback, useEffect, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { sessionIdOfRowKey } from './jump.js'

/** The Session the operator opened, and the way to report one. */
export interface UserOpen {
  /** The Session the operator opened last, or null before any. */
  readonly current: SessionId | null
  /** Record one open the plugin performed on the operator's behalf. */
  readonly mark: (sessionId: SessionId) => void
}

/** The Session a pointer event landed on, when it landed on a session row. */
function rowSessionOf(target: EventTarget | null): SessionId | null {
  if (typeof target !== 'object' || target === null) return null
  const element = target as { closest?: (selector: string) => unknown }
  if (typeof element.closest !== 'function') return null
  const row = element.closest('[data-row-key]') as { getAttribute?: (name: string) => string | null } | null
  if (row === null || typeof row.getAttribute !== 'function') return null
  return sessionIdOfRowKey(row.getAttribute('data-row-key'))
}

/**
 * Track the Session the operator opened themselves.
 *
 * The press is captured at the document, so the sidebar's rows and the
 * activity list's own rows both count however they were rendered.
 *
 * @returns the operator's last open, and the reporter the jumps call.
 */
export function useUserOpenedSession(): UserOpen {
  const [current, setCurrent] = useState<SessionId | null>(null)
  const mark = useCallback((sessionId: SessionId): void => { setCurrent(sessionId) }, [])
  useEffect(() => {
    const onPointerDown = (event: Event): void => {
      const sessionId = rowSessionOf(event.target)
      if (sessionId !== null) setCurrent(sessionId)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [])
  return { current, mark }
}
