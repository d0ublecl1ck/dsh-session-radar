/**
 * Shared preference vocabulary for the status readout.
 *
 * The host Config schema, the browser config source, and the Settings row all
 * read the same metric list, variants, and defaults from here, so adding a
 * metric never means editing three field maps by hand.
 *
 * @module dsh-session-radar/config
 */
import { type Metric } from './count.js';
/** Namespace row id; also the Settings namespace and both slot entry ids. */
export declare const PLUGIN_ID = "session-radar";
/** The Config field that makes one metric visible. */
export type VisibilityField = 'showRunning' | 'showUnread' | 'showPending' | 'showIdle' | 'showUnarchived' | 'showArchived';
/** Config field name per metric. */
export declare const METRIC_FIELD: Readonly<Record<Metric, VisibilityField>>;
/** The Config field that keeps ledger reminders painted on the Session rows. */
export type RowBadgeField = 'showRowBadge';
/** Config field name of the Session row badge. */
export declare const ROW_BADGE_FIELD: RowBadgeField;
/** The row badge ships on; turning it off never touches the official dots. */
export declare const DEFAULT_ROW_BADGE = true;
/**
 * Read the row-badge preference off a raw config value.
 *
 * Only an explicit boolean counts; anything else keeps the shipped default, so
 * a hand-edited profile patch never silently drops the reminders.
 *
 * @param value - raw config value.
 * @returns whether the durable row badge is enabled.
 */
export declare function normalizeRowBadge(value: unknown): boolean;
/** A metric's visibility, keyed by metric. */
export type Visibility = Readonly<Record<Metric, boolean>>;
/** Every metric ships visible; the operator hides what they do not want. */
export declare const DEFAULT_VISIBILITY: Visibility;
/**
 * Read metric visibility off a raw config value.
 *
 * Only an explicit boolean counts. Anything missing or of the wrong type keeps
 * the shipped default, so a hand-edited profile patch never silently hides or
 * reveals a metric.
 *
 * @param value - raw config object, or anything shaped like one.
 * @returns visibility for every metric.
 */
export declare function normalizeVisibility(value: unknown): Visibility;
/** The layout families the readout can use, in Settings order. */
export declare const VARIANTS: readonly ["chips", "meter"];
/** One layout family. */
export type Variant = (typeof VARIANTS)[number];
/** The layout shown when the profile supplies none. */
export declare const DEFAULT_VARIANT: Variant;
/**
 * Normalize a configured variant.
 * @param value - raw config value.
 * @returns a known variant, or the shipped default.
 */
export declare function normalizeVariant(value: unknown): Variant;
/**
 * The metrics a readout renders, in display order.
 * @param visibility - per-metric visibility.
 * @returns the visible metric keys.
 */
export declare function visibleMetrics(visibility: Visibility): Metric[];
