/**
 * Client half: inject the page styles, register the session-radar
 * dictionaries, register the unread and pending-ask shortcuts, mount the bell,
 * and add the merged status readout and its settings row.
 *
 * The bell registration is the component's lifecycle and locale carrier (plus
 * the shell's wide flag); its visible surface is portalled into the browsing
 * region, because the region is a single-occupant slot whose header has no hole
 * beside the search control. See ./ActivityBell for that rationale. The status
 * half is a second group of registrations in this same module (one client
 * bundle, one entry): the readout is another sidebar.footer.action occupant and
 * the preference row is gated on the Host actually serving this plugin's
 * config namespace.
 *
 * @module dsh-session-radar/client
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionPromptRequest } from '@deepseek-ai/dsh-api-session-controller/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { PLUGIN_ID } from '../config.js'
import './types.js'
import { ActivityBell } from './ActivityBell.js'
import { createConfigSource } from './config-source.js'
import { askJumpCommand, createJumpSeat, overviewCommand, unreadJumpCommand } from './jump-command.js'
import { createLedgerSource } from './ledger-source.js'
import { en, zh } from './locales.js'
import { droppedIds, readManualUnread, watchManualUnread } from './manual-unread.js'
import { RowBadge } from './RowBadge.js'
import { SettingsRow } from './SettingsRow.js'
import { StatusWatch } from './StatusWatch.js'
import { injectStyles, removeStyles } from './styles.js'
import type { ConfigFormsService, WatchSlotsService } from './watch-types.js'

/** Dictionary namespace owned by this plugin; the Host row id is the same value. */
const NS = PLUGIN_ID

/**
 * Entry id of the footer readout. The bell keeps the row id 'session-radar' in
 * the same slot, so the readout needs its own entry key; the config namespace
 * stays the row id and is never used as a status slot id here.
 */
const STATUS_ID = PLUGIN_ID + '.status'

/**
 * Footer order of the readout relative to the bell's footer seat (900). Both
 * contributions are this plugin's, so the readout sits immediately before the
 * bell in the footer action list; the bell itself renders nothing there (it
 * portals into the section header), which leaves the readout as the footer's
 * visible status line beside the Settings row.
 */
const STATUS_ORDER = 890

/** Settings-list order of the preference row, ahead of the shipped rows. */
const SETTINGS_ORDER = 16

/**
 * Entry id and order of the durable row badge. The seat is a list, so the
 * official Schedule marker keeps its own entry beside this one.
 */
const ROW_BADGE_ID = PLUGIN_ID + '.row-badge'
const ROW_BADGE_ORDER = 10

/** Services required before this plugin mounts. */
export const inject = ['slots', 'locale', 'configForms', 'shortcuts', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace']

/**
 * Mount the browser half.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const style = injectStyles()
    return () => {
      style.remove()
      removeStyles()
    }
  }, 'session-radar: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-radar: dictionaries')

  // The settings service owns the plugin's config form; the readout reads it
  // through one observable source, and the settings row only registers while
  // the Host actually serves that namespace.
  const forms = (ctx as unknown as { configForms: ConfigFormsService }).configForms
  const config = createConfigSource(forms.get(PLUGIN_ID))
  ctx.effect(() => () => config.dispose(), 'session-radar: status config source')

  // The injected face binds the framework's own sources: the Session list the
  // browsing region reads, the UI status it derives row dots from, and the
  // Workspace registry that supplies folder labels and archive membership.
  // Both services are part of inject above, so presence is already guaranteed.
  const sessions = (ctx.get('sessions') as ISessions).list
  const statuses = ctx.uiSession.sessionStatus
  const workspaces = (ctx.get('workspaces') as IWorkspaces).list
  // The retry dialog's send path goes out over the wire root rather than the
  // sessions object layer. Reason (measured 2026-10-08): the types this repo
  // compiles against describe `sessions.binding(id)` as materializing a scope
  // on demand, but the client build actually served to the page resolves
  // `binding(id)` only for a scope someone already retained, so every retry
  // came back "unavailable". `ctx.connection.rpc.call` is the stable seam —
  // the API gateway calls every official Remote exactly this way — and the
  // host's own `session/prompt` resumes a stored Session by itself.
  const connection = ctx.get('connection') as
    | { readonly rpc: { call(
      channel: string,
      endpoint: string,
      payload: unknown,
      signal?: AbortSignal,
    ): Promise<{ readonly ok: true; readonly value: unknown }
      | { readonly ok: false; readonly error: { readonly message: string } }> } }
    | undefined
  // One ledger, one reader: the bell's badge and jump order. The bell keeps no
  // unread memory of its own.
  const ledger = createLedgerSource(ctx, sessions)
  // Each shortcut is plugin-scope while its jump lives in the mounted bell, so
  // the bell publishes into one seat per walk and the command resolves against
  // it. The seats stay separate so neither walk can move the other's target,
  // and the waiting window's seat is a door rather than a target.
  const unreadJump = createJumpSeat()
  const askJump = createJumpSeat()
  const overviewJump = createJumpSeat()
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.shortcuts.register(
    unreadJumpCommand(unreadJump, () => t('bell.show'), t('bell.noUnread')),
  ), 'session-radar: shortcut command')
  ctx.effect(() => ctx.shortcuts.register(
    askJumpCommand(askJump, () => t('bell.jumpAsk'), t('bell.noAsk')),
  ), 'session-radar: ask shortcut command')
  ctx.effect(() => ctx.shortcuts.register(
    overviewCommand(overviewJump, () => t('overview.open'), t('overview.noWaiting')),
  ), 'session-radar: overview shortcut command')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'session-radar',
    order: 900,
    locale: NS,
    inject: () => ({
      openSession: (sessionId: SessionId) => { ctx.uiWorkspace.openSession(sessionId) },
      pinSession: (sessionId: SessionId) => ctx.uiWorkspace.pinSession(sessionId),
      unpinSession: (sessionId: SessionId) => ctx.uiWorkspace.unpinSession(sessionId),
      archiveSession: (sessionId: SessionId) => ctx.uiWorkspace.archiveSession(sessionId),
      // Asking a cut-off Session to carry on: one official `session/prompt`
      // Remote call. The host resumes a stored Session by itself, so this works
      // for one that was never opened, and it never moves the operator's stage.
      retrySession: async (sessionId: SessionId) => {
        if (connection === undefined) return { ok: false as const, message: t('retry.unavailable') }
        const request: SessionPromptRequest = {
          requestId: crypto.randomUUID() as SessionPromptRequest['requestId'],
          sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: t('retry.continueMessage') }],
        }
        try {
          const result = await connection.rpc.call('/api', 'session/prompt', { args: { request } })
          return result.ok ? { ok: true as const } : { ok: false as const, message: result.error.message }
        } catch (error: unknown) {
          return { ok: false as const, message: String((error as Error)?.message ?? error) }
        }
      },
      sessions,
      statuses,
      workspaces,
      ledger,
      unreadJump,
      askJump,
      overviewJump,
    }),
  }, ActivityBell))

  // The status readout and the settings row are reached structurally: their
  // slot keys are owned by shell packages this repo does not depend on for
  // types, and the settings row's entry id is the config namespace.
  const watchSlots = ctx.slots as unknown as WatchSlotsService

  // The readout is unconditional: it renders nothing only when every metric is
  // hidden, so the sidebar foot never reflows on a config edit.
  ctx.effect(() => watchSlots.inject('sidebar.footer.action', () => watchSlots.register({
    name: 'sidebar.footer.action',
    id: STATUS_ID,
    order: STATUS_ORDER,
    locale: NS,
    inject: () => ({ config }),
  }, StatusWatch)), 'session-radar: status readout')

  // The preference row follows the Host's own namespace: a deployment that
  // never served it shows no trace of the row.
  ctx.effect(() => forms.whileServed([PLUGIN_ID], () => watchSlots.inject('settings.general.item', () => watchSlots.register({
    name: 'settings.general.item',
    id: PLUGIN_ID,
    order: SETTINGS_ORDER,
    locale: NS,
    inject: () => ({ config }),
  }, SettingsRow))), 'session-radar: status settings row')

  // The Session row's leading seat renders only while the row's own status is
  // idle and the Workspace browser carries no manual unread mark; the official
  // renderer fills it with the same done dot when either is set. After a
  // restart the framework's in-memory completion flag is empty, so this is the
  // one gap a durable ledger reminder can paint into.
  ctx.effect(() => watchSlots.inject('sidebar.session.row.leading', () => watchSlots.register({
    name: 'sidebar.session.row.leading',
    id: ROW_BADGE_ID,
    order: ROW_BADGE_ORDER,
    locale: NS,
    inject: () => ({ ledger, config }),
  }, RowBadge)), 'session-radar: row badge')

  // The operator's own "mark as read" removes the id from the Workspace view
  // store; the ledger has to hear about it or the durable dot outlives the mark
  // it was meant to clear. A fresh mark is never treated as a read.
  ctx.effect(() => {
    let previous = readManualUnread()
    return watchManualUnread((next) => {
      for (const id of droppedIds(previous, next)) ledger.read(id)
      previous = next
    })
  }, 'session-radar: manual read sync')
}
