/**
 * The application commands behind the unread walk and the pending-ask walk,
 * plus the one-slot seats that carry each mounted bell's live jump to them.
 *
 * A jump itself can only live inside the mounted bell: it needs the
 * projection's order and the resolved sidebar anchors, and it owns the cursor
 * (or the return trail) that makes the walk sequential. An application command,
 * on the other hand, is registered once for the plugin's lifetime. A seat is
 * that seam — the bell publishes while it is mounted, the command resolves
 * against the current publication, and a resolved action captures the handler
 * it saw.
 *
 * @module dsh-unread-helper/client/jump-command
 */
import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

/** The live jump the bell offers while it is mounted. */
export interface JumpHandler {
  /** Whether the press has anywhere to land right now. */
  available(): boolean
  /** Land on the next target in jump order. */
  run(): void
}

/** Plugin-scope slot for one mounted bell's jump. */
export interface JumpSeat {
  /**
   * Publish the mounted handler.
   * @param handler - the bell's jump, or null to clear it.
   * @returns a disposer that clears only the value it published.
   */
  publish(handler: JumpHandler | null): () => void
  /** The current handler, or null while no bell is mounted. */
  current(): JumpHandler | null
}

/**
 * Create the one-slot seat a command and the bell share.
 * @returns the seat.
 */
export function createJumpSeat(): JumpSeat {
  let current: JumpHandler | null = null
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

/** Unread-walk command id. It keys the stored override, so it has to stay stable. */
export const UNREAD_JUMP_COMMAND = 'unread-helper.jumpUnread' as ShortcutCommandId

/** Pending-ask command id. It keys the stored override, so it has to stay stable. */
export const ASK_JUMP_COMMAND = 'unread-helper.jumpAsk' as ShortcutCommandId

/**
 * Per-profile default bindings for the unread walk.
 *
 * macOS declares Mod+Shift+J; the other profiles declare Mod+Alt+J. macOS
 * Desktop runs the Web shortcut path (its preload sets
 * `data-dsh-desktop-web-shortcuts`, so the runtime is `web`), which rules out
 * two shapes: a bare Command+letter is rejected as `unsupported-browser`, and
 * an Option combination can die as a macOS dead key the DOM adapter treats as
 * an IME composition (only Command+Option+N is exempted). Mod+Shift avoids
 * both. The R variants are out because the official `session.rename` and
 * `page.refresh` bindings own them, and plain Command+U belongs to the Desktop
 * app menu's Check for Updates. Linux Web admits none of these combinations, so
 * no default is declared for it.
 */
const UNREAD_JUMP_DEFAULTS: ShortcutCommand['defaults'] = {
  'desktop:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
  'desktop:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
  'desktop:linux': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
  'web:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
  'web:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
}

/**
 * Per-profile default bindings for the pending-ask walk.
 *
 * The helper-key *families* mirror the unread walk (Mod+Shift on macOS,
 * Mod+Alt elsewhere); only the letter differs, because the letter O is already
 * spoken for on every simple combination. The shipped `workspace.add` owns
 * `Mod+O` on desktop and `Mod+Alt+O` on web, and `workspace.openLocal` owns
 * `Mod+Alt+O` on desktop and `Mod+Shift+O` on web. The shortcut registry throws
 * on overlapping defaults in *any* declared profile — not just the running one —
 * so declaring any of those shapes took the whole client half down at boot.
 * I is the free neighbour: no shipped command claims `Mod+Shift+I` or
 * `Mod+Alt+I`, and neither is a browser or macOS system shortcut. Linux Web
 * admits none of these combinations, so no default is declared for it.
 */
const ASK_JUMP_DEFAULTS: ShortcutCommand['defaults'] = {
  'desktop:macos': { code: 'KeyI', modifiers: ['primary', 'shift'] },
  'desktop:windows': { code: 'KeyI', modifiers: ['primary', 'alt'] },
  'desktop:linux': { code: 'KeyI', modifiers: ['primary', 'alt'] },
  'web:macos': { code: 'KeyI', modifiers: ['primary', 'shift'] },
  'web:windows': { code: 'KeyI', modifiers: ['primary', 'alt'] },
}

/**
 * Build one jump command over a seat.
 * @param id - stable command id.
 * @param seat - the seat the mounted bell publishes into.
 * @param label - localized command name shown in the shortcut reference.
 * @param unavailable - localized reason for a blocked resolution.
 * @param aliases - search aliases shown in the shortcut reference.
 * @param defaults - per-profile default bindings.
 * @returns the command definition for `ctx.shortcuts.register`.
 */
function jumpCommand(
  id: ShortcutCommandId,
  seat: JumpSeat,
  label: () => string,
  unavailable: string,
  aliases: readonly string[],
  defaults: ShortcutCommand['defaults'],
): ShortcutCommand {
  return {
    id,
    label,
    aliases: [...aliases],
    defaults,
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

/**
 * Build the unread-walk command over a seat.
 * @param seat - the seat the mounted bell publishes into.
 * @param label - localized command name shown in the shortcut reference.
 * @param unavailable - localized reason for a blocked resolution.
 * @returns the command definition for `ctx.shortcuts.register`.
 */
export function unreadJumpCommand(
  seat: JumpSeat,
  label: () => string,
  unavailable: string,
): ShortcutCommand {
  return jumpCommand(
    UNREAD_JUMP_COMMAND, seat, label, unavailable,
    ['jump to next unread', 'next unread', 'unread'], UNREAD_JUMP_DEFAULTS,
  )
}

/**
 * Build the pending-ask command over a seat.
 *
 * Keeps the unread walk's helper-key families, differing only in the letter,
 * because the letter O is already spoken for (see {@link ASK_JUMP_DEFAULTS}).
 *
 * @param seat - the seat the mounted bell publishes into.
 * @param label - localized command name shown in the shortcut reference.
 * @param unavailable - localized reason for a blocked resolution.
 * @returns the command definition for `ctx.shortcuts.register`.
 */
export function askJumpCommand(
  seat: JumpSeat,
  label: () => string,
  unavailable: string,
): ShortcutCommand {
  return jumpCommand(
    ASK_JUMP_COMMAND, seat, label, unavailable,
    ['jump to pending ask', 'next ask', 'pending ask'], ASK_JUMP_DEFAULTS,
  )
}
