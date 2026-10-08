/**
 * The restart-retry dialog.
 *
 * After a restart the ledger knows which turns were cut off, and this is the
 * one surface that speaks first: it lists them, everything retryable starts
 * checked, and one press sends the continue message to exactly the checked
 * Sessions. What is left unchecked keeps its unread reminder — the dialog is a
 * choice, not a cleanup.
 *
 * It portals into `document.body` like the waiting window, so it is a page
 * overlay rather than a sidebar cover.
 *
 * @module dsh-session-radar/client/RetryDialog
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  allRetryableSelected, defaultSelection, retrySelected, selectedIds, toggleAll, toggleOne,
  type RetryCandidate, type RetryOutcome,
} from './retry-model.js'

/** The locale seat this dialog's copy is bound to. */
type Translate = PropsLocale<'session-radar'>['t']

/** What the dialog needs from the mounted bell. */
export interface RetryDialogProps {
  readonly candidates: readonly RetryCandidate[]
  readonly t: Translate
  /** Send the continue message to each id, in order, and report what happened. */
  readonly onRetry: (ids: readonly SessionId[]) => Promise<RetryOutcome>
  /** The operator is done with the dialog, however it ended. */
  readonly onClose: () => void
}

/**
 * Render the checklist, or nothing when there is nothing to ask about.
 * @param props - rows, locale seat, transport, and the close path.
 * @returns the overlay, or null while there is nothing to offer.
 */
export function RetryDialog({ candidates, t, onRetry, onClose }: RetryDialogProps): ReactElement | null {
  const [selection, setSelection] = useState<ReadonlySet<SessionId>>(() => defaultSelection(candidates))
  const [sending, setSending] = useState(false)
  const [failures, setFailures] = useState<ReadonlyMap<SessionId, string>>(() => new Map())
  const selected = selectedIds(candidates, selection)
  const everything = allRetryableSelected(candidates, selection)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [onClose])

  const run = useCallback((): void => {
    if (sending || selected.length === 0) return
    setSending(true)
    setFailures(new Map())
    // The acknowledgement is the caller's: it spends a reminder only for the
    // Sessions whose prompt the host actually accepted.
    void onRetry(selected).then((outcome) => {
      setSending(false)
      if (outcome.failed.length === 0) {
        onClose()
        return
      }
      setFailures(new Map(outcome.failed.map((failure) => [failure.id, failure.message])))
    }).catch((error: unknown) => {
      setSending(false)
      setFailures(new Map(selected.map((id) => [id, String((error as Error)?.message ?? error)])))
    })
  }, [onClose, onRetry, selected, sending])

  if (candidates.length === 0) return null

  return createPortal(
    <div
      className="rt-veil"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="rt-panel" role="dialog" aria-modal="true" aria-label={t('retry.aria')}>
        <div className="rt-head">{t('retry.title')}</div>
        <p className="rt-intro">{t('retry.intro')}</p>
        <div className="rt-tools">
          <button
            type="button"
            className="rt-mini"
            onClick={() => { setSelection(toggleAll(candidates, selection)) }}
          >
            {t(everything ? 'retry.selectNone' : 'retry.selectAll')}
          </button>
        </div>
        <ul className="rt-list">
          {candidates.map((row) => (
            <li key={row.id} className={row.running ? 'rt-row rt-row-running' : 'rt-row'}>
              <input
                className="rt-check"
                type="checkbox"
                checked={row.running ? false : selection.has(row.id)}
                disabled={row.running}
                aria-label={row.title}
                onChange={() => { setSelection(toggleOne(selection, row.id)) }}
              />
              <span className="rt-title">{row.title}</span>
              {row.folder === '' ? null : <span className="rt-folder">{row.folder}</span>}
              {row.running ? <span className="rt-tag">{t('retry.running')}</span> : null}
              {failures.has(row.id)
                ? (
                  <span className="rt-error" title={failures.get(row.id) ?? ''}>
                    {t('retry.failed', { message: failures.get(row.id) ?? '' })}
                  </span>
                )
                : null}
            </li>
          ))}
        </ul>
        <div className="rt-foot">
          <button type="button" className="rt-mini" onClick={onClose}>{t('retry.later')}</button>
          <button
            type="button"
            className="rt-send"
            disabled={sending || selected.length === 0}
            onClick={run}
          >
            {t('retry.send', { count: selected.length })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
