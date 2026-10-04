/**
 * Pure presentation helpers shared by the readout and the Settings row: which
 * metrics to render, and the one-line summary both surfaces speak.
 *
 * @module dsh-unread-helper/client/summary
 */
import { METRICS, shouldWarn, type Metric, type SessionCounts } from '../count.js'
import { visibleMetrics, type Visibility } from '../config.js'
import type { Translate } from './watch-types.js'

export { visibleMetrics }

/** One metric's number. */
export function metricValue(counts: SessionCounts, metric: Metric): number {
  return counts[metric]
}

/** The localized name of one metric. */
export function metricLabel(t: Translate, metric: Metric): string {
  return t('metric.' + metric)
}

/**
 * Build the one-line summary of the visible metrics.
 * @param t - bound translate function.
 * @param counts - the six counts.
 * @param visibility - per-metric visibility.
 * @returns the localized summary, or the empty-state copy.
 */
export function summaryText(t: Translate, counts: SessionCounts, visibility: Visibility): string {
  const shown = visibleMetrics(visibility)
  if (shown.length === 0) return t('watch.empty')
  const parts = shown.map((metric) =>
    t('watch.summaryItem', { label: metricLabel(t, metric), count: counts[metric] }),
  )
  return parts.join(t('watch.summaryJoin'))
}

/**
 * Whether the unarchived metric is in its warning state.
 * @param counts - the six counts.
 * @param threshold - configured threshold.
 * @returns whether unarchived is past the threshold.
 */
export function unarchivedWarns(counts: SessionCounts, threshold: number): boolean {
  return shouldWarn(counts.unarchived, threshold)
}

/** Every metric, in display order. */
export const ALL_METRICS = METRICS
