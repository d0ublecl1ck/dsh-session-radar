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
    readonly target: Id | null;
    /** The return trail after this press. */
    readonly stack: readonly Id[];
}
/**
 * Fold one ask press into the next target and the remaining trail.
 *
 * @param asks - pending Sessions in jump order (earliest waiting first).
 * @param current - the Session the conversation column shows, or null.
 * @param trail - stops the previous ask presses left behind, oldest first.
 * @returns the Session to open and the trail to keep; a null target is a no-op.
 */
export declare function nextAskJump<Id extends string>(asks: readonly Id[], current: Id | null, trail: readonly Id[]): AskJumpStep<Id>;
