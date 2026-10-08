/**
 * `session-radar` dictionaries. Simplified Chinese is the source of truth for
 * the key set; English mirrors it one-to-one. The namespace carries every half
 * of the plugin: the bell/activity copy, the waiting window's copy, and the
 * status readout's copy.
 *
 * @module dsh-session-radar/client/locales
 */
/** Simplified Chinese dictionary. */
export declare const zh: {
    'bell.show': string;
    'bell.hide': string;
    'bell.showUnread': string;
    'bell.noUnread': string;
    'bell.jumpAsk': string;
    'bell.noAsk': string;
    'bell.pending': string;
    'bell.openActivity': string;
    'panel.aria': string;
    'panel.empty': string;
    'overview.open': string;
    'overview.noWaiting': string;
    'overview.aria': string;
    'overview.title': string;
    'overview.counts': string;
    'overview.zone.ask': string;
    'overview.zone.unread': string;
    'overview.zoneEmpty': string;
    'overview.hint': string;
    'overview.close': string;
    'overview.empty': string;
    'retry.aria': string;
    'retry.title': string;
    'retry.intro': string;
    'retry.selectAll': string;
    'retry.selectNone': string;
    'retry.send': string;
    'retry.later': string;
    'retry.running': string;
    'retry.failed': string;
    'retry.unavailable': string;
    'retry.continueMessage': string;
    'attention.approval': string;
    'attention.planReview': string;
    'attention.question': string;
    'when.now': string;
    'when.minutes': string;
    'when.hours': string;
    'when.days': string;
    'row.untitled': string;
    'row.unread': string;
    'row.markedUnread': string;
    'row.running': string;
    'row.attention': string;
    'row.pinned': string;
    'action.pin': string;
    'action.unpin': string;
    'action.archive': string;
    'action.archiveFailed': string;
    'day.today': string;
    'day.yesterday': string;
    'day.sun': string;
    'day.mon': string;
    'day.tue': string;
    'day.wed': string;
    'day.thu': string;
    'day.fri': string;
    'day.sat': string;
    'day.date': string;
    'day.dateYear': string;
    'metric.running': string;
    'metric.unread': string;
    'metric.pending': string;
    'metric.idle': string;
    'metric.unarchived': string;
    'metric.archived': string;
    'watch.aria': string;
    'watch.summaryItem': string;
    'watch.summaryJoin': string;
    'watch.railHint': string;
    'watch.warn': string;
    'watch.empty': string;
    'row.title': string;
    'row.description': string;
    'row.showLabel': string;
    'row.variantLabel': string;
    'row.variant.chips': string;
    'row.variant.meter': string;
    'row.thresholdLabel': string;
    'row.thresholdHint': string;
    'row.inputLabel': string;
    'row.badgeLabel': string;
    'row.saveFailed': string;
};
/** Every key this namespace owns. */
export type SessionRadarKey = keyof typeof zh;
/** English dictionary; the key set is fixed by the Chinese source of truth. */
export declare const en: Record<SessionRadarKey, string>;
