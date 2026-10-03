/**
 * Manual-unread bridge: the Session mark the operator sets by hand.
 *
 * The framework's `completionUnread` covers a Session that finished while the
 * operator was somewhere else, and this plugin's own completion edges cover the
 * ones watched live, but neither sees the row menu's "mark unread". That mark is
 * not part of any published snapshot: the Workspace browser
 * (`@deepseek-ai/dsh-client-ui-workspace`) keeps it in its private view store,
 * which is whole-value JSON persisted to `localStorage` under a versioned key.
 * This module is the one place that reads that key, so the rest of the plugin
 * keeps consuming plain sets.
 *
 * A same-document write fires no `storage` event, so the watcher also wraps the
 * storage write methods (restored on dispose) and answers the Desktop shell's
 * own `__dsh_storage_sync__` channel. Both triggers only re-read the key and
 * notify when the id set actually changed.
 *
 * @module dsh-unread-helper/client/manual-unread
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** The Workspace browser's persisted view-store key. */
export declare const WORKSPACE_VIEW_STORAGE_KEY = "dsh.workspace.view.v5";
/** The Desktop shell's same-document storage-sync event. */
export declare const DESKTOP_STORAGE_SYNC_EVENT = "__dsh_storage_sync__";
/** The read face of a storage device. */
export interface ManualUnreadStorage {
    getItem(key: string): string | null;
}
/**
 * Read the manual-unread ids out of a persisted view-store document.
 *
 * A missing, non-JSON, or oddly shaped value yields the empty set: a corrupt
 * store must never hide real reminders or throw in a render pass.
 *
 * @param raw - the stored document, as `localStorage.getItem` returned it.
 * @returns the marked Session ids, deduplicated.
 */
export declare function parseManualUnread(raw: string | null): ReadonlySet<SessionId>;
/**
 * Read the browser's current manual-unread set.
 *
 * @param storage - storage to read; defaults to the page's `localStorage`.
 * @returns the marked Session ids, empty when the store is absent or unreadable.
 */
export declare function readManualUnread(storage?: ManualUnreadStorage | undefined): ReadonlySet<SessionId>;
/**
 * Watch the browser's manual-unread set and report every real change.
 *
 * @param onChange - called with the new set, and only when the id set changed.
 * @returns a dispose function that removes the listeners and the write wrappers.
 */
export declare function watchManualUnread(onChange: (ids: ReadonlySet<SessionId>) => void): () => void;
