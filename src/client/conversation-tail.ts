/**
 * The conversation column's "at the tail" anchor.
 *
 * The chat region marks itself with `data-chat-following-tail` while its
 * scrollport follows the newest content, and carries the Session it renders in
 * `data-conversation-session`. Together they answer one question the Session
 * snapshots cannot: is the operator looking at the end of this conversation?
 * A Session that is at its tail is read, so its completion never needs a
 * reminder; one scrolled up keeps its reminder until the operator reaches the
 * tail. Both attributes are shipped DOM, so this is the one place that reads
 * them.
 *
 * @module dsh-session-radar/client/conversation-tail
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The visible chat region, carrying the Session it renders. */
export const CONVERSATION_REGION_SELECTOR =
  '[data-conversation-region="chat"][data-conversation-session]'

/** The chat root carries this attribute while its scroll follows the tail. */
export const FOLLOWING_TAIL_SELECTOR = '[data-chat-following-tail]'

const SESSION_ATTRIBUTE = 'data-conversation-session'

/**
 * Resolve the Session whose visible conversation is scrolled to its tail.
 *
 * @param root - the document (or subtree) holding the conversation column.
 * @returns the Session id, or null while no conversation follows its tail.
 */
export function tailSessionId(root: ParentNode): SessionId | null {
  for (const region of root.querySelectorAll(CONVERSATION_REGION_SELECTOR)) {
    if (region.querySelector(FOLLOWING_TAIL_SELECTOR) === null) continue
    const id = region.getAttribute(SESSION_ATTRIBUTE)
    if (typeof id === 'string' && id !== '') return id as SessionId
  }
  return null
}

/** What the tail has to know before it can excuse an unfinished turn. */
export interface TailAcknowledgement {
  /** The Session whose conversation follows its tail, or null. */
  readonly tail: SessionId | null
  /** The ledger's reminder for that Session, or null when it carries none. */
  readonly reminder: { readonly interrupted: boolean } | null
  /** The Session the shell reopened by itself after the last start, or null. */
  readonly restored: SessionId | null
  /** The Session the operator opened themselves, or null. */
  readonly openedByUser: SessionId | null
}

/** What the tail owes the host ledger for the Session it shows. */
export type TailLedgerRead =
  | { readonly send: false }
  | { readonly send: true; readonly acknowledgeInterrupt: boolean }

/**
 * Decide the one read the visible tail reports to the host ledger.
 *
 * The tail is normally the acknowledgement of whatever the ledger remembers —
 * but not the tail the shell put on screen by itself. DSH reopens the Session
 * that was open when the process ended, and that Session is usually the one the
 * restart cut off; treating its tail as a read would spend the reminder before
 * the operator ever chose to look at it, which is exactly how an unfinished run
 * got forgotten. Only an explicit open is that choice.
 *
 * A finished turn behind a restored Session is still read (the tail is the
 * tail); the unfinished one waits to be chosen, and stays quiet while it waits
 * so the poll cannot re-report it forever.
 *
 * @param input - the tail, the ledger's reminder for it, and the two ids.
 * @returns the read to send, or `send: false` to send none.
 */
export function tailLedgerRead(input: TailAcknowledgement): TailLedgerRead {
  const { tail, reminder } = input
  if (tail === null || reminder === null) return { send: false }
  if (tail !== input.restored || input.openedByUser === tail) {
    return { send: true, acknowledgeInterrupt: true }
  }
  return reminder.interrupted ? { send: false } : { send: true, acknowledgeInterrupt: false }
}
