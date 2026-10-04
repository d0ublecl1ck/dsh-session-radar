import type { ConfigSource } from './config-source.js';
import type { SnapshotSelectorHook, Translate } from './watch-types.js';
/** Composed props of a settings.general.item occupant. */
export interface SettingsRowProps {
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
 * Render the preference editor with the live counts beside every control.
 * @param props - composed Settings slot props plus this plugin's inject face.
 * @returns the preference row.
 */
export declare function SettingsRow({ useSessions, useSessionStatus, useWorkspaces, config, t }: SettingsRowProps): import("react").JSX.Element;
