/**
 * The keyboard cursor behind the waiting window: which zone is active, which
 * card inside it is selected, and where a key press moves next.
 *
 * The window renders two zones side by side, so a single index is not enough:
 * the cursor is the pair. It is a pure fold over the overview the window
 * already computed — the component keeps only the latest value, and because the
 * snapshots behind the overview can change between two presses, every step
 * clamps the incoming cursor back onto a card that exists before it moves.
 *
 * @module dsh-session-radar/client/overview-cursor
 */
import type { Overview, OverviewCard } from '../overview.js'

/** The zones the window renders, left to right. */
export type OverviewZone = 'ask' | 'unread'

/** One selected card: the zone it lives in and its index inside that zone. */
export interface OverviewCursor {
  readonly zone: OverviewZone
  readonly index: number
}

/** One arrow-key step. */
export type OverviewStep = 'up' | 'down' | 'left' | 'right'

/**
 * The cards of one zone.
 * @param overview - the projection the window renders.
 * @param zone - the zone to read.
 * @returns that zone's cards, in render order.
 */
export function zoneCards<Id extends string>(
  overview: Overview<Id>,
  zone: OverviewZone,
): readonly OverviewCard<Id>[] {
  return zone === 'ask' ? overview.ask : overview.unread
}

/**
 * How many cards one zone holds.
 * @param overview - the projection the window renders.
 * @param zone - the zone to measure.
 * @returns the card count.
 */
export function zoneLength<Id extends string>(overview: Overview<Id>, zone: OverviewZone): number {
  return zoneCards(overview, zone).length
}

/**
 * The cursor the window starts on: the ask zone leads, because answering is the
 * higher-priority action; an empty ask zone falls back to the unread zone.
 * @param overview - the projection the window renders.
 * @returns the initial cursor, or null when nothing waits.
 */
export function seedCursor<Id extends string>(overview: Overview<Id>): OverviewCursor | null {
  if (overview.ask.length > 0) return { zone: 'ask', index: 0 }
  if (overview.unread.length > 0) return { zone: 'unread', index: 0 }
  return null
}

/**
 * Fold one key press into the next cursor.
 *
 * `up` and `down` walk one zone and wrap around its ends. `left` and `right`
 * switch zones and land on the other zone's first card; a switch onto an empty
 * zone leaves the cursor where it was, so a press never loses the selection.
 *
 * @param cursor - the current cursor, or null before the first press.
 * @param overview - the projection the window renders.
 * @param step - the direction the press asked for.
 * @returns the next cursor, or null when nothing waits.
 */
export function moveCursor<Id extends string>(
  cursor: OverviewCursor | null,
  overview: Overview<Id>,
  step: OverviewStep,
): OverviewCursor | null {
  const current = cursor === null ? seedCursor(overview) : clampCursor(cursor, overview)
  if (current === null) return null
  if (step === 'left' || step === 'right') {
    const other: OverviewZone = current.zone === 'ask' ? 'unread' : 'ask'
    return zoneLength(overview, other) === 0 ? current : { zone: other, index: 0 }
  }
  const length = zoneLength(overview, current.zone)
  const delta = step === 'down' ? 1 : -1
  return { zone: current.zone, index: (current.index + delta + length) % length }
}

/**
 * Put a cursor back onto a card that exists: an emptied zone falls through to
 * the other one, and an out-of-range index lands on the zone's last card.
 */
function clampCursor<Id extends string>(
  cursor: OverviewCursor,
  overview: Overview<Id>,
): OverviewCursor | null {
  const length = zoneLength(overview, cursor.zone)
  if (length === 0) return seedCursor(overview)
  return cursor.index < length ? cursor : { zone: cursor.zone, index: length - 1 }
}

/**
 * The card a cursor stands on.
 * @param overview - the projection the window renders.
 * @param cursor - the current cursor, or null.
 * @returns the selected card, or null when the cursor points at nothing.
 */
export function selectedCard<Id extends string>(
  overview: Overview<Id>,
  cursor: OverviewCursor | null,
): OverviewCard<Id> | null {
  if (cursor === null) return null
  const cards = zoneCards(overview, cursor.zone)
  return cards[cursor.index] ?? null
}
