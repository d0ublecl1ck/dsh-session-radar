/**
 * The pending-ask jump: which Session the next ask press lands on, and the LIFO
 * trail that walks the operator back the way they came.
 *
 * The walk is a pure fold over the pending order the caller derived from the
 * activity projection, the Session the conversation column currently shows, and
 * the trail the previous presses left behind. It owns no state of its own: the
 * bell keeps the trail in a ref and feeds it back on the next press.
 *
 * The two rules are deliberately asymmetric. While a Session still waits for an
 * answer, the press only moves between waiting Sessions, and the session the
 * operator was on *before the first ask* is what the trail remembers. Once no
 * ask is left, every press pops one stop off that trail, so answering B and C
 * from A leads back to B, then to A. A session that is already on the trail is
 * never pushed twice, so wandering between asks cannot grow the walk home.
 *
 * @module dsh-session-radar/client/ask-jump
 */

/** One ask press's outcome: the Session to land on, and the trail that remains. */
export interface AskJumpStep<Id extends string> {
  /** The Session the press opens, or null when there is nowhere to go. */
  readonly target: Id | null
  /** The return trail after this press. */
  readonly stack: readonly Id[]
}

/**
 * Fold one ask press into the next target and the remaining trail.
 *
 * @param asks - pending Sessions in jump order (earliest waiting first).
 * @param current - the Session the conversation column shows, or null.
 * @param trail - stops the previous ask presses left behind, oldest first.
 * @returns the Session to open and the trail to keep; a null target is a no-op.
 */
export function nextAskJump<Id extends string>(
  asks: readonly Id[],
  current: Id | null,
  trail: readonly Id[],
): AskJumpStep<Id> {
  if (asks.length > 0) {
    const at = current === null ? -1 : asks.indexOf(current)
    // Standing on a waiting Session cycles to the next one; arriving from
    // somewhere else always enters the queue at its head.
    const target = at === -1 ? asks[0] : asks[(at + 1) % asks.length]
    if (target === current) return { target: null, stack: trail }
    // Only a session that is *not* itself waiting is a place we left behind.
    const remember = current !== null && at === -1 && !trail.includes(current)
    return { target, stack: remember ? [...trail, current] : trail }
  }
  if (trail.length === 0) return { target: null, stack: trail }
  const remaining = [...trail]
  let target = remaining.pop() ?? null
  // The trail records where we were, not where we are: a stop we already sit on
  // is consumed, never re-opened.
  while (target !== null && target === current && remaining.length > 0) {
    target = remaining.pop() ?? null
  }
  if (target === null || target === current) return { target: null, stack: remaining }
  return { target, stack: remaining }
}
