/**
 * The waiting-window projection: which Sessions the overview shows, split into
 * the two zones it renders.
 *
 * The module is deliberately free of React, DOM, and DSH services, exactly like
 * the activity projection it builds on. It does not re-derive visibility or
 * unread: it folds the activity list's own rows, so the window, the activity
 * list, and the badges can never disagree about who is waiting. The one rule it
 * adds is the split — a Session that both waits for an answer and carries an
 * unread completion is listed once, under the ask zone, because answering it is
 * the higher-priority action.
 *
 * @module dsh-session-radar/overview
 */
import {
  ACTIVITY_ROW_LIMIT, buildActivityGroups,
  type ActivityAttention, type ActivityInputs, type ActivityRow,
} from './activity-model.js'

/** One card the waiting window renders. */
export interface OverviewCard<Id extends string = string> {
  readonly id: Id
  readonly title: string
  /** Owning Workspace title, or the working-directory basename; empty when neither is known. */
  readonly folder: string
  readonly updatedAt: number
  /** The pending interaction kind, when this Session waits for an answer. */
  readonly pending: ActivityAttention | undefined
  /** Finished unviewed (or marked unread) and not yet opened. */
  readonly unread: boolean
  /** The Session the conversation column currently shows. */
  readonly current: boolean
}

/** The two zones the window renders, in the order it renders them. */
export interface Overview<Id extends string = string> {
  /** Sessions waiting for an answer, newest update first. */
  readonly ask: readonly OverviewCard<Id>[]
  /** Unread completions that are not also waiting, newest update first. */
  readonly unread: readonly OverviewCard<Id>[]
}

/** Default cap on rendered cards; it matches the activity list's own cap. */
export const OVERVIEW_LIMIT = ACTIVITY_ROW_LIMIT

function toCard<Id extends string>(row: ActivityRow<Id>): OverviewCard<Id> {
  return {
    id: row.id,
    title: row.title,
    folder: row.folder,
    updatedAt: row.updatedAt,
    pending: row.pending,
    unread: row.unread,
    current: row.current,
  }
}

/**
 * Project the Session, status, and Workspace snapshots into the waiting
 * window's two zones.
 *
 * @param inputs - Session, status, and Workspace snapshots.
 * @param now - render instant (epoch ms) used for the underlying day buckets.
 * @param limit - maximum rows the projection may consider.
 * @returns the ask zone and the unread zone, both newest update first.
 */
export function buildOverview<Id extends string = string>(
  inputs: ActivityInputs<Id>,
  now: number,
  limit: number = OVERVIEW_LIMIT,
): Overview<Id> {
  const rows = buildActivityGroups<Id>(inputs, now, limit).flatMap(group => group.rows)
  const ask: OverviewCard<Id>[] = []
  const unread: OverviewCard<Id>[] = []
  for (const row of rows) {
    if (row.pending !== undefined) {
      ask.push(toCard(row))
      continue
    }
    if (row.unread) unread.push(toCard(row))
  }
  return { ask, unread }
}
