/**
 * The bell control and the activity list it toggles.
 *
 * Placement is a DOM portal: the sidebar's browsing region is one single-occupant
 * slot (`sidebar.workspaces`) whose header has no hole beside the search
 * control, so the bell is portalled into that header and the panel into the
 * list seat below it. The slot registration that carries this component exists
 * for its lifecycle, its locale seat, and the shell's `wide` flag — the entry
 * itself renders nothing into the sidebar foot.
 *
 * Both surfaces read the same two snapshots the browsing region reads:
 * `sessions` (list rows, titles, workspaces) and `uiSession.sessionStatus`
 * (running / pending / finished-unviewed), plus the Workspace registry for
 * folder labels and archive membership. Nothing is cached: the badge, the
 * green dots, and the ordering all recompute from those snapshots, so opening
 * a Session clears its dot exactly the way the shipped rows do.
 *
 * @module dsh-session-radar/client/ActivityBell
 */
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  IconArchiveOutlineRegular, IconFolderOpenOutlineRegular, IconPinFillRegular, IconPinOutlineRegular,
  StateDot, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  buildActivityGroups, countPending, countUnread, type ActivityAttention, type ActivityDayBucket,
  type ActivityRow,
} from '../activity-model.js'
import { buildOverview, type Overview, type OverviewCard } from '../overview.js'
import {
  applyRowInset, ensurePositioned, measureRowInset, mountContainer, type SidebarAnchors,
} from './anchors.js'
import { nextAskJump } from './ask-jump.js'
import { nextPending, sessionFacts, type SessionFacts } from './completions.js'
import type { LedgerSource } from './ledger-source.js'
import {
  currentSessionId, expandOwningGroup, findSessionRow, nextUnreadId, owningWorkspaceKey, revealRow,
} from './jump.js'
import type { JumpSeat } from './jump-command.js'
import { readManualUnread, watchManualUnread } from './manual-unread.js'
import { BellIcon } from './icons.js'
import { useTitleMarquee } from './marquee.js'
import {
  moveCursor, seedCursor, selectedCard, zoneCards,
  type OverviewCursor, type OverviewStep,
} from './overview-cursor.js'
import { useSidebarAnchors } from './use-anchors.js'
import { useFollowingTailSession } from './use-conversation-tail.js'
import { tailLedgerRead } from './conversation-tail.js'
import { useUserOpenedSession } from './use-user-open.js'

/** Structural view of the observable snapshots this plugin subscribes to. */
export interface SnapshotSource<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Business face the registration injects (actions + the three data sources). */
export interface ActivityBellInjected {
  /** Open a Session in the conversation column. */
  readonly openSession: (sessionId: SessionId) => void
  /** Pin/unpin a Session in the registry-global pin set. */
  readonly pinSession: (sessionId: SessionId) => Promise<void>
  readonly unpinSession: (sessionId: SessionId) => Promise<void>
  /**
   * Archive a Session. The host refuses while work is still running, and the
   * rejection carries its own message for the inline notice.
   */
  readonly archiveSession: (sessionId: SessionId) => Promise<void>
  readonly sessions: SnapshotSource<SessionListState>
  readonly statuses: SnapshotSource<SessionStatusSnapshot>
  readonly workspaces: SnapshotSource<WorkspaceSnapshot>
  /** Cross-restart reminder memory owned by the host half. */
  readonly ledger: LedgerSource
  /** Seat the plugin-scope unread command reads to run this bell's walk. */
  readonly unreadJump: JumpSeat
  /** Seat the plugin-scope pending-ask command reads to run this bell's walk. */
  readonly askJump: JumpSeat
  /** Seat the plugin-scope waiting-window command reads to toggle the window. */
  readonly overviewJump: JumpSeat
}

/** Composed props: shell share + locale seat + injected business face. */
export type ActivityBellProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'session-radar'>
  & ActivityBellInjected

type Translate = PropsLocale<'session-radar'>['t']

/** Calendar bucket → section label. */
function dayLabel(bucket: ActivityDayBucket, t: Translate, now: number): string {
  switch (bucket.kind) {
    case 'today':
      return t('day.today')
    case 'yesterday':
      return t('day.yesterday')
    case 'weekday': {
      const weekdays: readonly Parameters<Translate>[0][] = [
        'day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat',
      ]
      return t(weekdays[bucket.weekday] ?? 'day.sun')
    }
    case 'date': {
      const currentYear = new Date(now).getFullYear()
      return bucket.year === currentYear
        ? t('day.date', { month: bucket.month, day: bucket.day })
        : t('day.dateYear', { year: bucket.year, month: bucket.month, day: bucket.day })
    }
  }
}

/** Row status text for assistive tech (the dots are decorative). */
function statusText(row: ActivityRow<SessionId>, t: Translate): string | undefined {
  if (row.manual) return t('row.markedUnread')
  if (row.unread) return t('row.unread')
  if (row.pending !== undefined) return t('row.attention')
  if (row.running) return t('row.running')
  return undefined
}

/** Row marker: finished-unviewed reuses the shipped green "done" dot. */
function RowMark({ row }: { readonly row: ActivityRow<SessionId> }): ReactElement | null {
  if (row.unread) return <StateDot state="done" size={8} />
  if (row.pending !== undefined) return <StateDot state="warning" size={8} />
  if (row.running) return <StateDot state="ongoing" size={10} />
  return null
}

/** One activity row: title reveal, status mark, folder, and the row actions. */
function ActivityRowItem({
  row, t, onOpen, onTogglePin, onArchive,
}: {
  readonly row: ActivityRow<SessionId>
  readonly t: Translate
  readonly onOpen: (sessionId: SessionId) => void
  readonly onTogglePin: (row: ActivityRow<SessionId>) => void
  readonly onArchive: (row: ActivityRow<SessionId>) => void
}) {
  const title = useRef<HTMLSpanElement>(null)
  const marquee = useTitleMarquee(title)
  const status = statusText(row, t)
  const label = row.title === '' ? t('row.untitled') : row.title
  // The row itself is the open affordance, so it cannot be a <button>: the
  // pin/archive controls below are buttons, and nesting them would be invalid
  // markup that browsers resolve unpredictably. A focusable role="button" row
  // keeps the whole-row target, the keyboard path, and the inner controls.
  return (
    <div
      className={row.current ? 'ab-row ab-row-current' : 'ab-row'}
      role="button"
      tabIndex={0}
      title={label}
      onPointerEnter={marquee.enter}
      onPointerLeave={marquee.leave}
      onClick={() => { onOpen(row.id) }}
      onKeyDown={(event) => {
        // Keys pressed on an inner control belong to that control.
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen(row.id)
      }}
    >
      <span className="ab-row-mark" aria-hidden="true"><RowMark row={row} /></span>
      <span className="ab-row-body">
        <span className="ab-row-title" ref={title}>{label}</span>
        {row.folder !== '' && (
          <span className="ab-row-folder">
            <IconFolderOpenOutlineRegular size={12} />
            <span className="ab-row-folder-text">{row.folder}</span>
          </span>
        )}
        {status !== undefined && <span className="ab-sr-only">{status}</span>}
      </span>
      <span className="ab-row-tail">
        {row.pinned && (
          <span className="ab-pin-mark" role="img" aria-label={t('row.pinned')} title={t('row.pinned')}>
            <IconPinFillRegular size={12} />
          </span>
        )}
        {/* The row itself is the open action, so the strip keeps its clicks. */}
        <span className="ab-row-actions">
          <Tooltip label={t(row.pinned ? 'action.unpin' : 'action.pin')} side="bottom" align="end" delayMs={500}>
            <button
              type="button"
              className="ab-icon-button"
              aria-label={t(row.pinned ? 'action.unpin' : 'action.pin')}
              onClick={(event) => {
                event.stopPropagation()
                onTogglePin(row)
              }}
            >
              {row.pinned ? <IconPinFillRegular size={14} /> : <IconPinOutlineRegular size={14} />}
            </button>
          </Tooltip>
          <Tooltip label={t('action.archive')} side="bottom" align="end" delayMs={500}>
            <button
              type="button"
              className="ab-icon-button"
              aria-label={t('action.archive')}
              onClick={(event) => {
                event.stopPropagation()
                onArchive(row)
              }}
            >
              <IconArchiveOutlineRegular size={14} />
            </button>
          </Tooltip>
        </span>
      </span>
    </div>
  )
}

/** Short age of a card, as the waiting window prints it. */
function relativeWhen(updatedAt: number, now: number, t: Translate): string {
  const minutes = Math.floor(Math.max(0, now - updatedAt) / 60_000)
  if (minutes < 1) return t('when.now')
  if (minutes < 60) return t('when.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('when.hours', { count: hours })
  return t('when.days', { count: Math.floor(hours / 24) })
}

/** The copy for one pending-interaction kind. */
function attentionLabel(kind: ActivityAttention, t: Translate): string {
  switch (kind) {
    case 'approval':
      return t('attention.approval')
    case 'plan-review':
      return t('attention.planReview')
    case 'question':
      return t('attention.question')
  }
}

/** One card of the waiting window. */
function WaitingCard({
  card, selected, now, t, onOpen,
}: {
  readonly card: OverviewCard<SessionId>
  readonly selected: boolean
  readonly now: number
  readonly t: Translate
  readonly onOpen: (sessionId: SessionId) => void
}) {
  const label = card.title === '' ? t('row.untitled') : card.title
  const classes = ['ov-card']
  if (selected) classes.push('ov-card-sel')
  if (card.current) classes.push('ov-card-current')
  return (
    // A card is its own button: the whole surface is the open affordance, and
    // the window renders no inner controls that would nest inside it.
    <button
      type="button"
      className={classes.join(' ')}
      title={label}
      onClick={() => { onOpen(card.id) }}
    >
      <span className="ov-card-title">{label}</span>
      {card.pending !== undefined
        ? <span className="ov-tag">{attentionLabel(card.pending, t)}</span>
        : card.unread
          ? <span className="ov-tag ov-tag-unread">{t('row.unread')}</span>
          : null}
      <span className="ov-card-meta">
        {card.folder !== '' && <span className="ov-card-folder">{card.folder}</span>}
        <span className="ov-card-when">{relativeWhen(card.updatedAt, now, t)}</span>
      </span>
    </button>
  )
}

/** One zone of the waiting window: a heading, then its cards. */
function WaitingZone({
  zone, cards, cursor, now, t, onOpen,
}: {
  readonly zone: 'ask' | 'unread'
  readonly cards: readonly OverviewCard<SessionId>[]
  readonly cursor: OverviewCursor | null
  readonly now: number
  readonly t: Translate
  readonly onOpen: (sessionId: SessionId) => void
}) {
  return (
    <section className={'ov-zone ov-zone-' + zone}>
      <div className="ov-zone-title">
        {t(zone === 'ask' ? 'overview.zone.ask' : 'overview.zone.unread')}{' '}
        <span className="ov-zone-count">{cards.length}</span>
      </div>
      {cards.length === 0
        ? <div className="ov-zone-empty">{t('overview.zoneEmpty')}</div>
        : (
          <div className="ov-grid">
            {cards.map(card => (
              <WaitingCard
                key={card.id}
                card={card}
                selected={cursor?.zone === zone && cards[cursor.index]?.id === card.id}
                now={now}
                t={t}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
    </section>
  )
}

/**
 * The waiting window: every unread completion and every pending ask, split into
 * the ask zone (answering is the higher-priority action, so it leads) and the
 * unread zone beside it.
 */
function WaitingWindow({
  waiting, cursor, now, t, onOpen, onClose,
}: {
  readonly waiting: Overview<SessionId>
  readonly cursor: OverviewCursor | null
  readonly now: number
  readonly t: Translate
  readonly onOpen: (sessionId: SessionId) => void
  readonly onClose: () => void
}) {
  return (
    <div
      className="ov-veil"
      // A press on the veil dismisses the window; a press inside it belongs to
      // the card under the pointer.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="ov-panel" role="dialog" aria-modal="true" aria-label={t('overview.aria')}>
        <div className="ov-head">
          <span className="ov-title">{t('overview.title')}</span>
          <span className="ov-counts">
            {t('overview.counts', {
              unread: waiting.unread.length,
              ask: waiting.ask.length,
            })}
          </span>
          <span className="ov-grow" />
          <span className="ov-hint">{t('overview.hint')}</span>
          <button type="button" className="ov-close" onClick={onClose}>{t('overview.close')}</button>
          <span className="ov-kbd">Esc</span>
        </div>
        <div className="ov-body">
          {waiting.ask.length === 0 && waiting.unread.length === 0
            ? <div className="ov-empty">{t('overview.empty')}</div>
            : (
              <>
                <WaitingZone
                  zone="ask"
                  cards={waiting.ask}
                  cursor={cursor}
                  now={now}
                  t={t}
                  onOpen={onOpen}
                />
                <WaitingZone
                  zone="unread"
                  cards={waiting.unread}
                  cursor={cursor}
                  now={now}
                  t={t}
                  onOpen={onOpen}
                />
              </>
            )}
        </div>
      </div>
    </div>
  )
}

/** Subscribe to one observable snapshot. */
function useSnapshot<T>(source: SnapshotSource<T>): T {
  const subscribe = useCallback((listener: () => void) => source.subscribe(listener), [source])
  const read = useCallback(() => source.getSnapshot(), [source])
  return useSyncExternalStore(subscribe, read, read)
}

/**
 * Track the Workspace browser's manual unread marks. That store is not a
 * framework snapshot the shell publishes, so this reads its persisted key and
 * follows same-document writes through the bridge's watcher.
 */
function useManualUnread(): ReadonlySet<SessionId> {
  const [marked, setMarked] = useState<ReadonlySet<SessionId>>(() => readManualUnread())
  useEffect(() => watchManualUnread(setMarked), [])
  return marked
}

/** Re-render once a minute so day buckets and the "today" section stay honest. */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, 60_000)
    return () => { window.clearInterval(timer) }
  }, [])
  return now
}

/**
 * Structural node check. Event targets are nodes in every browser, but the
 * page's `Node` constructor is not a global the module can assume (jsdom keeps
 * it on its window), so the test asks the value instead of the environment.
 */
function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null
    && typeof (value as { nodeType?: unknown }).nodeType === 'number'
}

interface Hosts {
  readonly bell: HTMLElement | null
  readonly panel: HTMLElement | null
}

/**
 * Attach the injected containers to the resolved anchors while the sidebar is
 * wide. Containers are created and destroyed with the anchors, so a shell
 * remount never leaves an orphan node behind.
 *
 * The two seats have different lifetimes on purpose. The bell seat lives as
 * long as the header, which keeps the portalled button mounted (and focused)
 * across an open/close toggle. The panel seat exists only while the activity
 * list is open: the list below stays the plain shell DOM, with nothing of ours
 * on top of it, so a closed view can never intercept a click meant for a
 * Workspace row or a group disclosure.
 */
function useHosts(anchors: SidebarAnchors | undefined, wide: boolean, active: boolean): Hosts {
  const [hosts, setHosts] = useState<Hosts>({ bell: null, panel: null })
  useLayoutEffect(() => {
    if (anchors === undefined || !wide) {
      setHosts(current => (current.bell === null ? current : { bell: null, panel: current.panel }))
      return
    }
    const bell = mountContainer(anchors.header, anchors.actions, 'ab-bell-host')
    setHosts(current => ({ bell, panel: current.panel }))
    return () => {
      bell.remove()
    }
  }, [anchors, wide])
  useLayoutEffect(() => {
    if (anchors === undefined || !wide || !active || anchors.listArea === null) {
      setHosts(current => (current.panel === null ? current : { bell: current.bell, panel: null }))
      return
    }
    const listArea = anchors.listArea
    const restorePosition = ensurePositioned(listArea)
    const panel = mountContainer(listArea, null, 'ab-panel-host')
    applyRowInset(panel, measureRowInset(listArea))
    setHosts(current => ({ bell: current.bell, panel }))
    return () => {
      panel.remove()
      restorePosition()
    }
  }, [anchors, wide, active])
  return hosts
}

/**
 * Render the bell into the sidebar header and, while active, the activity list
 * into the list seat it covers.
 * @param props - shell share, locale seat, and injected business face.
 * @returns the two portals, or null before the sidebar region exists.
 */
export function ActivityBell({
  wide, t, openSession, pinSession, unpinSession, archiveSession, sessions, statuses, workspaces, ledger,
  unreadJump, askJump, overviewJump,
}: ActivityBellProps): ReactElement | null {
  const anchors = useSidebarAnchors()
  const list = useSnapshot(sessions)
  const statusMap = useSnapshot(statuses)
  const workspaceSnapshot = useSnapshot(workspaces)
  const manualUnread = useManualUnread()
  const tail = useFollowingTailSession()
  const opened = useUserOpenedSession()
  const now = useMinuteTick()
  const [active, setActive] = useState(false)
  // The waiting window is its own surface: a full-page overlay rather than a
  // cover over the sidebar list, so it neither needs `wide` nor shares the
  // activity list's host.
  const [waitingOpen, setWaitingOpen] = useState(false)
  const [waitingCursor, setWaitingCursor] = useState<OverviewCursor | null>(null)
  const [pending, setPending] = useState<ReadonlySet<SessionId>>(() => new Set())
  const facts = useRef<ReadonlyMap<SessionId, SessionFacts> | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef(0)
  const hosts = useHosts(anchors, wide, active)

  // Every observed running → stopped transition is a completion worth a badge;
  // the framework's own reminder only covers the ones watched from elsewhere.
  useEffect(() => {
    const current = sessionFacts(list, statusMap)
    // Both passes are captured by value: a state updater may run later, by which
    // time the ref would already hold the next pass and the transition would be
    // invisible to this comparison.
    const previous = facts.current
    facts.current = current
    setPending(currentPending => nextPending(currentPending, previous, current))
    // A turn that ends while its conversation sits at the tail is read at once,
    // so leaving before the host poll cannot re-arm the ledger reminder.
    if (tail !== null && previous?.get(tail)?.running === true && current.get(tail)?.running === false) {
      ledger.read(tail)
    }
  }, [list, statusMap, tail, ledger])

  // The host ledger is the cross-restart memory: a completion recorded there
  // keeps its badge after a reload, which the in-memory edge tracker cannot.
  const ledgerSnapshot = useSyncExternalStore(
    useCallback((listener: () => void) => ledger.subscribe(listener), [ledger]),
    useCallback(() => ledger.getSnapshot(), [ledger]),
  )
  // Its own source rather than folded into `pending`: the host can read a
  // Session back (the tail does), and the badge has to follow that down again.
  const ledgerUnread = useMemo(() => {
    const ids = new Set<SessionId>()
    for (const row of ledgerSnapshot.unread) ids.add(row.sessionId as SessionId)
    return ids
  }, [ledgerSnapshot])
  // The ledger's own row for the Session on screen, which knows whether its
  // reminder is a turn that never finished.
  const reminder = useMemo(
    () => ledgerSnapshot.unread.find((row) => row.sessionId === tail) ?? null,
    [ledgerSnapshot, tail],
  )

  // Which conversation the shell put on screen by itself. The first Session this
  // page shows before the operator has opened anything is the one DSH restored
  // after the last start; the tail it renders is not a read of it.
  const restored = useRef<SessionId | null>(null)
  const shown = useMemo(() => currentSessionId(list), [list])
  useEffect(() => {
    if (restored.current !== null || shown === null) return
    if (opened.current === shown) return
    restored.current = shown
  }, [shown, opened.current])

  // The conversation at its tail is read: drop the surface's own reminder for it
  // and tell the host, so scrolling away can re-arm neither source. The host
  // also drops a restart-interrupt marker on this acknowledgement — a plain open
  // does not, so the interruption survives a quick glance but not a real read.
  useEffect(() => {
    if (tail === null || !pending.has(tail)) return
    setPending((current) => {
      const next = new Set(current)
      next.delete(tail)
      return next
    })
  }, [tail, pending])
  // The Session DSH reopened by itself is left out of the interrupt
  // acknowledgement: after a restart it is usually the very Session the restart
  // cut off, and spending its reminder before the operator chose to open it is
  // how the marker went missing. The tail is still a read of the Session's
  // finished turns.
  useEffect(() => {
    const next = tailLedgerRead({
      tail,
      reminder,
      restored: restored.current,
      openedByUser: opened.current,
    })
    if (!next.send) return
    ledger.read(tail as SessionId, next.acknowledgeInterrupt ? { acknowledgeInterrupt: true } : undefined)
  }, [tail, reminder, ledger, opened.current, restored])

  const acknowledge = useCallback((sessionId: SessionId): void => {
    setPending((current) => {
      if (!current.has(sessionId)) return current
      const next = new Set(current)
      next.delete(sessionId)
      return next
    })
    // Tell the host too, so the ledger stops re-arming this Session.
    ledger.read(sessionId)
  }, [ledger])

  // The three snapshots plus this surface's own edge memory, in the shape both
  // projections read: the activity list and the waiting window must agree on
  // visibility, unread, and pending, so they fold the same inputs.
  const inputs = useMemo(() => ({
    sessions: list,
    statuses: statusMap,
    workspaces: workspaceSnapshot,
    completedSince: pending,
    ledgerUnread,
    viewingTail: tail,
    manualUnread,
  }), [list, statusMap, workspaceSnapshot, pending, ledgerUnread, tail, manualUnread])

  const view = useMemo(() => ({
    groups: buildActivityGroups<SessionId>(inputs, now),
    unread: countUnread<SessionId>(inputs),
    pendingCount: countPending<SessionId>(inputs),
  }), [inputs, now])
  const { groups, unread, pendingCount } = view
  // The waiting window lists what the bell counts, split into its two zones.
  const waiting = useMemo(() => buildOverview<SessionId>(inputs, now), [inputs, now])

  // The jump order the badge counts. It is the order the activity list already
  // sorts - newest first - so the bell walks the Sessions the way the operator
  // reads them.
  const unreadOrder = useMemo<readonly SessionId[]>(
    () => groups.flatMap((group) => group.rows.filter((row) => row.unread).map((row) => row.id)),
    [groups],
  )
  // The pending asks, in the order they started waiting. The activity list is
  // newest first, so reversing it makes the oldest ask lead: the queue the O
  // shortcut walks (see ./ask-jump).
  const askOrder = useMemo<readonly SessionId[]>(
    () => groups
      .flatMap((group) => group.rows.filter((row) => row.pending !== undefined).map((row) => row.id))
      .reverse(),
    [groups],
  )
  const cursor = useRef<SessionId | null>(null)
  // The stops the ask walk left behind, oldest first; the last one is where a
  // press returns once no ask is left.
  const askTrail = useRef<readonly SessionId[]>([])

  // Bring one Session's sidebar row into view, expanding its Workspace group
  // first when the group is collapsed and renders no member rows.
  const revealSession = useCallback((target: SessionId): void => {
    const listArea = anchors?.listArea ?? null
    const row = findSessionRow(listArea, target)
    if (row !== undefined) revealRow(row)
    else {
      // A collapsed Workspace group renders no member rows, so there is nothing
      // to scroll to: open its disclosure and reveal the row after the repaint.
      const key = owningWorkspaceKey(workspaceSnapshot.items, target)
      if (key !== undefined && expandOwningGroup(listArea, key)) {
        window.requestAnimationFrame(() => {
          const revealed = findSessionRow(listArea, target)
          if (revealed !== undefined) revealRow(revealed)
        })
      }
    }
  }, [anchors, workspaceSnapshot])

  // Opening a Session the operator asked for. The bell's own jumps and list all
  // come through here, so the one acknowledgement the shell's automatic restore
  // must not earn is the only one that never does.
  const openByUser = useCallback((target: SessionId): void => {
    opened.mark(target)
    openSession(target)
  }, [openSession, opened.mark])

  // One press advances to the next unread Session: its sidebar row is scrolled
  // into view and the conversation column opens it. The cursor is what keeps
  // the walk sequential - the unread set shrinks as each opened Session clears.
  const jumpNextUnread = useCallback((): void => {
    const target = nextUnreadId(unreadOrder, cursor.current)
    if (target === null) return
    cursor.current = target
    revealSession(target)
    acknowledge(target)
    openByUser(target)
  }, [acknowledge, openByUser, revealSession, unreadOrder])

  // One press walks the pending asks; once none is left it retraces the trail
  // of Sessions the walk came through. Unlike the unread walk it acknowledges
  // nothing: only the operator's answer clears an ask.
  const jumpNextAsk = useCallback((): void => {
    const step = nextAskJump(askOrder, currentSessionId(list), askTrail.current)
    askTrail.current = step.stack
    if (step.target === null) return
    revealSession(step.target)
    openByUser(step.target)
  }, [askOrder, list, openByUser, revealSession])

  // The waiting window's cursor. Null means "not chosen yet", so the seed is
  // recomputed against the current projection on every render instead of being
  // kept as state that could point at a card which has since left.
  const activeCursor = waitingCursor ?? seedCursor(waiting)

  const toggleWaiting = useCallback((): void => {
    // The two surfaces never stack: the window covers the whole page, so the
    // activity list hands the sidebar region back as it opens.
    setActive(false)
    setWaitingCursor(null)
    setWaitingOpen(current => !current)
  }, [])

  const closeWaiting = useCallback((): void => {
    setWaitingOpen(false)
    setWaitingCursor(null)
  }, [])

  // Opening from the window is the same acknowledgement as opening from the
  // list or by pressing the bell: the window is a way to reach the Session,
  // not a second kind of visit.
  const openWaitingCard = useCallback((sessionId: SessionId): void => {
    acknowledge(sessionId)
    openByUser(sessionId)
    closeWaiting()
  }, [acknowledge, openByUser, closeWaiting])

  // While the window is up it owns the arrows, Enter, and Escape. The listener
  // sits on the document because the window is a page overlay: the keyboard
  // focus may still be on the sidebar behind it.
  useEffect(() => {
    if (!waitingOpen) return
    const onKeyDown = (event: KeyboardEvent): void => {
      const step: OverviewStep | null = event.key === 'ArrowDown' ? 'down'
        : event.key === 'ArrowUp' ? 'up'
          : event.key === 'ArrowRight' ? 'right'
            : event.key === 'ArrowLeft' ? 'left'
              : null
      if (step !== null) {
        event.preventDefault()
        setWaitingCursor(current => moveCursor(current, waiting, step))
        return
      }
      if (event.key === 'Enter') {
        const card = selectedCard(waiting, activeCursor)
        if (card === null) return
        event.preventDefault()
        openWaitingCard(card.id)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeWaiting()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [waitingOpen, waiting, activeCursor, openWaitingCard, closeWaiting])

  // Each seat is its plugin-scope command's only way to reach this component's
  // jump: publish while mounted, clear on unmount, and re-publish whenever the
  // order or the closure's anchors change. The ask seat's availability reads
  // the trail ref, so the walk home keeps working after the last ask clears.
  useEffect(() => unreadJump.publish({
    available: () => unreadOrder.length > 0,
    run: jumpNextUnread,
  }), [unreadJump, jumpNextUnread, unreadOrder])

  useEffect(() => askJump.publish({
    available: () => askOrder.length > 0 || askTrail.current.length > 0,
    run: jumpNextAsk,
  }), [askJump, jumpNextAsk, askOrder])

  // The waiting window's own seat. It stays available while the window is up,
  // because the same press closes it again, and it is available with nothing
  // waiting too: the press then answers with the empty copy instead of doing
  // nothing at all.
  useEffect(() => overviewJump.publish({
    available: () => true,
    run: toggleWaiting,
  }), [overviewJump, toggleWaiting])

  // Collapsing the sidebar unmounts the region the panel covers: leave the
  // activity view rather than keeping a flag nobody can see or clear.
  useEffect(() => {
    if (!wide) setActive(false)
  }, [wide])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setActive(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [active])

  // The activity list covers the browsing region, so any press on the sidebar's
  // own chrome — this plugin's row actions aside — hands the region back: a
  // neighbouring plugin's region tabs (tasks, schedules, …), the search field,
  // or the view-options menu must never be left sitting under a panel nobody
  // asked to keep. Presses outside the sidebar (the conversation) deliberately
  // keep the list open, so several finished Sessions can be opened in a row.
  useEffect(() => {
    if (!active) return
    const bellHost = hosts.bell
    const panelHost = hosts.panel
    const header = anchors?.header
    if (header === undefined) return
    const sidebar = header.closest('[class*="regionArea"]')?.parentElement ?? header.parentElement
    if (sidebar === null) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!isNode(target)) return
      if (panelHost?.contains(target) === true) return
      if (bellHost?.contains(target) === true) return
      if (!sidebar.contains(target)) return
      setActive(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [active, anchors, hosts.bell, hosts.panel])

  useEffect(() => () => { window.clearTimeout(noticeTimer.current) }, [])

  const showNotice = useCallback((message: string): void => {
    window.clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = window.setTimeout(() => { setNotice(null) }, 4000)
  }, [])

  const togglePin = useCallback((row: ActivityRow<SessionId>): void => {
    const call = row.pinned ? unpinSession : pinSession
    call(row.id).catch(() => {})
  }, [pinSession, unpinSession])

  const archive = useCallback((row: ActivityRow<SessionId>): void => {
    archiveSession(row.id).catch(() => { showNotice(t('action.archiveFailed')) })
  }, [archiveSession, showNotice, t])

  // While the panel covers the list, take the covered rows out of the tab
  // order and the accessibility tree; the attribute is restored on close.
  const listArea = anchors?.listArea ?? null
  const panelHost = hosts.panel
  useLayoutEffect(() => {
    if (!active || listArea === null || panelHost === null) return
    const covered = [...listArea.children]
      .filter(child => child !== panelHost)
      .map(child => child as HTMLElement)
    for (const element of covered) element.inert = true
    return () => {
      for (const element of covered) element.inert = false
    }
  }, [active, listArea, panelHost])

  if (hosts.bell === null) return null

  const baseLabel = active
    ? t('bell.hide')
    : unread > 0
      ? t('bell.showUnread', { count: unread })
      : t('bell.noUnread')
  // The click is still the unread walk, but the bell also carries the ask
  // count, so its accessible name has to say both.
  const label = pendingCount > 0
    ? baseLabel + ' \u00b7 ' + t('bell.pending', { count: pendingCount })
    : baseLabel
  const bell = (
    <Tooltip
      label={active ? label : label + ' \u00b7 ' + t('bell.openActivity')}
      side="bottom"
      delayMs={400}
      align="end"
    >
      <button
        type="button"
        className={active ? 'ab-bell ab-bell-active' : 'ab-bell'}
        aria-label={label}
        aria-pressed={active}
        onClick={jumpNextUnread}
        onContextMenu={(event) => {
          event.preventDefault()
          setActive(value => !value)
        }}
      >
        <BellIcon size={16} />
        {unread > 0 && (
          <span className="ab-badge" aria-hidden="true">{unread > 99 ? '99+' : String(unread)}</span>
        )}
        {pendingCount > 0 && (
          <span className="ab-badge ab-badge-ask" aria-hidden="true">
            {pendingCount > 99 ? '99+' : String(pendingCount)}
          </span>
        )}
      </button>
    </Tooltip>
  )

  const panel = (
    <div className="ab-panel" role="region" aria-label={t('panel.aria')}>
      {notice !== null && <div className="ab-panel-notice" role="status">{notice}</div>}
      <div className="ab-panel-scroll">
        {groups.length === 0
          ? <div className="ab-empty">{t('panel.empty')}</div>
          : groups.map(group => (
            <section key={group.key} className="ab-group">
              <div className="ab-group-label">{dayLabel(group.bucket, t, now)}</div>
              {group.rows.map(row => (
                <ActivityRowItem
                  key={row.id}
                  row={row}
                  t={t}
                  onOpen={(sessionId) => { acknowledge(sessionId); openByUser(sessionId) }}
                  onTogglePin={togglePin}
                  onArchive={archive}
                />
              ))}
            </section>
          ))}
      </div>
    </div>
  )

  return (
    <>
      {createPortal(bell, hosts.bell)}
      {active && hosts.panel !== null ? createPortal(panel, hosts.panel) : null}
      {/* The waiting window is a page overlay, not a sidebar cover: it portals
          into the document body so neither the sidebar's width nor its list
          seat shapes it. */}
      {waitingOpen
        ? createPortal(
          <WaitingWindow
            waiting={waiting}
            cursor={activeCursor}
            now={now}
            t={t}
            onOpen={openWaitingCard}
            onClose={closeWaiting}
          />,
          document.body,
        )
        : null}
    </>
  )
}
