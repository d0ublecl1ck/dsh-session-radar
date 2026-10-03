/**
 * `unread-helper` dictionaries. Simplified Chinese is the source of truth for
 * the key set; English mirrors it one-to-one.
 *
 * @module dsh-unread-helper/client/locales
 */

/** Simplified Chinese dictionary. */
export const zh = {
  'bell.show': '定位下一个未读',
  'bell.hide': '打开最近活动',
  'bell.showUnread': '定位下一个未读，{count} 个会话已完成未查看',
  'bell.noUnread': '没有未读会话',
  'bell.jumpAsk': '定位等待处理',
  'bell.noAsk': '没有等待处理的会话',
  'bell.pending': '等待你处理 {count} 个',
  'bell.openActivity': '右键：打开最近活动列表',
  'panel.aria': '最近活动',
  'panel.empty': '还没有会话活动。',
  'row.untitled': '未命名会话',
  'row.unread': '已完成未查看',
  'row.markedUnread': '标为未读',
  'row.running': '运行中',
  'row.attention': '等待你处理',
  'row.pinned': '已置顶',
  'action.pin': '置顶',
  'action.unpin': '取消置顶',
  'action.archive': '归档',
  'action.archiveFailed': '归档失败：该会话还有运行中的工作',
  'day.today': '今天',
  'day.yesterday': '昨天',
  'day.sun': '星期日',
  'day.mon': '星期一',
  'day.tue': '星期二',
  'day.wed': '星期三',
  'day.thu': '星期四',
  'day.fri': '星期五',
  'day.sat': '星期六',
  'day.date': '{month}月{day}日',
  'day.dateYear': '{year}年{month}月{day}日',
}

/** Every key this namespace owns. */
export type ActivityBellKey = keyof typeof zh

/** English dictionary; the key set is fixed by the Chinese source of truth. */
export const en: Record<ActivityBellKey, string> = {
  'bell.show': 'Jump to next unread',
  'bell.hide': 'Open recent activity',
  'bell.showUnread': 'Jump to next unread, {count} sessions finished unviewed',
  'bell.noUnread': 'No unread sessions',
  'bell.jumpAsk': 'Jump to pending ask',
  'bell.noAsk': 'No pending asks',
  'bell.pending': 'Waiting on you in {count}',
  'bell.openActivity': 'Right-click: recent activity list',
  'panel.aria': 'Recent activity',
  'panel.empty': 'No session activity yet.',
  'row.untitled': 'Untitled session',
  'row.unread': 'Finished, unviewed',
  'row.markedUnread': 'Marked unread',
  'row.running': 'Running',
  'row.attention': 'Waiting for you',
  'row.pinned': 'Pinned',
  'action.pin': 'Pin',
  'action.unpin': 'Unpin',
  'action.archive': 'Archive',
  'action.archiveFailed': 'Archive failed: this session still has running work',
  'day.today': 'Today',
  'day.yesterday': 'Yesterday',
  'day.sun': 'Sunday',
  'day.mon': 'Monday',
  'day.tue': 'Tuesday',
  'day.wed': 'Wednesday',
  'day.thu': 'Thursday',
  'day.fri': 'Friday',
  'day.sat': 'Saturday',
  'day.date': '{month}/{day}',
  'day.dateYear': '{year}/{month}/{day}',
}
