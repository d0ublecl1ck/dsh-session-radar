import type { ConfigSource } from './config-source.js';
import type { SnapshotSelectorHook, Translate } from './watch-types.js';
/** Composed props of a sidebar.footer.action occupant. */
export interface StatusWatchProps {
    /** Whether the sidebar renders wide content (false = 56px rail). */
    readonly wide: boolean;
    /** Selector hook over the Session list. */
    readonly useSessions: SnapshotSelectorHook;
    /** Selector hook over the unified Session UI status snapshot. */
    readonly useSessionStatus: SnapshotSelectorHook | undefined;
    /** Selector hook over the Workspace registry (the archive set). */
    readonly useWorkspaces: SnapshotSelectorHook;
    /** Live preference owned by this plugin's config namespace. */
    readonly config: ConfigSource;
    /** Bound translate function for the session-radar namespace. */
    readonly t: Translate;
}
/**
 * Render the readout.
 * @param props - composed sidebar slot props plus this plugin's inject face.
 * @returns the readout element, or null when every metric is hidden.
 */
export declare function StatusWatch({ wide, useSessions, useSessionStatus, useWorkspaces, config, t, }: StatusWatchProps): import("react").JSX.Element | null;
