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
export const LEDGER_VERSION = 1;
/** The graceful-dispose cancel cause that means a restart cut the turn off. */
export const INTERRUPT_CAUSE = 'disposed';
/**
 * The `turn/end` reason DSH's crash repair writes for a turn nobody closed.
 * It reaches a plugin only through stored history: the closer is appended as a
 * constructor seed, and seeds never publish on `session/event`.
 */
export const INTERRUPT_REASON = 'interrupted';
/** A fresh, empty ledger. */
export function emptyLedger() {
    return { version: LEDGER_VERSION, sessions: {} };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function textOrNull(value) {
    return typeof value === 'string' && value !== '' ? value : null;
}
function normalizeEntry(raw) {
    if (!isRecord(raw))
        return null;
    return {
        lastTurnEndAt: finiteOrNull(raw.lastTurnEndAt),
        lastTurnEndKind: textOrNull(raw.lastTurnEndKind),
        interruptedAt: finiteOrNull(raw.interruptedAt),
        lastAttentionAt: finiteOrNull(raw.lastAttentionAt),
        lastAttentionKind: textOrNull(raw.lastAttentionKind),
        lastReadAt: finiteOrNull(raw.lastReadAt),
    };
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
export function normalizeLedger(raw) {
    if (!isRecord(raw) || !isRecord(raw.sessions))
        return emptyLedger();
    const ledger = emptyLedger();
    for (const [sessionId, entry] of Object.entries(raw.sessions)) {
        const normalized = normalizeEntry(entry);
        if (normalized !== null)
            ledger.sessions[sessionId] = normalized;
    }
    return ledger;
}
function entryOf(ledger, sessionId) {
    return Object.prototype.hasOwnProperty.call(ledger.sessions, sessionId)
        ? ledger.sessions[sessionId]
        : undefined;
}
function ensureEntry(ledger, sessionId) {
    const existing = entryOf(ledger, sessionId);
    if (existing !== undefined)
        return existing;
    const created = {
        lastTurnEndAt: null,
        lastTurnEndKind: null,
        interruptedAt: null,
        lastAttentionAt: null,
        lastAttentionKind: null,
        lastReadAt: null,
    };
    ledger.sessions[sessionId] = created;
    return created;
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
export function isRestartInterrupt(kind, cause) {
    if (kind === INTERRUPT_REASON)
        return true;
    return kind === 'aborted' && cause === INTERRUPT_CAUSE;
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
export function restartInterruptedTail(events) {
    let tail;
    let tailIndex = -1;
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event !== null && typeof event === 'object' && event.type === 'turn/end') {
            tail = event;
            tailIndex = index;
            break;
        }
    }
    if (tail === undefined)
        return null;
    const data = isRecord(tail.data) ? tail.data : null;
    const reason = data !== null && isRecord(data.reason) ? data.reason : null;
    const kind = reason !== null ? textOrNull(reason.kind) : null;
    if (kind === null)
        return null;
    const cause = reason !== null && isRecord(reason.reason) ? textOrNull(reason.reason.kind) : null;
    if (!isRestartInterrupt(kind, cause))
        return null;
    const at = finiteOrNull(tail.time);
    if (at === null)
        return null;
    for (let index = tailIndex + 1; index < events.length; index += 1) {
        const type = events[index]?.type;
        if (type === 'turn/start' || type === 'user/message')
            return null;
    }
    return { at, kind, cause };
}
/** Record one durable turn boundary. */
export function recordTurnEnd(ledger, input) {
    const entry = ensureEntry(ledger, input.sessionId);
    entry.lastTurnEndAt = finiteOrNull(input.at);
    entry.lastTurnEndKind = textOrNull(input.kind);
    entry.interruptedAt = isRestartInterrupt(input.kind, input.cause) ? finiteOrNull(input.at) : null;
}
/** Record a pending interaction: the agent is waiting for the operator. */
export function recordAttention(ledger, input) {
    const entry = ensureEntry(ledger, input.sessionId);
    entry.lastAttentionAt = finiteOrNull(input.at);
    entry.lastAttentionKind = textOrNull(input.kind);
}
/** Advance a read marker to at least `at`; it never moves backwards. */
export function markRead(ledger, sessionId, at) {
    const entry = entryOf(ledger, sessionId);
    if (entry === undefined)
        return;
    const mark = finiteOrNull(at);
    if (mark !== null && (entry.lastReadAt === null || mark > entry.lastReadAt)) {
        entry.lastReadAt = mark;
    }
}
function newestOf(entry) {
    const turnAt = entry.lastTurnEndAt;
    const attentionAt = entry.lastAttentionAt;
    if (turnAt === null && attentionAt === null)
        return null;
    if (attentionAt !== null && (turnAt === null || attentionAt > turnAt)) {
        return { at: attentionAt, kind: entry.lastAttentionKind };
    }
    return { at: turnAt ?? 0, kind: entry.lastTurnEndKind };
}
/**
 * @param target - a Session id, or `{ sessionId, running }` when the caller knows
 *   the Session is currently running (a running Session is never a reminder).
 * @returns whether the Session still needs the operator's attention.
 */
export function isUnread(ledger, target) {
    const sessionId = typeof target === 'string' ? target : target.sessionId;
    if (typeof target !== 'string' && target.running === true)
        return false;
    const entry = entryOf(ledger, sessionId);
    if (entry === undefined)
        return false;
    if (entry.interruptedAt !== null)
        return true;
    const newest = newestOf(entry);
    if (newest === null)
        return false;
    return entry.lastReadAt === null || newest.at > entry.lastReadAt;
}
/** Every unread Session, newest first. */
export function listUnread(ledger) {
    const rows = [];
    for (const sessionId of Object.keys(ledger.sessions)) {
        if (!isUnread(ledger, sessionId))
            continue;
        const entry = ledger.sessions[sessionId];
        const newest = newestOf(entry);
        if (newest === null)
            continue;
        rows.push({ sessionId, at: newest.at, kind: newest.kind });
    }
    return rows.sort((left, right) => right.at - left.at || (left.sessionId < right.sessionId ? -1 : 1));
}
//# sourceMappingURL=ledger.js.map