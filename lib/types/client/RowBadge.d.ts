import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ConfigSource } from './config-source.js';
import type { LedgerSource } from './ledger-source.js';
import type { Translate } from './watch-types.js';
/** Composed props of a Session row leading-seat occupant. */
export interface RowBadgeProps {
    /** The Session this row renders. */
    readonly sessionId: SessionId;
    /** The host ledger, the only reminder source that survives a restart. */
    readonly ledger: LedgerSource;
    /** Live preference owned by this plugin's config namespace. */
    readonly config: ConfigSource;
    /** Bound translate function for the session-radar namespace. */
    readonly t: Translate;
}
/**
 * Render the durable unread dot for one Session row.
 * @param props - the row's Session plus this plugin's inject face.
 * @returns the dot, or null when the row carries no durable reminder.
 */
export declare function RowBadge({ sessionId, ledger, config, t }: RowBadgeProps): import("react").JSX.Element | null;
