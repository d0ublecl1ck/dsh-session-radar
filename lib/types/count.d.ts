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
 * @module dsh-unread-helper/count
 */
/** Threshold used when configuration is absent or malformed. */
export declare const DEFAULT_THRESHOLD = 10;
/** Every metric the status readout can show, in display order. */
export declare const METRICS: readonly ["running", "unread", "pending", "idle", "unarchived", "archived"];
/** One metric key. */
export type Metric = (typeof METRICS)[number];
/** The row fields this module reads (a structural subset of the client summary). */
export interface SessionRowLike {
    readonly parentId?: unknown;
    readonly origin?: unknown;
    readonly blank?: unknown;
    /** Host running state, used when the status stream has no value yet. */
    readonly running?: unknown;
}
/** The list fields this module reads (a structural subset of SessionListState). */
export interface SessionListLike {
    readonly ids: readonly unknown[];
    readonly byId: Readonly<Record<string, SessionRowLike | undefined>>;
}
/** Independent UI status facts for one Session (structural subset of SessionStatus). */
export interface SessionStatusLike {
    /** Latest known running state; absent until a baseline or event establishes it. */
    readonly running?: unknown;
    /** Whether an observed stop outside the main view still needs acknowledgement. */
    readonly completionUnread?: unknown;
    /** Highest-precedence domain request currently awaiting user interaction. */
    readonly pendingInteraction?: unknown;
}
/** The status snapshot this module reads (a structural subset of SessionStatusSnapshot). */
export interface StatusMapLike {
    /** @param id - Session identity. @returns that Session's status, when known. */
    get(id: string): SessionStatusLike | undefined;
}
/** The six numbers the readout renders. */
export interface SessionCounts {
    readonly running: number;
    readonly unread: number;
    readonly pending: number;
    readonly idle: number;
    readonly unarchived: number;
    readonly archived: number;
}
/**
 * Count the six status metrics over one set of snapshots.
 *
 * @param list - the Session list snapshot, or anything shaped like it.
 * @param archivedIds - the registry-global archive set.
 * @param statuses - the UI status snapshot; absence falls back to row facts.
 * @returns the six counts, whose activity buckets always sum to the unarchived count.
 */
export declare function countSessions(list: SessionListLike | undefined | null, archivedIds: readonly unknown[] | undefined | null, statuses?: StatusMapLike | undefined | null): SessionCounts;
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
export declare function countUnarchived(list: SessionListLike | undefined | null, archivedIds: readonly unknown[] | undefined | null): number;
/**
 * Normalize a configured threshold to a positive integer.
 * @param value - raw config value or a number typed into the Settings row.
 * @returns the threshold, or the shipped default when unusable.
 */
export declare function normalizeThreshold(value: unknown): number;
/**
 * Whether the unarchived count is past the threshold. Strictly greater:
 * the eleventh Session is the first warning.
 * @param count - unarchived ordinary Session count.
 * @param threshold - configured threshold.
 * @returns whether the unarchived metric belongs in the warning state.
 */
export declare function shouldWarn(count: number, threshold: number): boolean;
