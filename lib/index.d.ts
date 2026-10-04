/**
 * dsh-unread-helper — host entry.
 *
 * The host half owns two things the browser half cannot: the cross-restart
 * ledger (behavior in `src/host.ts`, routed over the plugin's own
 * authenticated webServer path) and the plugin's preference surface — the
 * unarchived warning threshold, the readout layout, and one visibility switch
 * per metric, declared here as volatile Config fields. dsh-settings projects
 * exactly those fields into the Settings namespace named by this row's id
 * (`unread-helper`), which is what the merged client readout and its
 * settings row read and write. Counting itself stays in the browser: every
 * number is derived from the snapshots the shell already publishes.
 *
 * @module dsh-unread-helper
 */
import z from '@deepseek-ai/schemastery';
/** Stable cordis plugin name (the bundle row's `name` resolves to this package). */
export declare const name = "unread-helper";
/** The browser reaches this half through an authenticated webServer route. */
export declare const inject: string[];
/** The plugin's preference surface: what the readout shows, and when unarchived is too many. */
export interface Config {
    /** Warn once the unarchived Session count exceeds this value. */
    threshold: number;
    /** Layout family used by the sidebar readout. */
    variant: string;
    /** Whether the running metric appears in the readout. */
    showRunning: boolean;
    /** Whether the unread metric appears in the readout. */
    showUnread: boolean;
    /** Whether the pending metric appears in the readout. */
    showPending: boolean;
    /** Whether the idle metric appears in the readout. */
    showIdle: boolean;
    /** Whether the unarchived metric appears in the readout. */
    showUnarchived: boolean;
    /** Whether the archived metric appears in the readout. */
    showArchived: boolean;
}
/**
 * Row config. volatile is what makes a field live-editable from the Settings
 * page: dsh-settings only projects volatile fields into a namespace.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    threshold: z<number, number, "volatile-defined">;
    variant: z<string, string, "volatile-defined">;
    showRunning: z<boolean, boolean, "volatile-defined">;
    showUnread: z<boolean, boolean, "volatile-defined">;
    showPending: z<boolean, boolean, "volatile-defined">;
    showIdle: z<boolean, boolean, "volatile-defined">;
    showUnarchived: z<boolean, boolean, "volatile-defined">;
    showArchived: z<boolean, boolean, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    threshold: z<number, number, "volatile-defined">;
    variant: z<string, string, "volatile-defined">;
    showRunning: z<boolean, boolean, "volatile-defined">;
    showUnread: z<boolean, boolean, "volatile-defined">;
    showPending: z<boolean, boolean, "volatile-defined">;
    showIdle: z<boolean, boolean, "volatile-defined">;
    showUnarchived: z<boolean, boolean, "volatile-defined">;
    showArchived: z<boolean, boolean, "volatile-defined">;
}>>, "plain">;
/**
 * Mount the host half: the cross-restart ledger, its persistence, and the
 * Remote calls the browser half makes. The Config schema above is read by the
 * settings provider; this function performs no counting.
 *
 * @param ctx - host cordis context.
 */
export declare function apply(ctx: unknown): void;
