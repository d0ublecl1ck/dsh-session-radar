/**
 * dsh-session-radar — the cross-restart session ledger.
 *
 * A pure, framework-free state machine. Everything the plugin remembers about a
 * Session lives here, so the persistence rules are unit-testable without a
 * Harness and the browser half never re-derives them.
 *
 * Invariants:
 * - A Session is unread when it has an event newer than its read marker.
 * - An interrupted Session stays unread until a later turn ends, even if the
 *   operator opened it: the red marker means "this turn never finished".
 * - An open turn is on the record: whoever starts the next process turns a
 *   leftover one into an interruption, so a run nothing ever closed is still
 *   remembered after the process that ran it is gone.
 * - Read markers never move backwards.
 *
 * @module dsh-session-radar/ledger
 */

/**
 * Persisted document version; bump when the fold semantics change.
 *
 * 3: an entry may carry `parentId`, the top-level conversation a subagent was
 *    delegated from — the link `clearSupersededChildren` spends reminders by.
 */
export const LEDGER_VERSION = 3

/** The graceful-dispose cancel cause that means a restart cut the turn off. */
export const INTERRUPT_CAUSE = 'disposed'

/**
 * The `turn/end` reason DSH's crash repair writes for a turn nobody closed.
 * It reaches a plugin only through stored history: the closer is appended as a
 * constructor seed, and seeds never publish on `session/event`.
 */
export const INTERRUPT_REASON = 'interrupted'

/** One stored session event, as the tail scanner reads it. */
export interface TailEventLike {
  readonly type?: unknown
  readonly time?: unknown
  readonly data?: unknown
}

/** The restart-interrupted facts one stored turn boundary reports. */
export interface InterruptedTail {
  /** Epoch ms of the orphaned turn boundary. */
  readonly at: number
  /** `turn/end` reason kind, in the shape `recordTurnEnd` takes. */
  readonly kind: string
  /** Cancellation cause of an `aborted` boundary, else null. */
  readonly cause: string | null
}

/** What one Session's row remembers. */
export interface LedgerEntry {
  /** Epoch ms of the last durable turn boundary. */
  lastTurnEndAt: number | null
  /** `turn/end` reason kind: completed / aborted / blocked / max-tokens / ... */
  lastTurnEndKind: string | null
  /** Epoch ms of the turn boundary that host disposal cut off, or null. */
  interruptedAt: number | null
  /** Epoch ms of the last pending interaction. */
  lastAttentionAt: number | null
  /** Pending interaction kind: approval / question / plan-review / ... */
  lastAttentionKind: string | null
  /** Epoch ms the operator last acknowledged this Session. */
  lastReadAt: number | null
  /**
   * Epoch ms the currently open turn started, or null when no turn is open.
   * A process that finds a leftover value here died with that turn running.
   */
  runningSince: number | null
  /**
   * The top-level Session this one was delegated from, or null for a
   * conversation the operator started. A subagent is not addressable, so this
   * link is the only way its reminder can ever be spent.
   */
  parentId: string | null
}

/** The whole persisted document. */
export interface LedgerState {
  readonly version: number
  sessions: Record<string, LedgerEntry>
}

/** One unread Session, newest first. */
export interface UnreadRow {
  readonly sessionId: string
  readonly at: number
  readonly kind: string | null
  /**
   * The reminder is a turn that never finished. Reading the Session's tail does
   * not spend it on its own, so the browser has to know the difference.
   */
  readonly interrupted: boolean
}

/** A fresh, empty ledger. */
export function emptyLedger(): LedgerState {
  return { version: LEDGER_VERSION, sessions: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function normalizeEntry(raw: unknown): LedgerEntry | null {
  if (!isRecord(raw)) return null
  return {
    lastTurnEndAt: finiteOrNull(raw.lastTurnEndAt),
    lastTurnEndKind: textOrNull(raw.lastTurnEndKind),
    interruptedAt: finiteOrNull(raw.interruptedAt),
    lastAttentionAt: finiteOrNull(raw.lastAttentionAt),
    lastAttentionKind: textOrNull(raw.lastAttentionKind),
    lastReadAt: finiteOrNull(raw.lastReadAt),
    runningSince: finiteOrNull(raw.runningSince),
    parentId: textOrNull(raw.parentId),
  }
}

/**
 * Coerce persisted or hostile input into a valid ledger.
 *
 * Anything unrecognizable collapses to an empty ledger rather than throwing: a
 * corrupt file must never take the Harness down or hide real reminders.
 *
 * @param raw - parsed JSON of unknown shape.
 * @returns a valid ledger.
 */
export function normalizeLedger(raw: unknown): LedgerState {
  if (!isRecord(raw) || !isRecord(raw.sessions)) return emptyLedger()
  const ledger = emptyLedger()
  for (const [sessionId, entry] of Object.entries(raw.sessions)) {
    const normalized = normalizeEntry(entry)
    if (normalized !== null) ledger.sessions[sessionId] = normalized
  }
  return ledger
}

function entryOf(ledger: LedgerState, sessionId: string): LedgerEntry | undefined {
  return Object.prototype.hasOwnProperty.call(ledger.sessions, sessionId)
    ? ledger.sessions[sessionId]
    : undefined
}

function ensureEntry(ledger: LedgerState, sessionId: string): LedgerEntry {
  const existing = entryOf(ledger, sessionId)
  if (existing !== undefined) return existing
  const created: LedgerEntry = {
    lastTurnEndAt: null,
    lastTurnEndKind: null,
    interruptedAt: null,
    lastAttentionAt: null,
    lastAttentionKind: null,
    lastReadAt: null,
    runningSince: null,
    parentId: null,
  }
  ledger.sessions[sessionId] = created
  return created
}

/**
 * Whether one durable turn boundary means a restart cut the turn off.
 *
 * Two signals reach the ledger: a graceful host dispose publishes `aborted`
 * with the `disposed` cancel cause on the live firehose, while a crash leaves
 * the turn open until DSH's repair closes it with a synthetic `interrupted`
 * boundary that only stored history carries.
 *
 * @param kind - `turn/end` reason kind.
 * @param cause - cancel cause for an `aborted` boundary, else null.
 * @returns whether the boundary was caused by a restart rather than the operator.
 */
export function isRestartInterrupt(kind: string, cause: string | null): boolean {
  if (kind === INTERRUPT_REASON) return true
  return kind === 'aborted' && cause === INTERRUPT_CAUSE
}

/**
 * Read a stored session history's last `turn/end` and report a restart orphan.
 *
 * A resumed Session carries its repaired tail as a constructor seed, so this
 * snapshot scan is the only way a plugin can see it. A later `turn/start` or
 * `user/message` supersedes the orphan, and a boundary without a usable time
 * or reason is ignored rather than guessed at.
 *
 * @param events - the stored history, oldest first.
 * @returns the orphan's facts, or null when the tail is not a restart orphan.
 */
export function restartInterruptedTail(events: readonly TailEventLike[]): InterruptedTail | null {
  let tail: TailEventLike | undefined
  let tailIndex = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event !== null && typeof event === 'object' && event.type === 'turn/end') {
      tail = event
      tailIndex = index
      break
    }
  }
  if (tail === undefined) return null
  const data = isRecord(tail.data) ? tail.data : null
  const reason = data !== null && isRecord(data.reason) ? data.reason : null
  const kind = reason !== null ? textOrNull(reason.kind) : null
  if (kind === null) return null
  const cause = reason !== null && isRecord(reason.reason) ? textOrNull(reason.reason.kind) : null
  if (!isRestartInterrupt(kind, cause)) return null
  const at = finiteOrNull(tail.time)
  if (at === null) return null
  for (let index = tailIndex + 1; index < events.length; index += 1) {
    const type = events[index]?.type
    if (type === 'turn/start' || type === 'user/message') return null
  }
  return { at, kind, cause }
}

/**
 * Remember the conversation a Session was delegated from.
 *
 * The link is write-once: a later event whose header cannot be read must not
 * erase a parent the ledger already knows, or the child's reminder could never
 * be spent again.
 *
 * @param entry - the entry being written.
 * @param parentId - the header's parent, when it carries one.
 */
function rememberParent(entry: LedgerEntry, parentId: string | null | undefined): void {
  const parent = textOrNull(parentId)
  if (parent !== null) entry.parentId = parent
}

/** Record that a turn is running: until its boundary lands, nothing is missing. */
export function recordTurnStart(
  ledger: LedgerState,
  input: { sessionId: string; at: number; parentId?: string | null },
): void {
  const entry = ensureEntry(ledger, input.sessionId)
  rememberParent(entry, input.parentId)
  entry.runningSince = finiteOrNull(input.at)
}

/** Record one durable turn boundary. */
export function recordTurnEnd(
  ledger: LedgerState,
  input: { sessionId: string; at: number; kind: string; cause: string | null; parentId?: string | null },
): void {
  const entry = ensureEntry(ledger, input.sessionId)
  rememberParent(entry, input.parentId)
  entry.lastTurnEndAt = finiteOrNull(input.at)
  entry.lastTurnEndKind = textOrNull(input.kind)
  entry.interruptedAt = isRestartInterrupt(input.kind, input.cause) ? finiteOrNull(input.at) : null
  entry.runningSince = null
}

/**
 * Spend the reminders of the subagents a conversation has already moved past.
 *
 * A cut-off subagent is only worth a row while the conversation that started it
 * has not run again: once the parent *begins* a new turn it has taken the work
 * over. Only a turn that started strictly after the child was cut counts — the
 * turn a parent was already running when the subagent was cut off is exactly
 * the case the row exists for (the parent finished its own turn and never
 * looked back).
 *
 * @param ledger - ledger to edit.
 * @param input - the parent that started a turn, and that turn's instant.
 * @returns how many child markers were spent (0 means nothing to write back).
 */
export function clearSupersededChildren(ledger: LedgerState, input: { parentId: string; at: number }): number {
  if (!Number.isFinite(input.at)) return 0
  let spent = 0
  for (const entry of Object.values(ledger.sessions)) {
    if (entry.parentId !== input.parentId) continue
    const interruptedAt = entry.interruptedAt
    // Only a turn that started strictly after the child was cut is a
    // supersession: the turn the parent was already running when the subagent
    // was cut off is exactly the case the reminder exists for.
    if (interruptedAt === null || interruptedAt >= input.at) continue
    entry.interruptedAt = null
    spent += 1
  }
  return spent
}

/**
 * Turn every turn still marked open into an interruption, once per process.
 *
 * A process that starts reads the ledger the previous one left behind. A turn
 * still marked open there is a turn nothing closed: DSH's own repair signal
 * only reaches a plugin when the Session is resumed, and a hard kill never
 * publishes one at all, so this leftover is the only proof the run was cut off.
 *
 * A marker dated at or after this process's own start belongs to *this* run —
 * a remount only re-read the file — and a boundary newer than the marker means
 * the turn did close, so neither is an interruption.
 *
 * @param ledger - the freshly loaded ledger.
 * @param processStartedAt - epoch ms this process began.
 * @returns how many open-turn markers were spent (0 means nothing to write back).
 */
export function adoptAbandonedTurns(ledger: LedgerState, processStartedAt: number): number {
  let spent = 0
  for (const entry of Object.values(ledger.sessions)) {
    const openedAt = entry.runningSince
    if (openedAt === null) continue
    entry.runningSince = null
    spent += 1
    if (openedAt >= processStartedAt) continue
    if (entry.lastTurnEndAt !== null && entry.lastTurnEndAt >= openedAt) continue
    entry.interruptedAt = openedAt
  }
  return spent
}

/** Record a pending interaction: the agent is waiting for the operator. */
export function recordAttention(
  ledger: LedgerState,
  input: { sessionId: string; at: number; kind: string; parentId?: string | null },
): void {
  const entry = ensureEntry(ledger, input.sessionId)
  rememberParent(entry, input.parentId)
  entry.lastAttentionAt = finiteOrNull(input.at)
  entry.lastAttentionKind = textOrNull(input.kind)
}

/** Advance a read marker to at least `at`; it never moves backwards. */
export function markRead(ledger: LedgerState, sessionId: string, at: number): void {
  const entry = entryOf(ledger, sessionId)
  if (entry === undefined) return
  const mark = finiteOrNull(at)
  if (mark !== null && (entry.lastReadAt === null || mark > entry.lastReadAt)) {
    entry.lastReadAt = mark
  }
}

/**
 * Drop the restart-interrupt marker once the operator has read the Session.
 *
 * A plain read (opening the Session) deliberately leaves the marker alone, so a
 * quick glance cannot excuse an unfinished turn. Reaching the conversation's
 * tail is the acknowledgement: the browser reports that read with this separate
 * step, and the reminder stops coming back when the operator scrolls away.
 *
 * @param ledger - ledger to edit.
 * @param sessionId - Session to acknowledge.
 */
export function acknowledgeInterrupt(ledger: LedgerState, sessionId: string): void {
  const entry = entryOf(ledger, sessionId)
  if (entry === undefined) return
  entry.interruptedAt = null
}

interface Newest {
  readonly at: number
  readonly kind: string | null
}

/**
 * The newest fact on one Session's row, so the reminder is dated by whatever
 * armed it: the boundary, the pending question, or the orphaned turn.
 */
function newestOf(entry: LedgerEntry): Newest | null {
  let newest: Newest | null = null
  const consider = (at: number | null, kind: string | null): void => {
    if (at === null) return
    if (newest === null || at > newest.at) newest = { at, kind }
  }
  consider(entry.lastTurnEndAt, entry.lastTurnEndKind)
  consider(entry.lastAttentionAt, entry.lastAttentionKind)
  consider(entry.interruptedAt, INTERRUPT_REASON)
  return newest
}

/**
 * @param target - a Session id, or `{ sessionId, running }` when the caller knows
 *   the Session is currently running (a running Session is never a reminder).
 * @returns whether the Session still needs the operator's attention.
 */
export function isUnread(
  ledger: LedgerState,
  target: string | { readonly sessionId: string; readonly running?: boolean },
): boolean {
  const sessionId = typeof target === 'string' ? target : target.sessionId
  if (typeof target !== 'string' && target.running === true) return false
  const entry = entryOf(ledger, sessionId)
  if (entry === undefined) return false
  if (entry.interruptedAt !== null) return true
  const newest = newestOf(entry)
  if (newest === null) return false
  return entry.lastReadAt === null || newest.at > entry.lastReadAt
}

/** Every unread Session, newest first. */
export function listUnread(ledger: LedgerState): UnreadRow[] {
  const rows: UnreadRow[] = []
  for (const sessionId of Object.keys(ledger.sessions)) {
    if (!isUnread(ledger, sessionId)) continue
    const entry = ledger.sessions[sessionId]
    const newest = newestOf(entry)
    if (newest === null) continue
    rows.push({
      sessionId,
      at: newest.at,
      kind: newest.kind,
      interrupted: entry.interruptedAt !== null,
    })
  }
  return rows.sort((left, right) => right.at - left.at || (left.sessionId < right.sessionId ? -1 : 1))
}
