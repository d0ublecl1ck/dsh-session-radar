/**
 * Pure presentation helpers shared by the readout and the Settings row: which
 * metrics to render, and the one-line summary both surfaces speak.
 *
 * @module dsh-session-radar/client/summary
 */
import { type Metric, type SessionCounts } from '../count.js';
import { visibleMetrics, type Visibility } from '../config.js';
import type { Translate } from './watch-types.js';
export { visibleMetrics };
/** One metric's number. */
export declare function metricValue(counts: SessionCounts, metric: Metric): number;
/** The localized name of one metric. */
export declare function metricLabel(t: Translate, metric: Metric): string;
/**
 * Build the one-line summary of the visible metrics.
 * @param t - bound translate function.
 * @param counts - the six counts.
 * @param visibility - per-metric visibility.
 * @returns the localized summary, or the empty-state copy.
 */
export declare function summaryText(t: Translate, counts: SessionCounts, visibility: Visibility): string;
/**
 * Whether the unarchived metric is in its warning state.
 * @param counts - the six counts.
 * @param threshold - configured threshold.
 * @returns whether unarchived is past the threshold.
 */
export declare function unarchivedWarns(counts: SessionCounts, threshold: number): boolean;
/** Every metric, in display order. */
export declare const ALL_METRICS: readonly ["running", "unread", "pending", "idle", "unarchived", "archived"];
