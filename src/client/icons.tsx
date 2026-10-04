/**
 * The plugin's own glyphs: the bell, the six status-metric marks, and the
 * collapsed-rail status mark. The product icon set ships none of them, so this
 * module draws them at the same weight (a 16px current-color outline with a
 * 1px stroke) and the bundle stays free of an icon dependency.
 *
 * @module dsh-unread-helper/client/icons
 */
import type { Metric } from '../count.js'

/**
 * Render the bell outline.
 * @param props.size - requested square edge in pixels.
 * @returns the icon element (decorative; the surrounding button owns the label).
 */
export function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.845 14a1.333 1.333 0 0 0 2.31 0" />
      <path d="M2.175 10.217A.667.667 0 0 0 2.667 11.333h10.666a.667.667 0 0 0 .493-1.115C12.94 9.304 12 8.333 12 5.333A4 4 0 0 0 4 5.333c0 3-.941 3.971-1.825 4.884" />
    </svg>
  )
}

/** Props of one metric glyph. */
export interface MetricIconProps {
  /** Which metric to draw. */
  readonly metric: Metric
  /** Requested square edge in pixels. */
  readonly size?: number
}

/** Shared svg attributes: a 16px grid, current-color stroke, decorative. */
function frame(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
}

/**
 * Render one metric glyph.
 * @param props - metric and requested size.
 * @returns the glyph element (decorative; the surrounding surface owns the label).
 */
export function MetricIcon({ metric, size = 13 }: MetricIconProps) {
  if (metric === 'running') {
    return (
      <svg {...frame(size)}>
        <path d="M5.4 3.6 12.2 8l-6.8 4.4z" />
      </svg>
    )
  }
  if (metric === 'unread') {
    return (
      <svg {...frame(size)}>
        <circle cx="8" cy="8" r="5" />
        <circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (metric === 'pending') {
    return (
      <svg {...frame(size)}>
        <circle cx="8" cy="8" r="5.2" />
        <path d="M8 5.1v3.1" />
        <path d="M8 10.6h.01" />
      </svg>
    )
  }
  if (metric === 'idle') {
    return (
      <svg {...frame(size)}>
        <path d="M9.9 2.9a5.7 5.7 0 1 0 3.2 8.9 4.6 4.6 0 0 1-3.2-8.9z" />
      </svg>
    )
  }
  if (metric === 'unarchived') {
    return (
      <svg {...frame(size)}>
        <path d="M2.6 9.1 4.3 4.2a1 1 0 0 1 .94-.68h5.52a1 1 0 0 1 .94.68l1.7 4.9" />
        <path d="M2.6 9.1h3.1l.65 1.5h3.3l.65-1.5h3.1v3a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1z" />
      </svg>
    )
  }
  return (
    <svg {...frame(size)}>
      <path d="M2.1 3.3h11.8v2.2H2.1z" />
      <path d="M3 5.5h10v6.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M6.4 8.7h3.2" />
    </svg>
  )
}

/**
 * The status readout's generic mark, used in the collapsed rail.
 * @param props - requested square edge in pixels.
 * @returns the glyph element (decorative).
 */
export function WatchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...frame(size)}>
      <circle cx="8" cy="8" r="5.4" />
      <path d="M8 5.4V8l1.9 1.2" />
    </svg>
  )
}

