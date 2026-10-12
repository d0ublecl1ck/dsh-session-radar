/**
 * The pending-ask queue: which Session the next ask press opens while one or
 * more Sessions wait for an answer.
 *
 * This module is only the queue. Going back is not its business: the
 * previous/next conversation commands step the visit history in
 * ./session-history, which records every Session the conversation column has
 * shown. Keeping the two apart is what lets the approval key stay a queue while
 * the history pair owns the trail.
 *
 * @module dsh-session-radar/client/ask-jump
 */
/**
 * Pick the Session the next ask press opens.
 *
 * A Session on screen that is itself waiting cycles to the next one in the
 * queue; arriving from anywhere else always enters the queue at its head.
 *
 * @param asks - pending Sessions in jump order (earliest waiting first).
 * @param current - the Session the conversation column shows, or null.
 * @returns the Session to open, or null when there is nowhere to go.
 */
export declare function nextAsk<Id extends string>(asks: readonly Id[], current: Id | null): Id | null;
