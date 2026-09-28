/**
 * dsh-session-ledger — the cross-restart session ledger.
 *
 * A pure, framework-free state machine. Everything the plugin remembers about a
 * Session lives here, so the persistence rules are unit-testable without a
 * Harness and the browser half never re-derives them.
 *
 * Invariants:
 * - A Session is unread when it has an event newer than its read marker.
 * - An interrupted Session stays unread until it is continued, even if the
 *   operator opened it: the red marker means "this turn never finished".
 * - Read markers never move backwards.
 *
 * @module dsh-session-ledger/ledger
 */
/** Persisted document version; bump when the fold semantics change. */
export declare const LEDGER_VERSION = 1;
/** The only cancel cause that means a restart cut the turn off. */
export declare const INTERRUPT_CAUSE = "disposed";
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
/** One Session whose turn a restart cut off. */
export interface InterruptedRow {
    readonly sessionId: string;
    readonly at: number;
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
/** A continue was dispatched: both the red marker and the unread state clear. */
export declare function markContinued(ledger: LedgerState, sessionId: string, at: number): void;
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
/** Every Session whose turn a restart cut off, newest first. */
export declare function listInterrupted(ledger: LedgerState): InterruptedRow[];
