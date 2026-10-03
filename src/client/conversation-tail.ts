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
 * @module dsh-unread-helper/client/conversation-tail
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
