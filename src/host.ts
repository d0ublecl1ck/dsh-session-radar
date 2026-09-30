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
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  emptyLedger,
  listInterrupted,
  listUnread,
  markContinued,
  markRead,
  normalizeLedger,
  recordAttention,
  recordTurnEnd,
  restartInterruptedTail,
  type InterruptedRow,
  type LedgerState,
  type TailEventLike,
  type UnreadRow,
} from './ledger.js'

/** Stable cordis plugin name (the bundle row's id is `session-ledger`). */
export const name = 'session-ledger'

/** The authenticated route the browser half posts to. */
const ROUTE_PATH = '/session-ledger'

/** File name under DSH_HOME. */
const STATE_FILE = 'session-ledger.json'

const DEFAULT_CONTINUE_MESSAGE =
  '上次执行被 DSH 重启中断，请先核对当前文件与命令的真实状态，再继续。'

/** Coalesce bursts of events into one write. */
const PERSIST_DEBOUNCE_MS = 250

/** One queued continue must not wait forever for a turn to finish. */
const CONTINUE_TURN_TIMEOUT_MS = 10 * 60 * 1000

/** The slice of the plugin context this half uses, declared structurally. */
interface LedgerContext {
  on(event: string, listener: (...args: any[]) => unknown): unknown
  effect(callback: () => (() => void) | void, label?: string): unknown
  get(name: string): any
  logger?: { warn(message: string): void }
  webServer: { register(route: unknown): () => void }
}

/** A snapshot of everything the browser half renders. */
interface Snapshot {
  readonly now: number
  readonly unread: readonly UnreadRow[]
  readonly interrupted: readonly InterruptedRow[]
  readonly rollout: {
    readonly total: number
    readonly done: number
    readonly active: string | null
    readonly running: boolean
  }
}

/** One queued rollout waiting for a turn to finish. */
interface TurnWaiter {
  sessionId: string
  timer: ReturnType<typeof setTimeout>
  resolve: () => void
}

/**
 * Mount the host half.
 *
 * @param rawCtx - host cordis context.
 * @param config - row config; `continueMessage` overrides the rollout text.
 */
export function mount(rawCtx: any, config?: { continueMessage?: unknown }): void {
  const ctx = rawCtx as LedgerContext
  const continueText =
    typeof config?.continueMessage === 'string' && config.continueMessage !== ''
      ? config.continueMessage
      : DEFAULT_CONTINUE_MESSAGE

  const homePath = ctx.get('dshHomePath')
  const statePath =
    typeof homePath === 'function'
      ? homePath(STATE_FILE)
      : join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), STATE_FILE)

  let ledger: LedgerState = emptyLedger()
  let hydrated = false
  let loading: Promise<void> | null = null
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let persistChain: Promise<void> = Promise.resolve()

  /** Serial rollout: one Session at a time, so agents never race each other. */
  const rollout = { queue: [] as string[], done: 0, total: 0, active: null as string | null }
  const turnWaiters = new Set<TurnWaiter>()

  const warn = (message: string): void => {
    ctx.logger?.warn(message)
  }

  function persistNow(): Promise<void> {
    const payload = JSON.stringify(ledger, null, 2)
    persistChain = persistChain
      .then(async () => {
        await mkdir(dirname(statePath), { recursive: true })
        const temporary = statePath + '.tmp-' + process.pid + '-' + Date.now()
        await writeFile(temporary, payload, 'utf8')
        await rename(temporary, statePath)
      })
      .catch((error: unknown) => {
        warn('session-ledger: could not persist ' + statePath + ': ' + String(error))
      })
    return persistChain
  }

  function schedulePersist(): void {
    if (persistTimer !== null) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      void persistNow()
    }, PERSIST_DEBOUNCE_MS)
    persistTimer.unref?.()
  }

  function load(): Promise<void> {
    loading ??= (async () => {
      try {
        ledger = normalizeLedger(JSON.parse(await readFile(statePath, 'utf8')))
      } catch (error: unknown) {
        const code = (error as { code?: string } | null)?.code
        if (code !== 'ENOENT') {
          warn('session-ledger: ignoring unreadable ' + statePath + ': ' + String(error))
        }
        ledger = emptyLedger()
      }
      hydrated = true
    })()
    return loading
  }

  /**
   * Run one ledger mutation once the persisted state is in memory.
   *
   * Durable events and restored Sessions can both arrive while the file is
   * still being read; applying them to the placeholder would let the load
   * overwrite the newer facts.
   */
  function whenLoaded(apply: () => void): void {
    if (hydrated) {
      apply()
      return
    }
    void load().then(apply)
  }

  function sessionIdOf(session: unknown): string | null {
    const id = (session as { id?: unknown } | null)?.id
    return typeof id === 'string' && id !== '' ? id : null
  }

  function settleTurnWaiters(sessionId: string): void {
    for (const waiter of [...turnWaiters]) {
      if (waiter.sessionId !== sessionId) continue
      turnWaiters.delete(waiter)
      clearTimeout(waiter.timer)
      waiter.resolve()
    }
  }

  function awaitTurnEnd(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      const waiter: TurnWaiter = {
        sessionId,
        timer: setTimeout(() => {
          turnWaiters.delete(waiter)
          resolve()
        }, CONTINUE_TURN_TIMEOUT_MS),
        resolve,
      }
      waiter.timer.unref?.()
      turnWaiters.add(waiter)
    })
  }

  /** One live Session's stored history, or null when it exposes none. */
  function storedEventsOf(session: unknown): readonly TailEventLike[] | null {
    const candidate = session as { snapshotEvents?: unknown; events?: unknown } | null
    try {
      if (typeof candidate?.snapshotEvents === 'function') {
        const events = (candidate.snapshotEvents as () => unknown)()
        return Array.isArray(events) ? (events as readonly TailEventLike[]) : null
      }
      if (Array.isArray(candidate?.events)) return candidate.events as readonly TailEventLike[]
    } catch (error: unknown) {
      warn('session-ledger: could not read a stored Session history: ' + String(error))
    }
    return null
  }

  /**
   * Recover a restart orphan from one Session's stored history.
   *
   * DSH's crash repair closes an interrupted tail with a synthetic `turn/end`
   * that arrives as a constructor seed, and seeds never publish on
   * `session/event` — so a resumed Session's orphan is invisible to the live
   * listener and has to be read off the snapshot instead.
   */
  function recordRestoredTail(session: unknown): void {
    const sessionId = sessionIdOf(session)
    if (sessionId === null) return
    const events = storedEventsOf(session)
    if (events === null) return
    const tail = restartInterruptedTail(events)
    if (tail === null) return
    recordTurnEnd(ledger, { sessionId, at: tail.at, kind: tail.kind, cause: tail.cause })
    schedulePersist()
  }

  /** Sessions restored before this plugin mounted never announce themselves. */
  function scanRestoredSessions(): void {
    try {
      const agents = ctx.get('agents')
      if (agents === undefined || typeof agents.list !== 'function') return
      for (const agent of (agents.list() ?? []) as { session?: unknown }[]) {
        recordRestoredTail(agent?.session)
      }
    } catch (error: unknown) {
      warn('session-ledger: could not scan restored Sessions: ' + String(error))
    }
  }

  // ── durable session events ─────────────────────────────────────────────
  // A resumed Session announces itself with its repaired tail already seeded.
  ctx.on('session/created', (...args: any[]) => {
    const session = args[0] as unknown
    try {
      whenLoaded(() => recordRestoredTail(session))
    } catch (error: unknown) {
      warn('session-ledger: could not scan a restored Session: ' + String(error))
    }
  })

  ctx.on('session/event', (...args: any[]) => {
    const session = args[0] as unknown
    const event = args[1] as { type?: unknown; time?: unknown; data?: any } | null
    const sessionId = sessionIdOf(session)
    if (sessionId === null || event === null || typeof event !== 'object') return
    const at = typeof event.time === 'number' ? event.time : Date.now()

    whenLoaded(() => {
      if (event.type === 'turn/end') {
        const reason = event.data?.reason ?? {}
        const kind = typeof reason.kind === 'string' ? reason.kind : 'unknown'
        const cause = typeof reason.reason?.kind === 'string' ? reason.reason.kind : null
        recordTurnEnd(ledger, { sessionId, at, kind, cause })
        schedulePersist()
        settleTurnWaiters(sessionId)
        return
      }

      if (event.type === 'approval/asked') {
        recordAttention(ledger, { sessionId, at, kind: 'approval' })
        schedulePersist()
        return
      }

      // Sending a message is the operator engaging with the Session: read.
      if (event.type === 'user/message') {
        markRead(ledger, sessionId, at)
        schedulePersist()
      }
    })
  })

  // ask_user_question is not a session event; the tool dispatch is.
  ctx.on('tools/execute', async (...args: any[]) => {
    const exec = args[0] as any
    const next = args[1] as () => unknown
    try {
      if (exec?.name === 'ask_user_question') {
        const sessionId = sessionIdOf(exec.agent?.session)
        if (sessionId !== null) {
          const at = Date.now()
          whenLoaded(() => {
            recordAttention(ledger, { sessionId, at, kind: 'question' })
            schedulePersist()
          })
        }
      }
    } catch {
      /* reminder bookkeeping must never break a tool call */
    }
    return next()
  })

  // ── continue rollout ───────────────────────────────────────────────────
  async function sendContinue(sessionId: string): Promise<{ ok: boolean; error?: string }> {
    const controller = ctx.get('sessionController')
    if (controller === undefined || typeof controller.resolveAgent !== 'function') {
      return { ok: false, error: 'sessionController.resolveAgent is unavailable' }
    }
    const resolved = await controller.resolveAgent(sessionId)
    if (resolved === null || typeof resolved !== 'object' || !('agent' in resolved)) {
      return { ok: false, error: 'cannot resolve an agent for ' + sessionId }
    }
    resolved.agent.followup({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: continueText }],
      source: { kind: 'plugin', plugin: name },
    })
    markContinued(ledger, sessionId, Date.now())
    schedulePersist()
    return { ok: true }
  }

  async function drainRollout(): Promise<void> {
    while (rollout.queue.length > 0) {
      const sessionId = rollout.queue.shift() as string
      rollout.active = sessionId
      try {
        const sent = await sendContinue(sessionId)
        // One at a time: do not start the next Session until this turn ends.
        if (sent.ok) await awaitTurnEnd(sessionId)
        else warn('session-ledger: continue refused for ' + sessionId + ': ' + (sent.error ?? 'unknown'))
      } catch (error: unknown) {
        warn('session-ledger: continue failed for ' + sessionId + ': ' + String(error))
      }
      rollout.done += 1
    }
    rollout.active = null
  }

  function snapshot(): Snapshot {
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
    }
  }

  // ── browser route ─────────────────────────────────────────────────────
  const rejected = (req: any, res: any): boolean => {
    const connection = ctx.get('connection')
    const rejection = connection?.requestRejection?.(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  const sendJson = (res: any, status: number, value: unknown): void => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(value))
  }

  function endpointOf(url: unknown): string {
    const pathname = new URL(String(url), 'http://localhost').pathname
    return pathname.startsWith(ROUTE_PATH + '/') ? pathname.slice(ROUTE_PATH.length + 1) : ''
  }

  function readBody(req: any): Promise<any> {
    return new Promise((resolve) => {
      let raw = ''
      req.on('data', (chunk: unknown) => { raw += String(chunk) })
      req.on('end', () => {
        try {
          resolve(raw === '' ? {} : JSON.parse(raw))
        } catch {
          resolve({})
        }
      })
    })
  }

  async function continueAll(requested: unknown): Promise<unknown> {
    const ids = Array.isArray(requested) ? requested.filter((id): id is string => typeof id === 'string') : []
    const targets = ids.length > 0 ? ids : listInterrupted(ledger).map((row) => row.sessionId)
    if (rollout.active !== null || rollout.queue.length > 0) {
      return { ok: false, error: { code: 'rollout-busy', message: 'a continue rollout is already running' } }
    }
    if (targets.length === 0) {
      return { ok: false, error: { code: 'empty-rollout', message: 'no interrupted Session to continue' } }
    }
    rollout.queue = targets
    rollout.done = 0
    rollout.total = targets.length
    void drainRollout()
    return { ok: true, total: rollout.total }
  }

  async function dispatch(endpoint: string, body: any): Promise<{ status: number; value: unknown }> {
    await load()
    if (endpoint === 'list') return { status: 200, value: { ok: true, value: snapshot() } }
    if (endpoint === 'read') {
      if (typeof body?.sessionId !== 'string') {
        return { status: 400, value: { ok: false, error: { code: 'bad-request', message: 'sessionId must be a string' } } }
      }
      markRead(ledger, body.sessionId, Date.now())
      schedulePersist()
      return { status: 200, value: { ok: true, value: snapshot() } }
    }
    if (endpoint === 'continue-all') {
      return { status: 200, value: await continueAll(body?.sessionIds) }
    }
    return { status: 404, value: { ok: false, error: { code: 'unknown-endpoint', message: 'no endpoint ' + endpoint } } }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_PATH,
    handler: async (req: any, res: any) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      const outcome = await dispatch(endpointOf(req.url), await readBody(req))
      sendJson(res, outcome.status, outcome.value)
    },
  }), 'session-ledger: POST ' + ROUTE_PATH + '/<endpoint>')

  void load().then(scanRestoredSessions)

  ctx.effect(() => () => {
    if (persistTimer !== null) clearTimeout(persistTimer)
    for (const waiter of [...turnWaiters]) {
      clearTimeout(waiter.timer)
      waiter.resolve()
    }
    turnWaiters.clear()
    void persistNow()
  })
}
