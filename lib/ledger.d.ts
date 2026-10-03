/**
 * dsh-unread-helper — the cross-restart session ledger.
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
 * @module dsh-unread-helper/ledger
 */
/** Persisted document version; bump when the fold semantics change. */
export declare const LEDGER_VERSION = 1;
/** The graceful-dispose cancel cause that means a restart cut the turn off. */
export declare const INTERRUPT_CAUSE = "disposed";
/**
 * The `turn/end` reason DSH's crash repair writes for a turn nobody closed.
 * It reaches a plugin only through stored history: the closer is appended as a
 * constructor seed, and seeds never publish on `session/event`.
 */
export declare const INTERRUPT_REASON = "interrupted";
/** One stored session event, as the tail scanner reads it. */
export interface TailEventLike {
    readonly type?: unknown;
    readonly time?: unknown;
    readonly data?: unknown;
}
/** The restart-interrupted facts one stored turn boundary reports. */
export interface InterruptedTail {
    /** Epoch ms of the orphaned turn boundary. */
    readonly at: number;
    /** `turn/end` reason kind, in the shape `recordTurnEnd` takes. */
    readonly kind: string;
    /** Cancellation cause of an `aborted` boundary, else null. */
    readonly cause: string | null;
}
/** What one Session's row remembers. */
export interface LedgerEntry {
    /** Epoch ms of the last durable turn boundary. */
    lastTurnEndAt: number | null;
    /** `turn/end` reason kind: completed / aborted / blocked / max-tokens / ... */
    lastTurnEndKind: string | null;
    /** Epoch ms of the turn boundary that host disposal cut off, or null. */
    interruptedAt: number | null;
    /** Epoch ms of the last pending interaction. */
    lastAttentionAt: number | null;
    /** Pending interaction kind: approval / question / plan-review / ... */
    lastAttentionKind: string | null;
    /** Epoch ms the operator last acknowledged this Session. */
    lastReadAt: number | null;
}
/** The whole persisted document. */
export interface LedgerState {
    readonly version: number;
    sessions: Record<string, LedgerEntry>;
}
/** One unread Session, newest first. */
export interface UnreadRow {
    readonly sessionId: string;
    readonly at: number;
    readonly kind: string | null;
}
/** A fresh, empty ledger. */
export declare function emptyLedger(): LedgerState;
/**
 * Coerce persisted or hostile input into a valid ledger.
 *
 * Anything unrecognizable collapses to an empty ledger rather than throwing: a
 * corrupt file must never take the Harness down or hide real reminders.
 *
 * @param raw - parsed JSON of unknown shape.
 * @returns a valid ledger.
 */
export declare function normalizeLedger(raw: unknown): LedgerState;
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
export declare function isRestartInterrupt(kind: string, cause: string | null): boolean;
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
export declare function restartInterruptedTail(events: readonly TailEventLike[]): InterruptedTail | null;
/** Record one durable turn boundary. */
export declare function recordTurnEnd(ledger: LedgerState, input: {
    sessionId: string;
    at: number;
    kind: string;
    cause: string | null;
}): void;
/** Record a pending interaction: the agent is waiting for the operator. */
export declare function recordAttention(ledger: LedgerState, input: {
    sessionId: string;
    at: number;
    kind: string;
}): void;
/** Advance a read marker to at least `at`; it never moves backwards. */
export declare function markRead(ledger: LedgerState, sessionId: string, at: number): void;
/**
 * @param target - a Session id, or `{ sessionId, running }` when the caller knows
 *   the Session is currently running (a running Session is never a reminder).
 * @returns whether the Session still needs the operator's attention.
 */
export declare function isUnread(ledger: LedgerState, target: string | {
    readonly sessionId: string;
    readonly running?: boolean;
}): boolean;
/** Every unread Session, newest first. */
export declare function listUnread(ledger: LedgerState): UnreadRow[];
