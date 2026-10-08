/**
 * The live plugin preference: one observable over the plugin's own config
 * namespace, holding the unarchived threshold, the layout variant, and one
 * visibility flag per metric.
 *
 * The config form belongs to the settings provider; this module only projects
 * it into the two things the readout and the Settings row need — a synchronous
 * getSnapshot for useSyncExternalStore, and writes that publish the optimistic
 * value instead of waiting for the Host round-trip to re-render.
 *
 * @module dsh-session-radar/client/config-source
 */
import { type Metric } from '../count.js';
import { type Variant, type Visibility } from '../config.js';
import type { ConfigFormLike } from './watch-types.js';
/** Observable preference handed to the readout and the Settings row. */
export interface WatchConfig {
    /** Warn once the unarchived count exceeds this value. */
    readonly threshold: number;
    /** Which layout the readout uses. */
    readonly variant: Variant;
    /** Which metrics the readout renders. */
    readonly visibility: Visibility;
    /** Whether the durable Session row badge is painted. */
    readonly rowBadge: boolean;
}
/** Observable preference source. */
export interface ConfigSource {
    /** @returns the current preference, never undefined. */
    getSnapshot(): WatchConfig;
    /** @param listener - change callback. @returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** @param value - next threshold. @returns whether the Host accepted the write. */
    setThreshold(value: number): Promise<boolean>;
    /** @param metric - metric to toggle. @param visible - next visibility. @returns whether the Host accepted the write. */
    setVisible(metric: Metric, visible: boolean): Promise<boolean>;
    /** @param variant - next layout. @returns whether the Host accepted the write. */
    setVariant(variant: Variant): Promise<boolean>;
    /** @param value - next row-badge visibility. @returns whether the Host accepted the write. */
    setRowBadge(value: boolean): Promise<boolean>;
    /** Release the config-form subscription (client fiber dispose). */
    dispose(): void;
}
/**
 * Create the live preference source.
 * @param form - the plugin entry's config form.
 * @returns the observable preference and its disposer.
 */
export declare function createConfigSource(form: ConfigFormLike): ConfigSource;
