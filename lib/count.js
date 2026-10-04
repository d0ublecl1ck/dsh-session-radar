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
export const DEFAULT_THRESHOLD = 10;
/** Every metric the status readout can show, in display order. */
export const METRICS = ['running', 'unread', 'pending', 'idle', 'unarchived', 'archived'];
/** Whether a row is an ordinary conversation rather than a child or a seat. */
function isOrdinary(row) {
    if (row.blank === true)
        return false;
    if (row.origin === 'subagent')
        return false;
    if (row.parentId !== undefined)
        return false;
    return true;
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
function activityBucket(status, row) {
    if (status?.pendingInteraction !== undefined)
        return 'pending';
    const running = status?.running ?? row.running;
    if (running === true)
        return 'running';
    if (status?.completionUnread === true)
        return 'unread';
    return 'idle';
}
/** An all-zero result; also the safe answer for malformed snapshots. */
function zeroCounts() {
    return { running: 0, unread: 0, pending: 0, idle: 0, unarchived: 0, archived: 0 };
}
/**
 * Count the six status metrics over one set of snapshots.
 *
 * @param list - the Session list snapshot, or anything shaped like it.
 * @param archivedIds - the registry-global archive set.
 * @param statuses - the UI status snapshot; absence falls back to row facts.
 * @returns the six counts, whose activity buckets always sum to the unarchived count.
 */
export function countSessions(list, archivedIds, statuses) {
    if (list === undefined || list === null || !Array.isArray(list.ids))
        return zeroCounts();
    const archived = new Set();
    for (const id of archivedIds ?? [])
        archived.add(String(id));
    const byId = list.byId ?? {};
    const counts = zeroCounts();
    for (const raw of list.ids) {
        const id = String(raw);
        const row = byId[id];
        if (row === undefined || row === null)
            continue;
        if (!isOrdinary(row))
            continue;
        if (archived.has(id)) {
            counts.archived += 1;
            continue;
        }
        counts.unarchived += 1;
        const status = typeof statuses?.get === 'function' ? statuses.get(id) : undefined;
        counts[activityBucket(status, row)] += 1;
    }
    return counts;
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
export function countUnarchived(list, archivedIds) {
    return countSessions(list, archivedIds).unarchived;
}
/**
 * Normalize a configured threshold to a positive integer.
 * @param value - raw config value or a number typed into the Settings row.
 * @returns the threshold, or the shipped default when unusable.
 */
export function normalizeThreshold(value) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed))
        return DEFAULT_THRESHOLD;
    const whole = Math.trunc(parsed);
    return whole >= 1 ? whole : DEFAULT_THRESHOLD;
}
/**
 * Whether the unarchived count is past the threshold. Strictly greater:
 * the eleventh Session is the first warning.
 * @param count - unarchived ordinary Session count.
 * @param threshold - configured threshold.
 * @returns whether the unarchived metric belongs in the warning state.
 */
export function shouldWarn(count, threshold) {
    return count > normalizeThreshold(threshold);
}
//# sourceMappingURL=count.js.map