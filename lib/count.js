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
 * A parent whose direct subagents are still running counts as running: the
 * shell paints that row ongoing, and the readout follows the shell.
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
 * the list row's own running flag. A live subagent makes its parent run too —
 * the shell paints that row ongoing — and it outranks a completion reminder the
 * same way the parent's own live turn does.
 *
 * @param status - the Session's UI status, when the stream knows it.
 * @param row - the Session list row.
 * @param liveSubagent - whether any direct subagent of this Session is running.
 * @returns the bucket key.
 */
function activityBucket(status, row, liveSubagent) {
    if (status?.pendingInteraction !== undefined)
        return 'pending';
    const running = status?.running ?? row.running;
    if (running === true || liveSubagent)
        return 'running';
    if (status?.completionUnread === true)
        return 'unread';
    return 'idle';
}
/** The empty bucket set; also the safe answer for malformed snapshots. */
function emptyBuckets() {
    return { running: [], unread: [], pending: [], idle: [], unarchived: [], archived: [] };
}
/** A Session's durable update instant, or 0 when the row carries none. */
function updatedAtOf(row) {
    return typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : 0;
}
/**
 * Whether one catalog row names a subagent that is running right now.
 *
 * The status stream is the primary evidence and the list row is the fallback,
 * exactly like the shell's own row status: a child whose status entry carries
 * no `running` value still falls through to its row, and a child with neither
 * leaves no evidence at all.
 *
 * @param child - one catalog entry, or anything shaped like one.
 * @param byId - the list's own rows, for children the stream has not reached.
 * @param statuses - the UI status snapshot, when one is installed.
 * @returns whether the child is running.
 */
function childRunning(child, byId, statuses) {
    const id = typeof child === 'object' && child !== null ? child.id : undefined;
    if (id === undefined || id === null)
        return false;
    const key = String(id);
    const status = typeof statuses?.get === 'function' ? statuses.get(key) : undefined;
    return (status?.running ?? byId[key]?.running) === true;
}
/**
 * Whether any direct subagent of one Session is running.
 *
 * Absence is never evidence: a shell without the projection store, a catalog
 * that is not a list, and a named child the readout can resolve no running
 * value for all leave the parent on its own state.
 *
 * @param catalog - the parent's `subagentCatalog` projection value, if any.
 * @param byId - the list's own rows, for children the stream has not reached.
 * @param statuses - the UI status snapshot, when one is installed.
 * @returns whether a live subagent makes the parent ongoing.
 */
function catalogHasRunningChild(catalog, byId, statuses) {
    if (!Array.isArray(catalog))
        return false;
    return catalog.some((child) => childRunning(child, byId, statuses));
}
/**
 * Group every ordinary Session under the metric that owns it, newest first.
 *
 * The buckets are the same fold the counts are read from, so a walk over one of
 * them can never visit a Session the number beside it does not count. Order is
 * the one the bell walks in: latest update first, and a row the list carries no
 * timestamp for keeps its own position at the end. Archived rows form their own
 * bucket and never appear in the unarchived one.
 *
 * @param list - the Session list snapshot, or anything shaped like it.
 * @param archivedIds - the registry-global archive set.
 * @param statuses - the UI status snapshot; absence falls back to row facts.
 * @returns one id list per metric, in walk order.
 */
export function classifySessions(list, archivedIds, statuses) {
    const buckets = emptyBuckets();
    if (list === undefined || list === null || !Array.isArray(list.ids))
        return buckets;
    const archived = new Set();
    for (const id of archivedIds ?? [])
        archived.add(String(id));
    const byId = list.byId ?? {};
    const rows = [];
    list.ids.forEach((id, index) => {
        const row = byId[String(id)];
        if (row === undefined || row === null)
            return;
        if (!isOrdinary(row))
            return;
        if (archived.has(String(id))) {
            rows.push({ id, bucket: 'archived', at: updatedAtOf(row), index });
            return;
        }
        const status = typeof statuses?.get === 'function' ? statuses.get(String(id)) : undefined;
        const catalog = list.projectionsBySession?.[String(id)]?.values?.subagentCatalog;
        const liveSubagent = catalogHasRunningChild(catalog, byId, statuses);
        rows.push({ id, bucket: activityBucket(status, row, liveSubagent), at: updatedAtOf(row), index });
    });
    // Two stable keys: the newest update leads, and equal timestamps (including
    // the undated rows) keep the list's own order.
    rows.sort((left, right) => right.at - left.at || left.index - right.index);
    for (const row of rows) {
        if (row.bucket === 'archived') {
            buckets.archived.push(row.id);
            continue;
        }
        buckets.unarchived.push(row.id);
        buckets[row.bucket].push(row.id);
    }
    return buckets;
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
    // The counts are the sizes of the walk buckets, so the number beside a metric
    // and the Sessions a press visits are always the same selection.
    const buckets = classifySessions(list, archivedIds, statuses);
    return {
        running: buckets.running.length,
        unread: buckets.unread.length,
        pending: buckets.pending.length,
        idle: buckets.idle.length,
        unarchived: buckets.unarchived.length,
        archived: buckets.archived.length,
    };
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