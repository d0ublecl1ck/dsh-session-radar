/**
 * dsh-session-ledger — the cross-restart session ledger.
 *
 * A pure, framework-free state machine. Everything the plugin remembers about a
 * Session lives here, so the persistence rules are unit-testable without a
 * Harness and the browser half never re-derives them.
 *
 * Invariants:
 * - A Session is unread when it has an event newer than its read marker.
 * - An interrupted Session stays unread until a later turn ends, even if the
 *   operator opened it: the red marker means "this turn never finished".
 * - Read markers never move backwards.
 *
 * @module dsh-session-ledger/ledger
 */

/** Persisted document version; bump when the fold semantics change. */
export const LEDGER_VERSION = 1

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
}

/** One Session whose turn a restart cut off. */
export interface InterruptedRow {
  readonly sessionId: string
  readonly at: number
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

/** Record one durable turn boundary. */
export function recordTurnEnd(
  ledger: LedgerState,
  input: { sessionId: string; at: number; kind: string; cause: string | null },
): void {
  const entry = ensureEntry(ledger, input.sessionId)
  entry.lastTurnEndAt = finiteOrNull(input.at)
  entry.lastTurnEndKind = textOrNull(input.kind)
  entry.interruptedAt = isRestartInterrupt(input.kind, input.cause) ? finiteOrNull(input.at) : null
}

/** Record a pending interaction: the agent is waiting for the operator. */
export function recordAttention(
  ledger: LedgerState,
  input: { sessionId: string; at: number; kind: string },
): void {
  const entry = ensureEntry(ledger, input.sessionId)
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

interface Newest {
  readonly at: number
  readonly kind: string | null
}

function newestOf(entry: LedgerEntry): Newest | null {
  const turnAt = entry.lastTurnEndAt
  const attentionAt = entry.lastAttentionAt
  if (turnAt === null && attentionAt === null) return null
  if (attentionAt !== null && (turnAt === null || attentionAt > turnAt)) {
    return { at: attentionAt, kind: entry.lastAttentionKind }
  }
  return { at: turnAt ?? 0, kind: entry.lastTurnEndKind }
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
    rows.push({ sessionId, at: newest.at, kind: newest.kind })
  }
  return rows.sort((left, right) => right.at - left.at || (left.sessionId < right.sessionId ? -1 : 1))
}

/** Every Session whose turn a restart cut off, newest first. */
export function listInterrupted(ledger: LedgerState): InterruptedRow[] {
  const rows: InterruptedRow[] = []
  for (const sessionId of Object.keys(ledger.sessions)) {
    const at = ledger.sessions[sessionId].interruptedAt
    if (at === null) continue
    rows.push({ sessionId, at })
  }
  return rows.sort((left, right) => right.at - left.at || (left.sessionId < right.sessionId ? -1 : 1))
}
