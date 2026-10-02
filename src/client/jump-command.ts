/**
 * The application command behind the unread jump, and the one-slot seat that
 * carries the mounted bell's live jump to it.
 *
 * The jump itself can only live inside the mounted bell: it needs the
 * projection's unread order and the resolved sidebar anchors, and it owns the
 * cursor that makes the walk sequential. An application command, on the other
 * hand, is registered once for the plugin's lifetime. The seat is that seam —
 * the bell publishes while it is mounted, the command resolves against the
 * current publication, and a resolved action captures the handler it saw.
 *
 * @module dsh-session-ledger/client/jump-command
 */
import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

/** The live jump the bell offers while it is mounted. */
export interface UnreadJumpHandler {
  /** Whether there is at least one unread Session to land on right now. */
  available(): boolean
  /** Land on the next unread Session in jump order. */
  run(): void
}

/** Plugin-scope slot for the mounted bell's jump. */
export interface UnreadJumpSeat {
  /**
   * Publish the mounted handler.
   * @param handler - the bell's jump, or null to clear it.
   * @returns a disposer that clears only the value it published.
   */
  publish(handler: UnreadJumpHandler | null): () => void
  /** The current handler, or null while no bell is mounted. */
  current(): UnreadJumpHandler | null
}

/**
 * Create the one-slot seat the command and the bell share.
 * @returns the seat.
 */
export function createUnreadJumpSeat(): UnreadJumpSeat {
  let current: UnreadJumpHandler | null = null
  return {
    publish(handler) {
      current = handler
      return () => {
        if (current === handler) current = null
      }
    },
    current: () => current,
  }
}

/** Command id. It keys the stored override, so it has to stay stable. */
export const UNREAD_JUMP_COMMAND = 'session-ledger.jumpUnread' as ShortcutCommandId

/**
 * Build the shortcut command over a seat.
 *
 * macOS declares Mod+Shift+J; the other profiles declare Mod+Alt+J. macOS
 * Desktop runs the Web shortcut path (its preload sets
 * `data-dsh-desktop-web-shortcuts`, so the runtime is `web`), which rules out
 * two shapes: a bare Command+letter is rejected as `unsupported-browser`, and
 * an Option combination can die as a macOS dead key the DOM adapter treats as
 * an IME composition (only Command+Option+N is exempted). Mod+Shift avoids
 * both. The R variants are out because the
 * official `session.rename` and `page.refresh` bindings own them, and plain
 * Command+U belongs to the Desktop app menu's Check for Updates. Linux Web
 * admits none of these combinations, so no default is declared for it.
 *
 * @param seat - the seat the mounted bell publishes into.
 * @param label - localized command name shown in the shortcut reference.
 * @param unavailable - localized reason for a blocked resolution.
 * @returns the command definition for `ctx.shortcuts.register`.
 */
export function unreadJumpCommand(
  seat: UnreadJumpSeat,
  label: () => string,
  unavailable: string,
): ShortcutCommand {
  return {
    id: UNREAD_JUMP_COMMAND,
    label,
    aliases: ['jump to next unread', 'next unread', 'unread'],
    defaults: {
      'desktop:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
      'desktop:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
      'desktop:linux': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
      'web:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
      'web:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
    },
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => {
      const handler = seat.current()
      if (handler === null || !handler.available()) {
        return { status: 'blocked', reason: unavailable }
      }
      // The action captures the handler it resolved against: a re-publish
      // between resolve and run must not move the operator's target.
      return { status: 'handled', run: () => { handler.run() } }
    },
  }
}
