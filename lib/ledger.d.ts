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
export declare const LEDGER_VERSION = 3;
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
    /**
     * Epoch ms the currently open turn started, or null when no turn is open.
     * A process that finds a leftover value here died with that turn running.
     */
    runningSince: number | null;
    /**
     * The top-level Session this one was delegated from, or null for a
     * conversation the operator started. A subagent is not addressable, so this
     * link is the only way its reminder can ever be spent.
     */
    parentId: string | null;
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
    /**
     * The reminder is a turn that never finished. Reading the Session's tail does
     * not spend it on its own, so the browser has to know the difference.
     */
    readonly interrupted: boolean;
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
/** Record that a turn is running: until its boundary lands, nothing is missing. */
export declare function recordTurnStart(ledger: LedgerState, input: {
    sessionId: string;
    at: number;
    parentId?: string | null;
}): void;
/** Record one durable turn boundary. */
export declare function recordTurnEnd(ledger: LedgerState, input: {
    sessionId: string;
    at: number;
    kind: string;
    cause: string | null;
    parentId?: string | null;
}): void;
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
export declare function clearSupersededChildren(ledger: LedgerState, input: {
    parentId: string;
    at: number;
}): number;
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
export declare function adoptAbandonedTurns(ledger: LedgerState, processStartedAt: number): number;
/** Record a pending interaction: the agent is waiting for the operator. */
export declare function recordAttention(ledger: LedgerState, input: {
    sessionId: string;
    at: number;
    kind: string;
    parentId?: string | null;
}): void;
/** Advance a read marker to at least `at`; it never moves backwards. */
export declare function markRead(ledger: LedgerState, sessionId: string, at: number): void;
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
export declare function acknowledgeInterrupt(ledger: LedgerState, sessionId: string): void;
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
