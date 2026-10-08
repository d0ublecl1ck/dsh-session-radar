/**
 * The status readout at the sidebar foot.
 *
 * Every jumpable metric is also a control: a press walks to the next Session of
 * that kind, exactly the way the bell walks unread. The walk itself belongs to
 * the mounted bell (see ./metric-jump), so this component only routes the press
 * and reads the numbers. The sidebar slot hands every occupant only the
 * column's own state, so all of them come from the framework's standard
 * selector hooks and this component keeps no state of its own. The same numbers
 * feed the Settings row, so the two surfaces can never disagree.
 *
 * @module dsh-session-radar/client/StatusWatch
 */
import { useSyncExternalStore } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Metric } from '../count.js'
import { MetricIcon, WatchIcon } from './icons.js'
import { metricLabel, summaryText, unarchivedWarns, visibleMetrics } from './summary.js'
import { isJumpMetric, type MetricJumpSeat } from './metric-jump.js'
import { useSessionCounts } from './use-counts.js'
import type { ConfigSource, WatchConfig } from './config-source.js'
import type { SnapshotSelectorHook, Translate } from './watch-types.js'

/** Composed props of a sidebar.footer.action occupant. */
export interface StatusWatchProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  readonly wide: boolean
  /** Selector hook over the Session list. */
  readonly useSessions: SnapshotSelectorHook
  /** Selector hook over the unified Session UI status snapshot. */
  readonly useSessionStatus: SnapshotSelectorHook | undefined
  /** Selector hook over the Workspace registry (the archive set). */
  readonly useWorkspaces: SnapshotSelectorHook
  /** Live preference owned by this plugin's config namespace. */
  readonly config: ConfigSource
  /**
   * The mounted bell's per-metric walk. Absent only outside a live page, where
   * a press has nothing to reach anyway.
   */
  readonly metricJump?: MetricJumpSeat | undefined
  /** Bound translate function for the session-radar namespace. */
  readonly t: Translate
}

/** The four activity metrics, in the order the meter paints them. */
const ACTIVITY: readonly Metric[] = ['running', 'unread', 'pending', 'idle']

/**
 * Render the readout.
 * @param props - composed sidebar slot props plus this plugin's inject face.
 * @returns the readout element, or null when every metric is hidden.
 */
export function StatusWatch({
  wide,
  useSessions,
  useSessionStatus,
  useWorkspaces,
  config,
  metricJump,
  t,
}: StatusWatchProps) {
  const watch: WatchConfig = useSyncExternalStore(config.subscribe, config.getSnapshot, config.getSnapshot)
  const counts = useSessionCounts({ useSessions, useSessionStatus, useWorkspaces })
  const shown = visibleMetrics(watch.visibility)
  if (shown.length === 0) return null

  const warn = unarchivedWarns(counts, watch.threshold)
  const summary = summaryText(t, counts, watch.visibility)
  const label = warn
    ? t('watch.warn', { count: counts.unarchived, threshold: watch.threshold }) + t('watch.summaryJoin') + summary
    : t('watch.aria', { summary })

  // The rail is 56px wide: a row of chips would be clipped, so both layouts
  // collapse to the same single mark with the unarchived count.
  if (!wide) {
    return (
      <Tooltip label={label} side="top" delayMs={200} portal>
        <span className="sw-rail" role="status" aria-label={label} data-warn={warn ? 'true' : undefined}>
          <WatchIcon />
          <span className="sw-rail-count" aria-hidden="true">{counts.unarchived}</span>
        </span>
      </Tooltip>
    )
  }

  const body = watch.variant === 'meter'
    ? renderMeter(counts, shown, warn, label, t, metricJump)
    : renderChips(counts, shown, warn, label, t, metricJump)

  return (
    // The shell's own tooltip is portaled out of the sidebar's clipping column,
    // so the full metric names survive even in the 56px rail. Hover and
    // keyboard focus both raise it; the readout keeps its own accessible name.
    // The hint names the affordance the icons now carry, which hovering alone
    // does not otherwise reveal.
    <Tooltip label={label + ' · ' + t('watch.jumpHint')} side="top" delayMs={200} portal>
      {body}
    </Tooltip>
  )
}

/** Whether one metric should paint its warning state. */
function warnOf(metric: Metric, warn: boolean): 'true' | undefined {
  return metric === 'unarchived' && warn ? 'true' : undefined
}

/** One metric's icon and number: a button whenever there is somewhere to jump. */
function MetricCell({
  metric, count, warn, className, t, metricJump,
}: {
  readonly metric: Metric
  readonly count: number
  readonly warn: boolean
  readonly className: 'sw-chip' | 'sw-legend'
  readonly t: Translate
  readonly metricJump: MetricJumpSeat | undefined
}) {
  const glyph = (
    <>
      <MetricIcon metric={metric} />
      <span className="sw-chip-count">{count}</span>
    </>
  )
  // The archive is not a jump target (the shell refuses to open an archived
  // Session), so that one stays a plain readout.
  if (!isJumpMetric(metric)) {
    return <span className={className} data-metric={metric} data-warn={warnOf(metric, warn)}>{glyph}</span>
  }
  return (
    <button
      type="button"
      className={className}
      data-metric={metric}
      data-warn={warnOf(metric, warn)}
      aria-label={t('watch.jump', { label: metricLabel(t, metric), count })}
      onClick={() => { metricJump?.run(metric) }}
    >
      {glyph}
    </button>
  )
}

/** Layout A: colored icon + number pills, one per visible metric. */
function renderChips(
  counts: ReturnType<typeof useSessionCounts>,
  shown: readonly Metric[],
  warn: boolean,
  label: string,
  t: Translate,
  metricJump: MetricJumpSeat | undefined,
) {
  return (
    <span className="sw-watch" data-variant="chips" role="status" aria-label={label}>
      {shown.map((metric) => (
        <MetricCell
          key={metric}
          className="sw-chip"
          metric={metric}
          count={counts[metric]}
          warn={warn}
          t={t}
          metricJump={metricJump}
        />
      ))}
    </span>
  )
}

/** Layout B: a stacked proportion bar over the activity metrics, plus the full legend. */
function renderMeter(
  counts: ReturnType<typeof useSessionCounts>,
  shown: readonly Metric[],
  warn: boolean,
  label: string,
  t: Translate,
  metricJump: MetricJumpSeat | undefined,
) {
  const activity = ACTIVITY.filter((metric) => shown.includes(metric))
  return (
    <span className="sw-meter" data-variant="meter" role="status" aria-label={label}>
      <span className="sw-meter-bar" aria-hidden="true">
        {activity.length === 0 ? (
          <span className="sw-meter-seg" data-metric="idle" data-empty="true" />
        ) : (
          activity.map((metric) => (
            <span
              className="sw-meter-seg"
              data-metric={metric}
              key={metric}
              style={{ flexGrow: Math.max(0, counts[metric]) }}
            />
          ))
        )}
      </span>
      <span className="sw-meter-legend">
        {shown.map((metric) => (
          <MetricCell
            key={metric}
            className="sw-legend"
            metric={metric}
            count={counts[metric]}
            warn={warn}
            t={t}
            metricJump={metricJump}
          />
        ))}
      </span>
    </span>
  )
}
