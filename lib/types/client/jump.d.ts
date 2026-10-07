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
 * @module dsh-session-radar/client/jump
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Minimal Session-list shape the current-Session lookup reads. */
interface MainViewList<Id extends string> {
    readonly ids: readonly Id[];
    readonly byId: Readonly<Record<string, {
        readonly retainedBy?: {
            readonly mainView?: number;
        } | undefined;
    } | undefined>>;
}
/**
 * Find the Session the conversation column currently shows.
 *
 * The selected Session is the one fact the jump cannot derive from the unread
 * or pending sets: it is the origin a new walk remembers, and the bridge to the
 * host ledger watches the same flag to acknowledge a switch. A row without a
 * positive `mainView` count is not open.
 *
 * @param list - Session list snapshot.
 * @returns the open Session id, or null when no conversation is selected.
 */
export declare function currentSessionId<Id extends string>(list: MainViewList<Id>): Id | null;
/**
 * Pick the Session the next bell press opens.
 * @param order - unread Session ids in jump order (the order the bell lists them).
 * @param cursor - the Session the previous jump landed on, or null before the first.
 * @returns the next id, the first when the cursor is no longer unread, or null when nothing is unread.
 */
export declare function nextUnreadId<Id extends string>(order: readonly Id[], cursor: Id | null): Id | null;
/**
 * The sidebar's row key for one Session.
 * @param sessionId - Session id.
 * @returns the data-row-key value the shipped browser renders for that row.
 */
export declare function sessionRowKey(sessionId: string): string;
/**
 * Read the Session back out of a rendered row key.
 *
 * The sidebar's rows are keyed by kind, so this is how a click on one of them
 * becomes "the operator opened this Session" rather than "a row moved".
 *
 * @param value - a `data-row-key` attribute value, as the DOM reports it.
 * @returns the Session id, or null for any other kind of row.
 */
export declare function sessionIdOfRowKey(value: unknown): SessionId | null;
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
export declare function findSessionRow(listArea: ParentNode | null | undefined, sessionId: string): HTMLElement | undefined;
/**
 * Bring a row into view in its own scrollport, without moving the conversation.
 * @param row - the sidebar row to reveal.
 */
export declare function revealRow(row: HTMLElement): void;
/**
 * Resolve the Workspace whose group holds a Session.
 * @param items - Workspace registry rows, as the sidebar snapshot publishes them.
 * @param sessionId - Session to place.
 * @returns the owning workspaceId, or undefined when no Workspace claims the Session.
 */
export declare function owningWorkspaceKey<Id extends string>(items: readonly {
    readonly workspaceId: string;
    readonly sessionIds: readonly Id[];
}[], sessionId: Id): string | undefined;
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
export declare function expandOwningGroup(listArea: ParentNode | null | undefined, workspaceKey: string): boolean;
export {};
