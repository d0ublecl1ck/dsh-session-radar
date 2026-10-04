/**
 * Pure counting rules for the status readout.
 *
 * No framework, no DOM: the browser half (through the client bundle) and the
 * Node tests both import this module, so the definition of every number the
 * plugin shows lives in exactly one place.
 *
 * Scope ("ordinary Session"), shared by every metric:
 * - subagent child Sessions are excluded — they are part of a parent's work;
 * - blank Sessions are excluded — they are the reusable "New Session" seat
 *   rather than a conversation.
 *
 * The six metrics are then two independent splits of that scope:
 * - archive:   archived vs unarchived;
 * - activity:  the unarchived rows fold into exactly one of
 *   pending / running / unread / idle, in that precedence order.
 *
 * The precedence makes the four activity numbers a partition: their sum is
 * always the unarchived count, so the readout can never double-count a Session
 * that is, say, running while it waits for an approval.
 *
 * @module dsh-session-radar/count
 */

/** Threshold used when configuration is absent or malformed. */
export const DEFAULT_THRESHOLD = 10

/** Every metric the status readout can show, in display order. */
export const METRICS = ['running', 'unread', 'pending', 'idle', 'unarchived', 'archived'] as const

/** One metric key. */
export type Metric = (typeof METRICS)[number]

/** The row fields this module reads (a structural subset of the client summary). */
export interface SessionRowLike {
  readonly parentId?: unknown
  readonly origin?: unknown
  readonly blank?: unknown
  /** Host running state, used when the status stream has no value yet. */
  readonly running?: unknown
}

/** The list fields this module reads (a structural subset of SessionListState). */
export interface SessionListLike {
  readonly ids: readonly unknown[]
  readonly byId: Readonly<Record<string, SessionRowLike | undefined>>
}

/** Independent UI status facts for one Session (structural subset of SessionStatus). */
export interface SessionStatusLike {
  /** Latest known running state; absent until a baseline or event establishes it. */
  readonly running?: unknown
  /** Whether an observed stop outside the main view still needs acknowledgement. */
  readonly completionUnread?: unknown
  /** Highest-precedence domain request currently awaiting user interaction. */
  readonly pendingInteraction?: unknown
}

/** The status snapshot this module reads (a structural subset of SessionStatusSnapshot). */
export interface StatusMapLike {
  /** @param id - Session identity. @returns that Session's status, when known. */
  get(id: string): SessionStatusLike | undefined
}

/** The six numbers the readout renders. */
export interface SessionCounts {
  readonly running: number
  readonly unread: number
  readonly pending: number
  readonly idle: number
  readonly unarchived: number
  readonly archived: number
}

/** Whether a row is an ordinary conversation rather than a child or a seat. */
function isOrdinary(row: SessionRowLike): boolean {
  if (row.blank === true) return false
  if (row.origin === 'subagent') return false
  if (row.parentId !== undefined) return false
  return true
}

/**
 * Fold one unarchived ordinary Session into its activity bucket.
 *
 * Precedence is pending > running > unread > idle: a Session waiting for an
 * answer is the operator's next action even while its Agent is technically
 * alive, and a value the status stream has not established yet falls back to
 * the list row's own running flag.
 *
 * @param status - the Session's UI status, when the stream knows it.
 * @param row - the Session list row.
 * @returns the bucket key.
 */
function activityBucket(
  status: SessionStatusLike | undefined,
  row: SessionRowLike,
): 'pending' | 'running' | 'unread' | 'idle' {
  if (status?.pendingInteraction !== undefined) return 'pending'
  const running = status?.running ?? row.running
  if (running === true) return 'running'
  if (status?.completionUnread === true) return 'unread'
  return 'idle'
}

/** An all-zero result; also the safe answer for malformed snapshots. */
function zeroCounts(): SessionCounts {
  return { running: 0, unread: 0, pending: 0, idle: 0, unarchived: 0, archived: 0 }
}

/**
 * Count the six status metrics over one set of snapshots.
 *
 * @param list - the Session list snapshot, or anything shaped like it.
 * @param archivedIds - the registry-global archive set.
 * @param statuses - the UI status snapshot; absence falls back to row facts.
 * @returns the six counts, whose activity buckets always sum to the unarchived count.
 */
export function countSessions(
  list: SessionListLike | undefined | null,
  archivedIds: readonly unknown[] | undefined | null,
  statuses?: StatusMapLike | undefined | null,
): SessionCounts {
  if (list === undefined || list === null || !Array.isArray(list.ids)) return zeroCounts()
  const archived = new Set<string>()
  for (const id of archivedIds ?? []) archived.add(String(id))
  const byId = list.byId ?? {}
  const counts = zeroCounts() as {
    running: number
    unread: number
    pending: number
    idle: number
    unarchived: number
    archived: number
  }
  for (const raw of list.ids) {
    const id = String(raw)
    const row = byId[id]
    if (row === undefined || row === null) continue
    if (!isOrdinary(row)) continue
    if (archived.has(id)) {
      counts.archived += 1
      continue
    }
    counts.unarchived += 1
    const status = typeof statuses?.get === 'function' ? statuses.get(id) : undefined
    counts[activityBucket(status, row)] += 1
  }
  return counts
}

/**
 * Count the ordinary Sessions that are not in the archive set.
 *
 * Kept as the narrow entry point for callers that only need the archive split;
 * it is the same selection countSessions performs.
 *
 * @param list - the Session list snapshot, or anything shaped like it.
 * @param archivedIds - the registry-global archive set.
 * @returns the number of unarchived ordinary Sessions.
 */
export function countUnarchived(
  list: SessionListLike | undefined | null,
  archivedIds: readonly unknown[] | undefined | null,
): number {
  return countSessions(list, archivedIds).unarchived
}

/**
 * Normalize a configured threshold to a positive integer.
 * @param value - raw config value or a number typed into the Settings row.
 * @returns the threshold, or the shipped default when unusable.
 */
export function normalizeThreshold(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return DEFAULT_THRESHOLD
  const whole = Math.trunc(parsed)
  return whole >= 1 ? whole : DEFAULT_THRESHOLD
}

/**
 * Whether the unarchived count is past the threshold. Strictly greater:
 * the eleventh Session is the first warning.
 * @param count - unarchived ordinary Session count.
 * @param threshold - configured threshold.
 * @returns whether the unarchived metric belongs in the warning state.
 */
export function shouldWarn(count: number, threshold: number): boolean {
  return count > normalizeThreshold(threshold)
}
