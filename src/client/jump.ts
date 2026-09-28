/**
 * The unread jump: which unread Session the next bell press lands on, and how
 * its sidebar row is brought into view.
 *
 * The selection is a pure fold over the unread ids the caller already derived
 * from the Session list, so the bell's cursor is the only state it owns: the
 * acknowledge bookkeeping may clear the Session the operator just opened, and
 * the ids the sidebar reports may change for reasons of their own, but neither
 * moves the operator off the position they reached by pressing.
 *
 * @module dsh-session-ledger/client/jump
 */

/** Structural element check; the page's HTMLElement is not a global the module can assume. */
function isElement(value: unknown): value is HTMLElement {
  return typeof value === 'object' && value !== null
    && (value as { nodeType?: unknown }).nodeType === 1
}

/**
 * Pick the Session the next bell press opens.
 * @param order - unread Session ids in jump order (the order the bell lists them).
 * @param cursor - the Session the previous jump landed on, or null before the first.
 * @returns the next id, the first when the cursor is no longer unread, or null when nothing is unread.
 */
export function nextUnreadId<Id extends string>(order: readonly Id[], cursor: Id | null): Id | null {
  if (order.length === 0) return null
  if (cursor === null) return order[0]
  const at = order.indexOf(cursor)
  if (at === -1) return order[0]
  return order[(at + 1) % order.length]
}

/**
 * The sidebar's row key for one Session.
 * @param sessionId - Session id.
 * @returns the data-row-key value the shipped browser renders for that row.
 */
export function sessionRowKey(sessionId: string): string {
  return `session:${sessionId}`
}

/**
 * Find the rendered sidebar row for a Session.
 *
 * A row is absent when its Workspace group is collapsed, when the row is
 * filtered out, or before the browser has mounted; the caller keeps the
 * conversation jump in that case rather than failing.
 *
 * @param listArea - the sidebar's list seat, as resolved by the anchors.
 * @param sessionId - Session whose row to find.
 * @returns the row element, or undefined when it is not rendered.
 */
export function findSessionRow(
  listArea: ParentNode | null | undefined,
  sessionId: string,
): HTMLElement | undefined {
  if (listArea === null || listArea === undefined) return undefined
  const row = listArea.querySelector(`[data-row-key="${sessionRowKey(sessionId)}"]`)
  return isElement(row) ? row : undefined
}

/**
 * Bring a row into view in its own scrollport, without moving the conversation.
 * @param row - the sidebar row to reveal.
 */
export function revealRow(row: HTMLElement): void {
  if (typeof row.scrollIntoView !== 'function') return
  row.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/**
 * Resolve the Workspace whose group holds a Session.
 * @param items - Workspace registry rows, as the sidebar snapshot publishes them.
 * @param sessionId - Session to place.
 * @returns the owning workspaceId, or undefined when no Workspace claims the Session.
 */
export function owningWorkspaceKey<Id extends string>(
  items: readonly { readonly workspaceId: string; readonly sessionIds: readonly Id[] }[],
  sessionId: Id,
): string | undefined {
  for (const workspace of items) {
    if (workspace.sessionIds.includes(sessionId)) return workspace.workspaceId
  }
  return undefined
}

/**
 * Press the disclosure of the Workspace group that owns a Session, but only
 * while that group renders no member rows - a collapsed group is the one case
 * where the Session's own row cannot be scrolled to.
 *
 * The row order is the sidebar's: a group's members follow its own workspace
 * row and stop at the next group's. Anything else after the row (an overflow
 * disclosure, a header action) is not a member.
 *
 * @param listArea - the sidebar's list seat.
 * @param workspaceKey - workspaceId of the owning group.
 * @returns true when the disclosure was pressed.
 */
export function expandOwningGroup(listArea: ParentNode | null | undefined, workspaceKey: string): boolean {
  if (listArea === null || listArea === undefined) return false
  const rows = [...listArea.querySelectorAll('[data-row-key]')]
  const keys = rows.map((row) => String(row.getAttribute('data-row-key') ?? ''))
  const at = keys.indexOf(`workspace:${workspaceKey}`)
  if (at === -1) return false
  let end = rows.length
  for (let index = at + 1; index < keys.length; index += 1) {
    if (keys[index].startsWith('workspace:')) {
      end = index
      break
    }
  }
  if (keys.slice(at + 1, end).some((key) => key.startsWith('session:'))) return false
  const disclosure = rows[at]
  if (!isElement(disclosure) || typeof disclosure.click !== 'function') return false
  disclosure.click()
  return true
}
