/**
 * The restart-retry dialog's pure half.
 *
 * After a restart the ledger knows which Sessions were cut off mid-turn. This
 * module decides which of them the dialog offers, what starts checked, and how
 * a selection turns into prompts — no React, no transport, so the rules are
 * unit-testable and the component only renders them.
 *
 * A Session that is already running is never offered as retryable: sending it
 * another prompt would queue a second turn behind the one nobody asked about.
 *
 * @module dsh-session-radar/client/retry-model
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { pathBasename } from '../activity-model.js'

/** One ledger reminder, as the host snapshot reports it. */
export interface RetryReminder {
  readonly sessionId: string
  readonly at: number
  readonly interrupted: boolean
}

/** The Session facts the dialog labels a row with. */
export interface RetrySession {
  readonly id: SessionId
  readonly displayTitle: string
  readonly cwd?: string | undefined
  readonly running: boolean
  /** Coarse durable origin; a subagent conversation is not addressable as a prompt target. */
  readonly origin?: 'subagent' | undefined
  /**
   * Direct parent of a subagent conversation. The list only sets `origin` for
   * part of them (measured 2026-10-08: 172 rows carry a parent, 149 carry the
   * origin), so the parent is the reliable marker.
   */
  readonly parentId?: SessionId | undefined
}

/** One Workspace registry row, for the folder label. */
export interface RetryWorkspace {
  readonly workspaceId: string
  readonly title: string
  readonly sessionIds: readonly SessionId[]
}

/** Everything the candidate list is projected from. */
export interface RetryInputs {
  readonly reminders: readonly RetryReminder[]
  readonly sessions: {
    readonly ids: readonly SessionId[]
    readonly byId: Readonly<Record<string, RetrySession | undefined>>
  }
  readonly workspaces: { readonly items: readonly RetryWorkspace[] }
}

/** One row the dialog renders. */
export interface RetryCandidate {
  readonly id: SessionId
  readonly title: string
  readonly folder: string
  /** Epoch ms the turn was cut off. */
  readonly at: number
  /** Already running, so this row cannot be picked. */
  readonly running: boolean
}

/** What one prompt attempt reported back. */
export type RetrySendResult = { readonly ok: true } | { readonly ok: false; readonly message: string }

/** How a batch of attempts ended. */
export interface RetryOutcome {
  readonly sent: readonly SessionId[]
  readonly failed: readonly { readonly id: SessionId; readonly message: string }[]
}

function folderIndex(workspaces: readonly RetryWorkspace[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!index.has(sessionId)) index.set(sessionId, workspace.title)
    }
  }
  return index
}

/**
 * Project the ledger's interrupted reminders into dialog rows, newest first.
 *
 * A reminder whose Session is no longer in the list is dropped rather than
 * guessed at: the dialog can only promise a retry for a Session the client can
 * address.
 *
 * Subagent conversations are dropped for the same reason the browsing region
 * hides them: they are not top-level prompt targets at all — the host answers
 * `session/prompt` for one with `session/not-found` (measured 2026-10-08). Only
 * the outer Session is offered, and its retry message asks it to look after the
 * subagents it started.
 *
 * @param inputs - ledger reminders plus the Session and Workspace snapshots.
 * @returns the rows the dialog offers.
 */
export function buildRetryCandidates(inputs: RetryInputs): RetryCandidate[] {
  const folders = folderIndex(inputs.workspaces.items)
  const rows: RetryCandidate[] = []
  for (const reminder of inputs.reminders) {
    if (!reminder.interrupted) continue
    const session = inputs.sessions.byId[reminder.sessionId]
    if (session === undefined || isSubagent(session)) continue
    const id = session.id
    rows.push({
      id,
      title: session.displayTitle === '' ? id : session.displayTitle,
      folder: folders.get(id) ?? pathBasename(session.cwd) ?? '',
      at: reminder.at,
      running: session.running,
    })
  }
  return rows.sort((left, right) => right.at - left.at || (left.id < right.id ? -1 : 1))
}

/** Whether one Session is a subagent conversation rather than a top-level one. */
function isSubagent(session: RetrySession): boolean {
  return session.origin === 'subagent' || session.parentId !== undefined
}

/** Whether one row may be picked. */
function selectable(row: RetryCandidate): boolean {
  return !row.running
}

/** The selection a freshly opened dialog starts with: everything retryable. */
export function defaultSelection(candidates: readonly RetryCandidate[]): ReadonlySet<SessionId> {
  const selection = new Set<SessionId>()
  for (const row of candidates) if (selectable(row)) selection.add(row.id)
  return selection
}

/**
 * Toggle one id.
 *
 * The component only offers ids its rows carry, and {@link selectedIds} filters
 * against those rows anyway, so a stale id in the selection can never be sent.
 *
 * @param selection - the current selection.
 * @param id - the id to flip.
 * @returns the next selection.
 */
export function toggleOne(selection: ReadonlySet<SessionId>, id: SessionId): ReadonlySet<SessionId> {
  const next = new Set(selection)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Whether every retryable row is already selected.
 *
 * @param candidates - the offered rows.
 * @param selection - the current selection.
 * @returns true when nothing retryable is left unpicked.
 */
export function allRetryableSelected(
  candidates: readonly RetryCandidate[],
  selection: ReadonlySet<SessionId>,
): boolean {
  const retryable = candidates.filter(selectable)
  return retryable.length > 0 && retryable.every((row) => selection.has(row.id))
}

/**
 * Select every retryable row, or clear the selection when they all already are.
 *
 * @param candidates - the offered rows.
 * @param selection - the current selection.
 * @returns the next selection.
 */
export function toggleAll(
  candidates: readonly RetryCandidate[],
  selection: ReadonlySet<SessionId>,
): ReadonlySet<SessionId> {
  if (allRetryableSelected(candidates, selection)) return new Set()
  return new Set(candidates.filter(selectable).map((row) => row.id))
}

/**
 * The ids one send covers, in the order the dialog lists them.
 *
 * The running rows are dropped here as well as in the checkbox, so a stale
 * selection can never queue a turn behind a live one.
 *
 * @param candidates - the offered rows.
 * @param selection - the current selection.
 * @returns the ids to prompt, in row order.
 */
export function selectedIds(
  candidates: readonly RetryCandidate[],
  selection: ReadonlySet<SessionId>,
): SessionId[] {
  return candidates.filter((row) => selectable(row) && selection.has(row.id)).map((row) => row.id)
}

/**
 * Send the retry message to each selected Session, one at a time.
 *
 * Serial on purpose: every accepted prompt starts a turn, and firing eight at
 * once would wake eight agents in the same instant. An accepted prompt is
 * acknowledged immediately (its reminder is spent); a refused one keeps its
 * reminder and its reason, and the batch carries on.
 *
 * @param input - the ids, the prompt transport, and the acknowledgement sink.
 * @returns the accepted and refused ids.
 */
export async function retrySelected(input: {
  readonly ids: readonly SessionId[]
  readonly send: (id: SessionId) => Promise<RetrySendResult>
  readonly acknowledge: (id: SessionId) => void
}): Promise<RetryOutcome> {
  const sent: SessionId[] = []
  const failed: { id: SessionId; message: string }[] = []
  for (const id of input.ids) {
    try {
      const result = await input.send(id)
      if (result.ok) {
        sent.push(id)
        input.acknowledge(id)
      } else {
        failed.push({ id, message: result.message })
      }
    } catch (error: unknown) {
      failed.push({ id, message: String((error as Error)?.message ?? error) })
    }
  }
  return { sent, failed }
}
