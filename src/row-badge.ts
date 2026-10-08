/**
 * The Session row badge's pure rule.
 *
 * The framework's own completion flag lives in the renderer's memory, so a
 * restart empties it and the official green dot disappears. The official row
 * renders its `sidebar.session.row.leading` seat exactly when the row's primary
 * status is idle and the Workspace browser's manual-unread flag is unset, which
 * is the gap a durable reminder can still paint. This module turns the host
 * ledger's rows into the id set that seat answers to.
 *
 * @module dsh-session-radar/row-badge
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One ledger reminder, as far as this rule reads it. */
export interface LedgerReminderRow {
  readonly sessionId?: unknown
}

/**
 * Collect the Session ids the host ledger still owes the operator.
 *
 * @param rows - the ledger snapshot's unread rows.
 * @returns the reminder ids, deduplicated; malformed rows are ignored.
 */
export function ledgerUnreadIds(rows: readonly LedgerReminderRow[]): ReadonlySet<SessionId> {
  const ids = new Set<SessionId>()
  for (const row of rows) {
    const id = row?.sessionId
    if (typeof id === 'string' && id !== '') ids.add(id as SessionId)
  }
  return ids
}
