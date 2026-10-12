/**
 * The visited-conversation history behind the back and forward commands.
 *
 * It is a browser-style history: an ordered list of the Sessions the
 * conversation column has shown, plus a cursor at the one on screen. Switching
 * to a Session already on the list only moves the cursor, so a back press can
 * be undone by a forward press; switching to a new Session appends it and drops
 * whatever was ahead, exactly like a browser drops its forward entries when you
 * navigate somewhere new.
 *
 * The module owns no state and touches no services: the bell keeps the
 * structure in a ref and feeds it every `currentSessionId(list)` change. This
 * is deliberately independent of the pending-ask queue (./ask-jump): the ask
 * walk only moves between waiting Sessions, and back/forward are their own two
 * commands.
 *
 * @module dsh-session-radar/client/session-history
 */

/** Ordered visited Sessions plus the cursor at the one on screen. */
export interface SessionHistory<Id extends string> {
  /** Visited Sessions, oldest first; never empty while the cursor is set. */
  readonly entries: readonly Id[]
  /** Index of the Session on screen, or -1 before the first visit. */
  readonly index: number
}

/** The history before any conversation has been shown. */
export function emptyHistory<Id extends string>(): SessionHistory<Id> {
  return { entries: [], index: -1 }
}

/**
 * Record the Session the conversation column now shows.
 *
 * A Session already on the list is a revisit: the cursor moves to it and the
 * forward entries survive. A Session new to the list is appended after the
 * cursor and everything ahead of it is dropped.
 *
 * @param history - the history so far.
 * @param session - the Session now on screen.
 * @returns the same structure when nothing changed, or the next one.
 */
export function recordVisit<Id extends string>(
  history: SessionHistory<Id>,
  session: Id,
): SessionHistory<Id> {
  const current = history.index >= 0 ? history.entries[history.index] : undefined
  if (current === session) return history
  const seen = history.entries.indexOf(session)
  if (seen >= 0) return { entries: history.entries, index: seen }
  const entries = [...history.entries.slice(0, history.index + 1), session]
  return { entries, index: entries.length - 1 }
}

/** Which way a history press walks. */
export type HistoryStep = -1 | 1

/** One history press's outcome: the Session to open and the cursor to keep. */
export interface HistoryJump<Id extends string> {
  /** The Session to open, or null when the walk runs out. */
  readonly target: Id | null
  /** The history after the press; unchanged when there is nowhere to go. */
  readonly history: SessionHistory<Id>
}

/**
 * Step the cursor one visit back or forward.
 *
 * Sessions that left the list are skipped without opening; the cursor lands on
 * the nearest entry in that direction that still exists. Running out of entries
 * leaves the cursor where it was and reports a null target, so a press at
 * either end is a no-op rather than a wrap.
 *
 * @param history - the history to step through.
 * @param step - -1 for the previous conversation, 1 for the next.
 * @param known - whether an entry is still a Session the page can open.
 * @returns the Session to open and the history to keep.
 */
export function stepHistory<Id extends string>(
  history: SessionHistory<Id>,
  step: HistoryStep,
  known: (id: Id) => boolean,
): HistoryJump<Id> {
  for (let index = history.index + step; index >= 0 && index < history.entries.length; index += step) {
    const candidate = history.entries[index]
    if (!known(candidate)) continue
    return { target: candidate, history: { entries: history.entries, index } }
  }
  return { target: null, history }
}
