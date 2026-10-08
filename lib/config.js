/**
 * Shared preference vocabulary for the status readout.
 *
 * The host Config schema, the browser config source, and the Settings row all
 * read the same metric list, variants, and defaults from here, so adding a
 * metric never means editing three field maps by hand.
 *
 * @module dsh-session-radar/config
 */
import { METRICS } from './count.js';
/** Namespace row id; also the Settings namespace and both slot entry ids. */
export const PLUGIN_ID = 'session-radar';
/** Config field name per metric. */
export const METRIC_FIELD = {
    running: 'showRunning',
    unread: 'showUnread',
    pending: 'showPending',
    idle: 'showIdle',
    unarchived: 'showUnarchived',
    archived: 'showArchived',
};
/** Config field name of the Session row badge. */
export const ROW_BADGE_FIELD = 'showRowBadge';
/** The row badge ships on; turning it off never touches the official dots. */
export const DEFAULT_ROW_BADGE = true;
/**
 * Read the row-badge preference off a raw config value.
 *
 * Only an explicit boolean counts; anything else keeps the shipped default, so
 * a hand-edited profile patch never silently drops the reminders.
 *
 * @param value - raw config value.
 * @returns whether the durable row badge is enabled.
 */
export function normalizeRowBadge(value) {
    return typeof value === 'boolean' ? value : DEFAULT_ROW_BADGE;
}
/** Every metric ships visible; the operator hides what they do not want. */
export const DEFAULT_VISIBILITY = {
    running: true,
    unread: true,
    pending: true,
    idle: true,
    unarchived: true,
    archived: true,
};
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
export function normalizeVisibility(value) {
    const source = (value ?? {});
    const result = {};
    for (const metric of METRICS) {
        const raw = source[METRIC_FIELD[metric]];
        result[metric] = typeof raw === 'boolean' ? raw : DEFAULT_VISIBILITY[metric];
    }
    return result;
}
/** The layout families the readout can use, in Settings order. */
export const VARIANTS = ['chips', 'meter'];
/** The layout shown when the profile supplies none. */
export const DEFAULT_VARIANT = 'chips';
/**
 * Normalize a configured variant.
 * @param value - raw config value.
 * @returns a known variant, or the shipped default.
 */
export function normalizeVariant(value) {
    const candidate = String(value ?? '');
    return VARIANTS.includes(candidate) ? candidate : DEFAULT_VARIANT;
}
/**
 * The metrics a readout renders, in display order.
 * @param visibility - per-metric visibility.
 * @returns the visible metric keys.
 */
export function visibleMetrics(visibility) {
    return METRICS.filter((metric) => visibility[metric]);
}
//# sourceMappingURL=config.js.map