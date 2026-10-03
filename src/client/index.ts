/**
 * Client half: inject the page styles, register the `unread-helper`
 * dictionaries, register the unread-jump shortcut, and mount the bell.
 *
 * The registration is the component's lifecycle and locale carrier (plus the
 * shell's `wide` flag); the visible surface is portalled into the browsing
 * region, because the region is a single-occupant slot whose header has no
 * hole beside the search control. See `./ActivityBell` for that rationale.
 *
 * @module dsh-unread-helper/client
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
import './types.js'
import { ActivityBell } from './ActivityBell.js'
import { createUnreadJumpSeat, unreadJumpCommand } from './jump-command.js'
import { createLedgerSource } from './ledger-source.js'
import { en, zh } from './locales.js'
import { injectStyles, removeStyles } from './styles.js'

/** Dictionary namespace owned by this plugin. */
const NS = 'unread-helper'

/** Services required before this plugin mounts. */
export const inject = ['slots', 'locale', 'shortcuts', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace']

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
  }, 'unread-helper: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'unread-helper: dictionaries')

  // The injected face binds the framework's own sources: the Session list the
  // browsing region reads, the UI status it derives row dots from, and the
  // Workspace registry that supplies folder labels and archive membership.
  // Both services are part of `inject` above, so presence is already
  // guaranteed; `get` only lacks that refinement in its own type.
  const sessions = (ctx.get('sessions') as ISessions).list
  const statuses = ctx.uiSession.sessionStatus
  const workspaces = (ctx.get('workspaces') as IWorkspaces).list
  // One ledger, one reader: the bell's badge and jump order. The bell keeps no
  // unread memory of its own.
  const ledger = createLedgerSource(ctx, sessions)
  // The shortcut is plugin-scope while the jump lives in the mounted bell, so
  // the bell publishes into this seat and the command resolves against it.
  const unreadJump = createUnreadJumpSeat()
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.shortcuts.register(
    unreadJumpCommand(unreadJump, () => t('bell.show'), t('bell.noUnread')),
  ), 'unread-helper: shortcut command')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'unread-helper',
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
    }),
  }, ActivityBell))
}
