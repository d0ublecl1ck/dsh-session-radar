/**
 * dsh-unread-jump — host entry.
 *
 * The plugin is client-only: the bell, the unread badge, the next-unread jump,
 * and the recent-activity list are all browser concerns, and every fact they read
 * (Session list, Session UI status, Workspace registry) is already shipped by
 * the Web app's host rows. This row therefore exists only so the bundle has a
 * resolvable Node entry and the client roster can discover the browser half
 * through `dsh.client`.
 *
 * @module dsh-unread-jump
 */

/** Stable cordis plugin name (the bundle row's `name` resolves to this package). */
export const name = 'dsh-unread-jump'

/**
 * Mount the host half.
 *
 * Intentionally empty: a host-side behavior here would have to invent a second
 * source of truth for state the Web client already owns.
 */
export function apply(): void {}
