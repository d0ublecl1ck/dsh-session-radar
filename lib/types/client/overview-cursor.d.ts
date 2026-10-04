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
import type { Overview, OverviewCard } from '../overview.js';
/** The zones the window renders, left to right. */
export type OverviewZone = 'ask' | 'unread';
/** One selected card: the zone it lives in and its index inside that zone. */
export interface OverviewCursor {
    readonly zone: OverviewZone;
    readonly index: number;
}
/** One arrow-key step. */
export type OverviewStep = 'up' | 'down' | 'left' | 'right';
/**
 * The cards of one zone.
 * @param overview - the projection the window renders.
 * @param zone - the zone to read.
 * @returns that zone's cards, in render order.
 */
export declare function zoneCards<Id extends string>(overview: Overview<Id>, zone: OverviewZone): readonly OverviewCard<Id>[];
/**
 * How many cards one zone holds.
 * @param overview - the projection the window renders.
 * @param zone - the zone to measure.
 * @returns the card count.
 */
export declare function zoneLength<Id extends string>(overview: Overview<Id>, zone: OverviewZone): number;
/**
 * The cursor the window starts on: the ask zone leads, because answering is the
 * higher-priority action; an empty ask zone falls back to the unread zone.
 * @param overview - the projection the window renders.
 * @returns the initial cursor, or null when nothing waits.
 */
export declare function seedCursor<Id extends string>(overview: Overview<Id>): OverviewCursor | null;
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
export declare function moveCursor<Id extends string>(cursor: OverviewCursor | null, overview: Overview<Id>, step: OverviewStep): OverviewCursor | null;
/**
 * The card a cursor stands on.
 * @param overview - the projection the window renders.
 * @param cursor - the current cursor, or null.
 * @returns the selected card, or null when the cursor points at nothing.
 */
export declare function selectedCard<Id extends string>(overview: Overview<Id>, cursor: OverviewCursor | null): OverviewCard<Id> | null;
