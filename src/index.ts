/**
 * dsh-session-radar — host entry.
 *
 * The host half owns two things the browser half cannot: the cross-restart
 * ledger (behavior in `src/host.ts`, routed over the plugin's own
 * authenticated webServer path) and the plugin's preference surface — the
 * unarchived warning threshold, the readout layout, and one visibility switch
 * per metric, declared here as volatile Config fields. dsh-settings projects
 * exactly those fields into the Settings namespace named by this row's id
 * (`session-radar`), which is what the merged client readout and its
 * settings row read and write. Counting itself stays in the browser: every
 * number is derived from the snapshots the shell already publishes.
 *
 * @module dsh-session-radar
 */
import z from '@deepseek-ai/schemastery'
import { DEFAULT_VARIANT, DEFAULT_VISIBILITY } from './config.js'
import { DEFAULT_THRESHOLD } from './count.js'
import { mount } from './host.js'

/** Stable cordis plugin name (the bundle row's `name` resolves to this package). */
export const name = 'session-radar'

/** The browser reaches this half through an authenticated webServer route. */
export const inject = ['webServer', 'connection']

/** The plugin's preference surface: what the readout shows, and when unarchived is too many. */
export interface Config {
  /** Warn once the unarchived Session count exceeds this value. */
  threshold: number
  /** Layout family used by the sidebar readout. */
  variant: string
  /** Whether the running metric appears in the readout. */
  showRunning: boolean
  /** Whether the unread metric appears in the readout. */
  showUnread: boolean
  /** Whether the pending metric appears in the readout. */
  showPending: boolean
  /** Whether the idle metric appears in the readout. */
  showIdle: boolean
  /** Whether the unarchived metric appears in the readout. */
  showUnarchived: boolean
  /** Whether the archived metric appears in the readout. */
  showArchived: boolean
}

/**
 * Row config. volatile is what makes a field live-editable from the Settings
 * page: dsh-settings only projects volatile fields into a namespace.
 */
export const Config = z.object({
  threshold: z.number().step(1).min(1).default(DEFAULT_THRESHOLD).volatile(),
  variant: z.string().default(DEFAULT_VARIANT).volatile(),
  showRunning: z.boolean().default(DEFAULT_VISIBILITY.running).volatile(),
  showUnread: z.boolean().default(DEFAULT_VISIBILITY.unread).volatile(),
  showPending: z.boolean().default(DEFAULT_VISIBILITY.pending).volatile(),
  showIdle: z.boolean().default(DEFAULT_VISIBILITY.idle).volatile(),
  showUnarchived: z.boolean().default(DEFAULT_VISIBILITY.unarchived).volatile(),
  showArchived: z.boolean().default(DEFAULT_VISIBILITY.archived).volatile(),
})

/**
 * Mount the host half: the cross-restart ledger, its persistence, and the
 * Remote calls the browser half makes. The Config schema above is read by the
 * settings provider; this function performs no counting.
 *
 * @param ctx - host cordis context.
 */
export function apply(ctx: unknown): void {
  mount(ctx)
}
