/**
 * One hook that projects the three shell snapshots into the six counts, using
 * only the framework's standard selector hooks.
 *
 * countSessions returns a fresh object each call, so the hook selects the six
 * numbers individually: a selector that returned the object would hand
 * useSyncExternalStore a new identity on every render.
 *
 * @module dsh-unread-helper/client/use-counts
 */
import { type SessionCounts } from '../count.js';
import type { SnapshotSelectorHook } from './watch-types.js';
/** The standard hooks the counts are read through. */
export interface CountHooks {
    readonly useSessions: SnapshotSelectorHook;
    readonly useSessionStatus: SnapshotSelectorHook | undefined;
    readonly useWorkspaces: SnapshotSelectorHook;
}
/**
 * Read the six status counts off the live shell snapshots.
 * @param hooks - the framework's standard selector hooks.
 * @returns the six counts.
 */
export declare function useSessionCounts({ useSessions, useSessionStatus, useWorkspaces }: CountHooks): SessionCounts;
