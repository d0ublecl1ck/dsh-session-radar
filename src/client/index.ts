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
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { PLUGIN_ID } from '../config.js'
import './types.js'
import { ActivityBell } from './ActivityBell.js'
import { createConfigSource } from './config-source.js'
import { askJumpCommand, createJumpSeat, unreadJumpCommand } from './jump-command.js'
import { createLedgerSource } from './ledger-source.js'
import { en, zh } from './locales.js'
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
  // One ledger, one reader: the bell's badge and jump order. The bell keeps no
  // unread memory of its own.
  const ledger = createLedgerSource(ctx, sessions)
  // Each shortcut is plugin-scope while its jump lives in the mounted bell, so
  // the bell publishes into one seat per walk and the command resolves against
  // it. The two seats stay separate so neither walk can move the other's target.
  const unreadJump = createJumpSeat()
  const askJump = createJumpSeat()
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.shortcuts.register(
    unreadJumpCommand(unreadJump, () => t('bell.show'), t('bell.noUnread')),
  ), 'session-radar: shortcut command')
  ctx.effect(() => ctx.shortcuts.register(
    askJumpCommand(askJump, () => t('bell.jumpAsk'), t('bell.noAsk')),
  ), 'session-radar: ask shortcut command')
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
      sessions,
      statuses,
      workspaces,
      ledger,
      unreadJump,
      askJump,
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
}
