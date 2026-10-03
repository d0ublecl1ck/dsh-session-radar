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
import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client';
/** The live jump the bell offers while it is mounted. */
export interface JumpHandler {
    /** Whether the press has anywhere to land right now. */
    available(): boolean;
    /** Land on the next target in jump order. */
    run(): void;
}
/** Plugin-scope slot for one mounted bell's jump. */
export interface JumpSeat {
    /**
     * Publish the mounted handler.
     * @param handler - the bell's jump, or null to clear it.
     * @returns a disposer that clears only the value it published.
     */
    publish(handler: JumpHandler | null): () => void;
    /** The current handler, or null while no bell is mounted. */
    current(): JumpHandler | null;
}
/**
 * Create the one-slot seat a command and the bell share.
 * @returns the seat.
 */
export declare function createJumpSeat(): JumpSeat;
/** Unread-walk command id. It keys the stored override, so it has to stay stable. */
export declare const UNREAD_JUMP_COMMAND: ShortcutCommandId;
/** Pending-ask command id. It keys the stored override, so it has to stay stable. */
export declare const ASK_JUMP_COMMAND: ShortcutCommandId;
/**
 * Build the unread-walk command over a seat.
 * @param seat - the seat the mounted bell publishes into.
 * @param label - localized command name shown in the shortcut reference.
 * @param unavailable - localized reason for a blocked resolution.
 * @returns the command definition for `ctx.shortcuts.register`.
 */
export declare function unreadJumpCommand(seat: JumpSeat, label: () => string, unavailable: string): ShortcutCommand;
/**
 * Build the pending-ask command over a seat.
 *
 * The helper keys mirror the unread walk exactly (Mod+Shift on macOS,
 * Mod+Alt elsewhere); only the letter changes, to O, so the two walks stay a
 * matching pair in the shortcut reference.
 *
 * @param seat - the seat the mounted bell publishes into.
 * @param label - localized command name shown in the shortcut reference.
 * @param unavailable - localized reason for a blocked resolution.
 * @returns the command definition for `ctx.shortcuts.register`.
 */
export declare function askJumpCommand(seat: JumpSeat, label: () => string, unavailable: string): ShortcutCommand;
