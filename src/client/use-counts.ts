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
import { countSessions, type SessionCounts } from '../count.js'
import type { SnapshotSelectorHook } from './watch-types.js'

/** Stand-in status source for a shell that has not installed the UI status stream. */
const EMPTY_STATUSES: ReadonlyMap<string, never> = new Map<string, never>()

/** The standard hooks the counts are read through. */
export interface CountHooks {
  readonly useSessions: SnapshotSelectorHook
  readonly useSessionStatus: SnapshotSelectorHook | undefined
  readonly useWorkspaces: SnapshotSelectorHook
}

/**
 * Read the six status counts off the live shell snapshots.
 * @param hooks - the framework's standard selector hooks.
 * @returns the six counts.
 */
export function useSessionCounts({ useSessions, useSessionStatus, useWorkspaces }: CountHooks): SessionCounts {
  const useStatus: SnapshotSelectorHook =
    typeof useSessionStatus === 'function' ? useSessionStatus : (selector) => selector(EMPTY_STATUSES)
  const archived = useWorkspaces((state: any) => state.archivedSessionIds)
  const statuses = useStatus((state: any) => state)
  return {
    running: useSessions((state: any) => countSessions(state, archived, statuses).running),
    unread: useSessions((state: any) => countSessions(state, archived, statuses).unread),
    pending: useSessions((state: any) => countSessions(state, archived, statuses).pending),
    idle: useSessions((state: any) => countSessions(state, archived, statuses).idle),
    unarchived: useSessions((state: any) => countSessions(state, archived, statuses).unarchived),
    archived: useSessions((state: any) => countSessions(state, archived, statuses).archived),
  }
}
