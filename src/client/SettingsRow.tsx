/**
 * The Settings row that edits the status readout preference: which metrics show,
 * the layout variant, and the unarchived warning threshold.
 *
 * Contributed into settings.general.item — the additive seat for a preference
 * that needs no page of its own. The row draws its own labels, counts, and
 * write path, because that slot's owner projects none of them.
 *
 * @module dsh-session-radar/client/SettingsRow
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { ALL_METRICS, metricLabel, metricValue, summaryText } from './summary.js'
import { VARIANTS } from '../config.js'
import { MetricIcon } from './icons.js'
import { useSessionCounts } from './use-counts.js'
import type { ConfigSource, WatchConfig } from './config-source.js'
import type { SnapshotSelectorHook, Translate } from './watch-types.js'

/** Composed props of a settings.general.item occupant. */
export interface SettingsRowProps {
  /** Selector hook over the Session list. */
  readonly useSessions: SnapshotSelectorHook
  /** Selector hook over the unified Session UI status snapshot. */
  readonly useSessionStatus: SnapshotSelectorHook | undefined
  /** Selector hook over the Workspace registry (the archive set). */
  readonly useWorkspaces: SnapshotSelectorHook
  /** Live preference owned by this plugin's config namespace. */
  readonly config: ConfigSource
  /** Bound translate function for the session-radar namespace. */
  readonly t: Translate
}

/**
 * Render the preference editor with the live counts beside every control.
 * @param props - composed Settings slot props plus this plugin's inject face.
 * @returns the preference row.
 */
export function SettingsRow({ useSessions, useSessionStatus, useWorkspaces, config, t }: SettingsRowProps) {
  const watch: WatchConfig = useSyncExternalStore(config.subscribe, config.getSnapshot, config.getSnapshot)
  const counts = useSessionCounts({ useSessions, useSessionStatus, useWorkspaces })
  const [draft, setDraft] = useState(String(watch.threshold))
  const [failed, setFailed] = useState(false)

  // The accepted value is the authority: an outside write (profile patch, the
  // plugin card) must reach the input.
  useEffect(() => {
    setDraft(String(watch.threshold))
    setFailed(false)
  }, [watch.threshold])

  const commit = (): void => {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed === watch.threshold) {
      setDraft(String(watch.threshold))
      setFailed(false)
      return
    }
    void config.setThreshold(parsed).then((accepted) => {
      setFailed(!accepted)
      if (!accepted) setDraft(String(watch.threshold))
    })
  }

  const summary = summaryText(t, counts, watch.visibility)
  const warn = counts.unarchived > watch.threshold

  return (
    <div className="dsr-sw-row">
      <div className="dsr-sw-row-text">
        <span className="dsr-sw-row-title">{t('row.title')}</span>
        <span className="dsr-sw-row-desc">{t('row.description', { summary })}</span>
        {failed ? <span className="dsr-sw-row-error">{t('row.saveFailed')}</span> : null}
      </div>
      <div className="dsr-sw-row-controls">
        <div className="dsr-sw-variants" role="radiogroup" aria-label={t('row.variantLabel')}>
          {VARIANTS.map((variant) => (
            <button
              type="button"
              role="radio"
              aria-checked={watch.variant === variant}
              className={watch.variant === variant ? 'dsr-sw-variant dsr-sw-variant-on' : 'dsr-sw-variant'}
              key={variant}
              onClick={() => {
                void config.setVariant(variant)
              }}
            >
              {t('row.variant.' + variant)}
            </button>
          ))}
        </div>
        <fieldset className="dsr-sw-toggles">
          <legend className="dsr-sw-field-label">{t('row.showLabel')}</legend>
          {ALL_METRICS.map((metric) => (
            <label className="dsr-sw-toggle" data-metric={metric} key={metric}>
              <input
                type="checkbox"
                checked={watch.visibility[metric]}
                onChange={(event) => {
                  void config.setVisible(metric, event.currentTarget.checked)
                }}
              />
              <span className="dsr-sw-toggle-swatch" aria-hidden="true">
                <MetricIcon metric={metric} />
              </span>
              <span className="dsr-sw-toggle-label">{metricLabel(t, metric)}</span>
              <span
                className="dsr-sw-toggle-count"
                data-warn={metric === 'unarchived' && warn ? 'true' : undefined}
              >
                {metricValue(counts, metric)}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="dsr-sw-toggle dsr-sw-toggle-badge" data-metric="rowBadge">
          <input
            type="checkbox"
            checked={watch.rowBadge}
            onChange={(event) => {
              void config.setRowBadge(event.currentTarget.checked)
            }}
          />
          <span className="dsr-sw-toggle-swatch" aria-hidden="true">
            <StateDot state="done" />
          </span>
          <span className="dsr-sw-toggle-label">{t('row.badgeLabel')}</span>
        </label>
        <label className="dsr-sw-field">
          <span className="dsr-sw-field-label">{t('row.thresholdLabel')}</span>
          <span className="dsr-sw-field-hint">{t('row.thresholdHint')}</span>
          <span className="dsr-sw-sr-only">{t('row.inputLabel')}</span>
          <input
            className="dsr-sw-input"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              commit()
            }}
          />
        </label>
      </div>
    </div>
  )
}
