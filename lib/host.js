/**
 * dsh-session-radar — host behavior.
 *
 * Owns the one thing the browser half cannot own: memory that survives a
 * restart. It records durable turn boundaries and pending interactions, keeps
 * the read markers the browser reports, persists the ledger under DSH_HOME, and
 * answers the browser through its own authenticated webServer route.
 *
 * The Typert Remote path is closed to a hand-written contribution: the gateway
 * validates descriptors against generated metadata and refuses them. A
 * webServer route plus the connection's trust fence needs no such metadata.
 *
 * @module dsh-session-radar/host
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { acknowledgeInterrupt, adoptAbandonedTurns, clearSupersededChildren, emptyLedger, listUnread, markRead, normalizeLedger, recordAttention, recordTurnEnd, recordTurnStart, restartInterruptedTail, } from './ledger.js';
/** Stable cordis plugin name (the bundle row's id is `session-radar`). */
export const name = 'session-radar';
/** The authenticated route the browser half posts to. */
const ROUTE_PATH = '/session-radar';
/** File name under DSH_HOME. */
const STATE_FILE = 'session-radar.json';
/**
 * Ledger file names this plugin wrote before the 1.0 rename. The ledger is the
 * plugin's only durable state, so the first load after the rename carries the
 * older file over instead of starting empty.
 */
const LEGACY_STATE_FILES = ['unread-helper.json'];
/** Coalesce bursts of events into one write. */
const PERSIST_DEBOUNCE_MS = 250;
/**
 * Mount the host half.
 *
 * @param rawCtx - host cordis context.
 */
export function mount(rawCtx) {
    const ctx = rawCtx;
    /**
     * When this process began, in the ledger's own clock. A turn marked open
     * before this instant was left behind by the previous process; one marked
     * after it belongs to this run.
     */
    const processStartedAt = Date.now() - Math.round(process.uptime() * 1000);
    const homePath = ctx.get('dshHomePath');
    const statePath = typeof homePath === 'function'
        ? homePath(STATE_FILE)
        : join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), STATE_FILE);
    let ledger = emptyLedger();
    let hydrated = false;
    let loading = null;
    let persistTimer = null;
    let persistChain = Promise.resolve();
    const warn = (message) => {
        ctx.logger?.warn(message);
    };
    function persistNow() {
        const payload = JSON.stringify(ledger, null, 2);
        persistChain = persistChain
            .then(async () => {
            await mkdir(dirname(statePath), { recursive: true });
            const temporary = statePath + '.tmp-' + process.pid + '-' + Date.now();
            await writeFile(temporary, payload, 'utf8');
            await rename(temporary, statePath);
        })
            .catch((error) => {
            warn('session-radar: could not persist ' + statePath + ': ' + String(error));
        });
        return persistChain;
    }
    function schedulePersist() {
        if (persistTimer !== null)
            return;
        persistTimer = setTimeout(() => {
            persistTimer = null;
            void persistNow();
        }, PERSIST_DEBOUNCE_MS);
        persistTimer.unref?.();
    }
    /**
     * Read the pre-rename ledger file, if one is still there.
     *
     * @returns the normalized state, or null when no legacy file is readable.
     */
    async function readLegacyLedger() {
        for (const file of LEGACY_STATE_FILES) {
            try {
                return normalizeLedger(JSON.parse(await readFile(join(dirname(statePath), file), 'utf8')));
            }
            catch {
                // A missing or unreadable legacy file is simply skipped.
            }
        }
        return null;
    }
    function load() {
        loading ??= (async () => {
            try {
                ledger = normalizeLedger(JSON.parse(await readFile(statePath, 'utf8')));
            }
            catch (error) {
                const code = error?.code;
                if (code === 'ENOENT') {
                    const carried = await readLegacyLedger();
                    if (carried === null) {
                        ledger = emptyLedger();
                    }
                    else {
                        ledger = carried;
                        warn('session-radar: carried the ledger over from ' + LEGACY_STATE_FILES.join(', '));
                        await persistNow();
                    }
                }
                else {
                    warn('session-radar: ignoring unreadable ' + statePath + ': ' + String(error));
                    ledger = emptyLedger();
                }
            }
            hydrated = true;
        })();
        return loading;
    }
    /**
     * Run one ledger mutation once the persisted state is in memory.
     *
     * Durable events and restored Sessions can both arrive while the file is
     * still being read; applying them to the placeholder would let the load
     * overwrite the newer facts.
     */
    function whenLoaded(apply) {
        if (hydrated) {
            apply();
            return;
        }
        void load().then(apply);
    }
    function sessionIdOf(session) {
        const id = session?.id;
        return typeof id === 'string' && id !== '' ? id : null;
    }
    /**
     * The conversation a subagent Session was delegated from, per its header.
     *
     * This is the same field the official controller reads when it authorizes a
     * subagent call (`session.header.parentSession`), and it is the only place a
     * plugin can learn the link: a subagent is never addressable, so nothing can
     * ever spend its reminder directly.
     */
    function parentIdOf(session) {
        const parent = session?.header?.parentSession;
        return typeof parent === 'string' && parent !== '' ? parent : null;
    }
    /** One live Session's stored history, or null when it exposes none. */
    function storedEventsOf(session) {
        const candidate = session;
        try {
            if (typeof candidate?.snapshotEvents === 'function') {
                const events = candidate.snapshotEvents();
                return Array.isArray(events) ? events : null;
            }
            if (Array.isArray(candidate?.events))
                return candidate.events;
        }
        catch (error) {
            warn('session-radar: could not read a stored Session history: ' + String(error));
        }
        return null;
    }
    /**
     * Recover a restart orphan from one Session's stored history.
     *
     * DSH's crash repair closes an interrupted tail with a synthetic `turn/end`
     * that arrives as a constructor seed, and seeds never publish on
     * `session/event` — so a resumed Session's orphan is invisible to the live
     * listener and has to be read off the snapshot instead.
     */
    function recordRestoredTail(session) {
        const sessionId = sessionIdOf(session);
        if (sessionId === null)
            return;
        const events = storedEventsOf(session);
        if (events === null)
            return;
        const tail = restartInterruptedTail(events);
        if (tail === null)
            return;
        recordTurnEnd(ledger, {
            sessionId,
            at: tail.at,
            kind: tail.kind,
            cause: tail.cause,
            parentId: parentIdOf(session),
        });
        schedulePersist();
    }
    /** Sessions restored before this plugin mounted never announce themselves. */
    function scanRestoredSessions() {
        try {
            const agents = ctx.get('agents');
            if (agents === undefined || typeof agents.list !== 'function')
                return;
            for (const agent of (agents.list() ?? [])) {
                recordRestoredTail(agent?.session);
            }
        }
        catch (error) {
            warn('session-radar: could not scan restored Sessions: ' + String(error));
        }
    }
    // ── durable session events ─────────────────────────────────────────────
    // A resumed Session announces itself with its repaired tail already seeded.
    ctx.on('session/created', (...args) => {
        const session = args[0];
        try {
            whenLoaded(() => recordRestoredTail(session));
        }
        catch (error) {
            warn('session-radar: could not scan a restored Session: ' + String(error));
        }
    });
    ctx.on('session/event', (...args) => {
        const session = args[0];
        const event = args[1];
        const sessionId = sessionIdOf(session);
        if (sessionId === null || event === null || typeof event !== 'object')
            return;
        const at = typeof event.time === 'number' ? event.time : Date.now();
        const parentId = parentIdOf(session);
        whenLoaded(() => {
            if (event.type === 'turn/start') {
                recordTurnStart(ledger, { sessionId, at, parentId });
                // A conversation that runs again has taken over the subagents it left
                // behind: their cut-off turns are no longer the operator's next action.
                clearSupersededChildren(ledger, { parentId: sessionId, at });
                schedulePersist();
                return;
            }
            if (event.type === 'turn/end') {
                const reason = event.data?.reason ?? {};
                const kind = typeof reason.kind === 'string' ? reason.kind : 'unknown';
                const cause = typeof reason.reason?.kind === 'string' ? reason.reason.kind : null;
                recordTurnEnd(ledger, { sessionId, at, kind, cause, parentId });
                schedulePersist();
                return;
            }
            if (event.type === 'approval/asked') {
                recordAttention(ledger, { sessionId, at, kind: 'approval', parentId });
                schedulePersist();
                return;
            }
            // Sending a message is the operator engaging with the Session: read.
            if (event.type === 'user/message') {
                markRead(ledger, sessionId, at);
                schedulePersist();
            }
        });
    });
    // ask_user_question is not a session event; the tool dispatch is.
    ctx.on('tools/execute', async (...args) => {
        const exec = args[0];
        const next = args[1];
        try {
            if (exec?.name === 'ask_user_question') {
                const sessionId = sessionIdOf(exec.agent?.session);
                if (sessionId !== null) {
                    const at = Date.now();
                    whenLoaded(() => {
                        recordAttention(ledger, { sessionId, at, kind: 'question', parentId: parentIdOf(exec.agent?.session) });
                        schedulePersist();
                    });
                }
            }
        }
        catch {
            /* reminder bookkeeping must never break a tool call */
        }
        return next();
    });
    function snapshot() {
        return {
            now: Date.now(),
            bootAt: processStartedAt,
            unread: listUnread(ledger),
        };
    }
    // ── browser route ─────────────────────────────────────────────────────
    const rejected = (req, res) => {
        const connection = ctx.get('connection');
        const rejection = connection?.requestRejection?.(req);
        if (rejection === undefined)
            return false;
        res.statusCode = rejection;
        res.end();
        return true;
    };
    const sendJson = (res, status, value) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(value));
    };
    function endpointOf(url) {
        const pathname = new URL(String(url), 'http://localhost').pathname;
        return pathname.startsWith(ROUTE_PATH + '/') ? pathname.slice(ROUTE_PATH.length + 1) : '';
    }
    function readBody(req) {
        return new Promise((resolve) => {
            let raw = '';
            req.on('data', (chunk) => { raw += String(chunk); });
            req.on('end', () => {
                try {
                    resolve(raw === '' ? {} : JSON.parse(raw));
                }
                catch {
                    resolve({});
                }
            });
        });
    }
    async function dispatch(endpoint, body) {
        await ready;
        if (endpoint === 'list')
            return { status: 200, value: { ok: true, value: snapshot() } };
        if (endpoint === 'read') {
            if (typeof body?.sessionId !== 'string') {
                return { status: 400, value: { ok: false, error: { code: 'bad-request', message: 'sessionId must be a string' } } };
            }
            // A tail read acknowledges a restart-interrupted turn; a plain open does
            // not. The row that was accepted may stand in for Sessions that are not
            // addressable at all (subagents), so one read can spend several ids: none
            // of them can ever be acknowledged on their own.
            const acknowledge = body?.acknowledgeInterrupt === true;
            const now = Date.now();
            const spends = [body.sessionId, ...(Array.isArray(body?.also) ? body.also : [])];
            for (const id of spends) {
                if (typeof id !== 'string' || id === '')
                    continue;
                markRead(ledger, id, now);
                if (acknowledge)
                    acknowledgeInterrupt(ledger, id);
            }
            schedulePersist();
            return { status: 200, value: { ok: true, value: snapshot() } };
        }
        return { status: 404, value: { ok: false, error: { code: 'unknown-endpoint', message: 'no endpoint ' + endpoint } } };
    }
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PATH,
        handler: async (req, res) => {
            if (rejected(req, res))
                return;
            if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('allow', 'POST');
                res.end();
                return;
            }
            const outcome = await dispatch(endpointOf(req.url), await readBody(req));
            sendJson(res, outcome.status, outcome.value);
        },
    }), 'session-radar: POST ' + ROUTE_PATH + '/<endpoint>');
    /**
     * The ledger is usable — persisted facts adopted, restored Sessions scanned —
     * once this resolves. Every read path waits on it, so a request can never
     * observe the placeholder or a half-adopted file.
     */
    const ready = load().then(async () => {
        // Turns the previous process left open are this restart's interruptions.
        if (adoptAbandonedTurns(ledger, processStartedAt) > 0)
            await persistNow();
        scanRestoredSessions();
    });
    ctx.effect(() => () => {
        if (persistTimer !== null)
            clearTimeout(persistTimer);
        void persistNow();
    });
}
//# sourceMappingURL=host.js.map