/**
 * dsh-unread-helper — host behavior.
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
 * @module dsh-unread-helper/host
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { emptyLedger, listUnread, markRead, normalizeLedger, recordAttention, recordTurnEnd, restartInterruptedTail, } from './ledger.js';
/** Stable cordis plugin name (the bundle row's id is `unread-helper`). */
export const name = 'unread-helper';
/** The authenticated route the browser half posts to. */
const ROUTE_PATH = '/unread-helper';
/** File name under DSH_HOME. */
const STATE_FILE = 'unread-helper.json';
/** Coalesce bursts of events into one write. */
const PERSIST_DEBOUNCE_MS = 250;
/**
 * Mount the host half.
 *
 * @param rawCtx - host cordis context.
 */
export function mount(rawCtx) {
    const ctx = rawCtx;
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
            warn('unread-helper: could not persist ' + statePath + ': ' + String(error));
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
    function load() {
        loading ??= (async () => {
            try {
                ledger = normalizeLedger(JSON.parse(await readFile(statePath, 'utf8')));
            }
            catch (error) {
                const code = error?.code;
                if (code !== 'ENOENT') {
                    warn('unread-helper: ignoring unreadable ' + statePath + ': ' + String(error));
                }
                ledger = emptyLedger();
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
            warn('unread-helper: could not read a stored Session history: ' + String(error));
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
        recordTurnEnd(ledger, { sessionId, at: tail.at, kind: tail.kind, cause: tail.cause });
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
            warn('unread-helper: could not scan restored Sessions: ' + String(error));
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
            warn('unread-helper: could not scan a restored Session: ' + String(error));
        }
    });
    ctx.on('session/event', (...args) => {
        const session = args[0];
        const event = args[1];
        const sessionId = sessionIdOf(session);
        if (sessionId === null || event === null || typeof event !== 'object')
            return;
        const at = typeof event.time === 'number' ? event.time : Date.now();
        whenLoaded(() => {
            if (event.type === 'turn/end') {
                const reason = event.data?.reason ?? {};
                const kind = typeof reason.kind === 'string' ? reason.kind : 'unknown';
                const cause = typeof reason.reason?.kind === 'string' ? reason.reason.kind : null;
                recordTurnEnd(ledger, { sessionId, at, kind, cause });
                schedulePersist();
                return;
            }
            if (event.type === 'approval/asked') {
                recordAttention(ledger, { sessionId, at, kind: 'approval' });
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
                        recordAttention(ledger, { sessionId, at, kind: 'question' });
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
        await load();
        if (endpoint === 'list')
            return { status: 200, value: { ok: true, value: snapshot() } };
        if (endpoint === 'read') {
            if (typeof body?.sessionId !== 'string') {
                return { status: 400, value: { ok: false, error: { code: 'bad-request', message: 'sessionId must be a string' } } };
            }
            markRead(ledger, body.sessionId, Date.now());
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
    }), 'unread-helper: POST ' + ROUTE_PATH + '/<endpoint>');
    void load().then(scanRestoredSessions);
    ctx.effect(() => () => {
        if (persistTimer !== null)
            clearTimeout(persistTimer);
        void persistNow();
    });
}
//# sourceMappingURL=host.js.map