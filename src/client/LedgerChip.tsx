/**
 * The persistent-reminder chip.
 *
 * Reads the host ledger through \`LedgerSource\` — the same numbers a page
 * reload cannot lose — and offers the continue rollout. It renders into the
 * sidebar foot beside the bell, so the two surfaces stay separate: the bell
 * answers "where is the next unread", the chip answers "what was left unfinished
 * by the last restart".
 *
 * @module dsh-session-ledger/client/LedgerChip
 */
import { useCallback, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { LedgerSource } from './ledger-source.js'

/** Business face the registration injects. */
export interface LedgerChipInjected {
  readonly ledger: LedgerSource
  readonly openSession: (sessionId: SessionId) => void
}

/** Composed props: shell share + locale seat + injected business face. */
export type LedgerChipProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'session-ledger'>
  & LedgerChipInjected

const TEXT = {
  zh: {
    title: '重启后待处理',
    unread: '未读',
    interrupted: '被重启中断',
    continueAll: '全部继续',
    progress: (done: number, total: number) => `继续中 ${done}/${total}`,
  },
  en: {
    title: 'Left over from a restart',
    unread: 'Unread',
    interrupted: 'Interrupted by restart',
    continueAll: 'Continue all',
    progress: (done: number, total: number) => `Continuing ${done}/${total}`,
  },
} as const

/** Structural shape both dictionaries satisfy. */
interface ChipCopy {
  readonly title: string
  readonly unread: string
  readonly interrupted: string
  readonly continueAll: string
  readonly progress: (done: number, total: number) => string
}

function copy(): ChipCopy {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? TEXT.en : TEXT.zh
}

/**
 * Render the chip and its popover.
 * @param props - shell share, locale seat, ledger source and open action.
 * @returns the chip, or nothing while every list is empty.
 */
export function LedgerChip({ ledger, openSession }: LedgerChipProps): ReactElement | null {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => ledger.subscribe(listener), [ledger]),
    useCallback(() => ledger.getSnapshot(), [ledger]),
  )
  const [open, setOpen] = useState(false)
  const text = copy()

  const unread = snapshot.unread
  const interrupted = snapshot.interrupted
  // Only the bell shows an unread count; this chip speaks for interrupted work.
  const idle = interrupted.length === 0 && !snapshot.rollout.running && snapshot.error === null
  if (idle && !open) return null

  const interruptedIds = new Set(interrupted.map((row) => row.sessionId))
  const rows = [...unread]
    .map((row) => ({ ...row, interrupted: interruptedIds.has(row.sessionId) }))
    .sort((left, right) => Number(right.interrupted) - Number(left.interrupted) || right.at - left.at)

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen((previous) => !previous) }}
        aria-expanded={open}
        aria-label={text.title}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--dsw-alias-border-l3)', borderRadius: 999,
          color: 'var(--dsw-alias-label-primary)', font: 'inherit',
        }}
      >
        {interrupted.length > 0 && <span style={{ color: '#d64545', fontWeight: 600 }}>{'⚠ ' + String(interrupted.length)}</span>}
        {unread.length > 0 && <span style={{ color: '#c98a00', fontWeight: 600 }}>{'• ' + String(unread.length)}</span>}
        {snapshot.rollout.running && (
          <span>{text.progress(Math.min(snapshot.rollout.done + 1, snapshot.rollout.total), snapshot.rollout.total)}</span>
        )}
        {snapshot.error !== null && <span title={snapshot.error} style={{ color: '#d64545', fontWeight: 600 }}>!</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={text.title}
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 40, width: 280,
            maxHeight: '40vh', overflow: 'auto', padding: 8, borderRadius: 10,
            border: '1px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-base)',
            color: 'var(--dsw-alias-label-primary)', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          }}
        >
          {interrupted.length > 0 && (
            <button
              type="button"
              disabled={snapshot.rollout.running}
              onClick={() => { void ledger.continueAll() }}
              style={{
                width: '100%', marginBottom: 8, padding: '4px 8px', cursor: 'pointer',
                border: '1px solid #d64545', borderRadius: 6, background: 'transparent',
                color: '#d64545', font: 'inherit',
              }}
            >
              {text.continueAll + ' (' + String(interrupted.length) + ')'}
            </button>
          )}

          {rows.length === 0 && <div style={{ opacity: 0.7, padding: '4px 2px' }}>{text.unread + ': 0'}</div>}

          {rows.map((row) => (
            <button
              key={row.sessionId}
              type="button"
              onClick={() => { openSession(row.sessionId as SessionId); ledger.read(row.sessionId as SessionId); setOpen(false) }}
              title={row.sessionId}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 4px',
                cursor: 'pointer', background: 'transparent', border: 0, textAlign: 'left', font: 'inherit',
                color: row.interrupted ? '#d64545' : 'inherit',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flex: 'none',
                background: row.interrupted ? '#d64545' : '#c98a00',
              }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.sessionId}
              </span>
              <span style={{ opacity: 0.7, fontSize: 11, flex: 'none' }}>
                {row.interrupted ? text.interrupted : String(row.kind ?? text.unread)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
