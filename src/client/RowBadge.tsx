/**
 * The green dot on a Session row whose reminder only the host ledger still has.
 *
 * The official row renders its `sidebar.session.row.leading` seat exactly when
 * its primary status is idle and the Workspace browser's manual-unread flag is
 * unset. After a restart the framework's own completion flag is empty, so this
 * seat is the gap a durable ledger reminder paints into — using the same
 * `StateDot` the official row uses for its other two unread sources.
 *
 * @module dsh-session-radar/client/RowBadge
 */
import { useCallback, useSyncExternalStore } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { ledgerUnreadIds } from '../row-badge.js'
import type { ConfigSource, WatchConfig } from './config-source.js'
import type { LedgerSource } from './ledger-source.js'
import type { Translate } from './watch-types.js'

/** Composed props of a Session row leading-seat occupant. */
export interface RowBadgeProps {
  /** The Session this row renders. */
  readonly sessionId: SessionId
  /** The host ledger, the only reminder source that survives a restart. */
  readonly ledger: LedgerSource
  /** Live preference owned by this plugin's config namespace. */
  readonly config: ConfigSource
  /** Bound translate function for the session-radar namespace. */
  readonly t: Translate
}

/**
 * Render the durable unread dot for one Session row.
 * @param props - the row's Session plus this plugin's inject face.
 * @returns the dot, or null when the row carries no durable reminder.
 */
export function RowBadge({ sessionId, ledger, config, t }: RowBadgeProps) {
  const watch: WatchConfig = useSyncExternalStore(config.subscribe, config.getSnapshot, config.getSnapshot)
  const subscribeLedger = useCallback((listener: () => void) => ledger.subscribe(listener), [ledger])
  const readLedger = useCallback(() => ledger.getSnapshot(), [ledger])
  const snapshot = useSyncExternalStore(subscribeLedger, readLedger, readLedger)
  if (!watch.rowBadge) return null
  if (!ledgerUnreadIds(snapshot.unread).has(sessionId)) return null
  return (
    <>
      <StateDot state="done" />
      <span className="sw-sr-only">{t('row.unread')}</span>
    </>
  )
}
