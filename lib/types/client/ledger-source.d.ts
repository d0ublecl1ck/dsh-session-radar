/**
 * Browser-side bridge to the host ledger.
 *
 * The host owns the cross-restart memory. The Typert Remote path is closed to a
 * hand-written contribution (the gateway validates descriptors against
 * generated metadata), so this module posts to the plugin's own webServer
 * route instead — same origin, browser cookie, and the connection's trust
 * fence on the host side.
 *
 * Failures are published, never swallowed: a bridge that fails silently is
 * indistinguishable from "nothing to show", which is exactly the bug this file
 * was written to avoid.
 *
 * @module dsh-session-radar/client/ledger-source
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** One unread Session as the host reports it. */
export interface LedgerUnreadRow {
    readonly sessionId: string;
    readonly at: number;
    readonly kind: string | null;
    /** The reminder is a turn that never finished, not a finished one. */
    readonly interrupted: boolean;
}
/** Everything the bell renders. */
export interface LedgerSnapshot {
    readonly now: number;
    /**
     * When the host process started, or 0 before the first answer. The retry
     * dialog keys "already asked about this boot" on it.
     */
    readonly bootAt: number;
    readonly unread: readonly LedgerUnreadRow[];
    /** Last bridge failure, or null. Rendered so a broken bridge is visible. */
    readonly error: string | null;
}
/** Extras a read can report about why the operator is acknowledging. */
export interface LedgerReadOptions {
    /**
     * The operator reached the conversation's tail. That is the acknowledgement
     * of a restart-interrupted turn; a plain open leaves the marker armed.
     */
    readonly acknowledgeInterrupt?: boolean;
}
/** Observable ledger face handed to the component. */
export interface LedgerSource {
    getSnapshot(): LedgerSnapshot;
    subscribe(listener: () => void): () => void;
    read(sessionId: SessionId, options?: LedgerReadOptions): void;
}
/**
 * Create the ledger source and keep it mounted for the plugin's lifetime.
 *
 * @param _ctx - client root context (kept for the effect scope).
 * @param sessions - the Session list the read acknowledgement watches.
 * @returns the observable ledger face.
 */
export declare function createLedgerSource(_ctx: Context, sessions: {
    getSnapshot(): SessionListState;
    subscribe(listener: () => void): () => void;
}): LedgerSource;
