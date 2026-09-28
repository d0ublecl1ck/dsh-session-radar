/**
 * dsh-session-ledger — host behavior.
 *
 * Owns the one thing the browser half cannot own: memory that survives a
 * restart. It records durable turn boundaries and pending interactions, keeps
 * the read markers the browser reports, persists the ledger under DSH_HOME, and
 * answers the browser through its own authenticated webServer route — including
 * the manual continue rollout for turns a restart cut off.
 *
 * The Typert Remote path is closed to a hand-written contribution: the gateway
 * validates descriptors against generated metadata and refuses them. A
 * webServer route plus the connection's trust fence needs no such metadata.
 *
 * @module dsh-session-ledger/host
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { emptyLedger, listInterrupted, listUnread, markContinued, markRead, normalizeLedger, recordAttention, recordTurnEnd, } from './ledger.js';
/** Stable cordis plugin name (the bundle row's id is `session-ledger`). */
export const name = 'session-ledger';
/** The authenticated route the browser half posts to. */
const ROUTE_PATH = '/session-ledger';
/** File name under DSH_HOME. */
const STATE_FILE = 'session-ledger.json';
const DEFAULT_CONTINUE_MESSAGE = '上次执行被 DSH 重启中断，请先核对当前文件与命令的真实状态，再继续。';
/** Coalesce bursts of events into one write. */
const PERSIST_DEBOUNCE_MS = 250;
/** One queued continue must not wait forever for a turn to finish. */
const CONTINUE_TURN_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * Mount the host half.
 *
 * @param rawCtx - host cordis context.
 * @param config - row config; `continueMessage` overrides the rollout text.
 */
export function mount(rawCtx, config) {
    const ctx = rawCtx;
    const continueText = typeof config?.continueMessage === 'string' && config.continueMessage !== ''
        ? config.continueMessage
        : DEFAULT_CONTINUE_MESSAGE;
    const homePath = ctx.get('dshHomePath');
    const statePath = typeof homePath === 'function'
        ? homePath(STATE_FILE)
        : join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), STATE_FILE);
    let ledger = emptyLedger();
    let loaded = false;
    let persistTimer = null;
    let persistChain = Promise.resolve();
    /** Serial rollout: one Session at a time, so agents never race each other. */
    const rollout = { queue: [], done: 0, total: 0, active: null };
    const turnWaiters = new Set();
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
            warn('session-ledger: could not persist ' + statePath + ': ' + String(error));
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
    async function load() {
        if (loaded)
            return;
        loaded = true;
        try {
            ledger = normalizeLedger(JSON.parse(await readFile(statePath, 'utf8')));
        }
        catch (error) {
            const code = error?.code;
            if (code !== 'ENOENT') {
                warn('session-ledger: ignoring unreadable ' + statePath + ': ' + String(error));
            }
            ledger = emptyLedger();
        }
    }
    function sessionIdOf(session) {
        const id = session?.id;
        return typeof id === 'string' && id !== '' ? id : null;
    }
    function settleTurnWaiters(sessionId) {
        for (const waiter of [...turnWaiters]) {
            if (waiter.sessionId !== sessionId)
                continue;
            turnWaiters.delete(waiter);
            clearTimeout(waiter.timer);
            waiter.resolve();
        }
    }
    function awaitTurnEnd(sessionId) {
        return new Promise((resolve) => {
            const waiter = {
                sessionId,
                timer: setTimeout(() => {
                    turnWaiters.delete(waiter);
                    resolve();
                }, CONTINUE_TURN_TIMEOUT_MS),
                resolve,
            };
            waiter.timer.unref?.();
            turnWaiters.add(waiter);
        });
    }
    // ── durable session events ─────────────────────────────────────────────
    ctx.on('session/event', (...args) => {
        const session = args[0];
        const event = args[1];
        const sessionId = sessionIdOf(session);
        if (sessionId === null || event === null || typeof event !== 'object')
            return;
        const at = typeof event.time === 'number' ? event.time : Date.now();
        if (event.type === 'turn/end') {
            const reason = event.data?.reason ?? {};
            const kind = typeof reason.kind === 'string' ? reason.kind : 'unknown';
            const cause = typeof reason.reason?.kind === 'string' ? reason.reason.kind : null;
            recordTurnEnd(ledger, { sessionId, at, kind, cause });
            schedulePersist();
            settleTurnWaiters(sessionId);
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
    // ask_user_question is not a session event; the tool dispatch is.
    ctx.on('tools/execute', async (...args) => {
        const exec = args[0];
        const next = args[1];
        try {
            if (exec?.name === 'ask_user_question') {
                const sessionId = sessionIdOf(exec.agent?.session);
                if (sessionId !== null) {
                    recordAttention(ledger, { sessionId, at: Date.now(), kind: 'question' });
                    schedulePersist();
                }
            }
        }
        catch {
            /* reminder bookkeeping must never break a tool call */
        }
        return next();
    });
    // ── continue rollout ───────────────────────────────────────────────────
    async function sendContinue(sessionId) {
        const controller = ctx.get('sessionController');
        if (controller === undefined || typeof controller.resolveAgent !== 'function') {
            return { ok: false, error: 'sessionController.resolveAgent is unavailable' };
        }
        const resolved = await controller.resolveAgent(sessionId);
        if (resolved === null || typeof resolved !== 'object' || !('agent' in resolved)) {
            return { ok: false, error: 'cannot resolve an agent for ' + sessionId };
        }
        resolved.agent.followup({
            id: randomUUID(),
            role: 'user',
            content: [{ type: 'text', text: continueText }],
            source: { kind: 'plugin', plugin: name },
        });
        markContinued(ledger, sessionId, Date.now());
        schedulePersist();
        return { ok: true };
    }
    async function drainRollout() {
        while (rollout.queue.length > 0) {
            const sessionId = rollout.queue.shift();
            rollout.active = sessionId;
            try {
                const sent = await sendContinue(sessionId);
                // One at a time: do not start the next Session until this turn ends.
                if (sent.ok)
                    await awaitTurnEnd(sessionId);
                else
                    warn('session-ledger: continue refused for ' + sessionId + ': ' + (sent.error ?? 'unknown'));
            }
            catch (error) {
                warn('session-ledger: continue failed for ' + sessionId + ': ' + String(error));
            }
            rollout.done += 1;
        }
        rollout.active = null;
    }
    function snapshot() {
        return {
            now: Date.now(),
            unread: listUnread(ledger),
            interrupted: listInterrupted(ledger),
            rollout: {
                total: rollout.total,
                done: rollout.done,
                active: rollout.active,
                running: rollout.active !== null || rollout.queue.length > 0,
            },
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
    async function continueAll(requested) {
        const ids = Array.isArray(requested) ? requested.filter((id) => typeof id === 'string') : [];
        const targets = ids.length > 0 ? ids : listInterrupted(ledger).map((row) => row.sessionId);
        if (rollout.active !== null || rollout.queue.length > 0) {
            return { ok: false, error: { code: 'rollout-busy', message: 'a continue rollout is already running' } };
        }
        if (targets.length === 0) {
            return { ok: false, error: { code: 'empty-rollout', message: 'no interrupted Session to continue' } };
        }
        rollout.queue = targets;
        rollout.done = 0;
        rollout.total = targets.length;
        void drainRollout();
        return { ok: true, total: rollout.total };
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
        if (endpoint === 'continue-all') {
            return { status: 200, value: await continueAll(body?.sessionIds) };
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
    }), 'session-ledger: POST ' + ROUTE_PATH + '/<endpoint>');
    void load();
    ctx.effect(() => () => {
        if (persistTimer !== null)
            clearTimeout(persistTimer);
        for (const waiter of [...turnWaiters]) {
            clearTimeout(waiter.timer);
            waiter.resolve();
        }
        turnWaiters.clear();
        void persistNow();
    });
}
//# sourceMappingURL=host.js.map