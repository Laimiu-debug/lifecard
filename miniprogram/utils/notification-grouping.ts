/**
 * 通知分组工具函数
 * Life Card 微信小程序
 * 
 * Requirements: 10.3
 */

import type { Notification, NotificationType } from '../types/api';

// 通知分组配置
export interface NotificationGroupConfig {
  type: NotificationType;
  title: string;
  icon: string;
}

// 通知分组结果
export interface NotificationGroup {
  type: NotificationType;
  title: string;
  icon: string;
  notifications: Notification[];
  unreadCount: number;
}

// 所有通知类型
export const NOTIFICATION_TYPES: NotificationType[] = [
  'exchange_request',
  'exchange_accepted',
  'exchange_rejected',
  'comment',
  'like',
  'follow',
  'system',
];

// 分组配置（定义分组顺序）
export const GROUP_CONFIG: NotificationGroupConfig[] = [
  { type: 'exchange_request', title: '交换请求', icon: '🔄' },
  { type: 'exchange_accepted', title: '交换成功', icon: '✅' },
  { type: 'exchange_rejected', title: '交换被拒', icon: '❌' },
  { type: 'comment', title: '评论', icon: '💬' },
  { type: 'like', title: '点赞', icon: '❤️' },
  { type: 'follow', title: '关注', icon: '👤' },
  { type: 'system', title: '系统通知', icon: '📢' },
];

// 类型标签映射
export const TYPE_LABELS: Record<NotificationType, string> = {
  exchange_request: '交换请求',
  exchange_accepted: '交换成功',
  exchange_rejected: '交换被拒',
  comment: '评论',
  like: '点赞',
  follow: '关注',
  system: '系统通知',
};

// 类型图标映射
export const TYPE_ICONS: Record<NotificationType, string> = {
  exchange_request: '🔄',
  exchange_accepted: '✅',
  exchange_rejected: '❌',
  comment: '💬',
  like: '❤️',
  follow: '👤',
  system: '📢',
};

/**
 * 按类型分组通知
 * 
 * Requirements: 10.3
 * - Notifications SHALL be grouped by type (exchange, comment, like)
 * - Within each group, notifications SHALL be sorted by timestamp descending
 * 
 * @param notifications - 通知列表
 * @returns 分组后的通知列表
 */
export function groupNotificationsByType(notifications: Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];

  for (const config of GROUP_CONFIG) {
    const groupNotifications = notifications.filter(n => n.type === config.type);
    
    if (groupNotifications.length > 0) {
      // 按时间降序排序
      const sortedNotifications = [...groupNotifications].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const unreadCount = sortedNotifications.filter(n => !n.is_read).length;
      
      groups.push({
        type: config.type,
        title: config.title,
        icon: config.icon,
        notifications: sortedNotifications,
        unreadCount,
      });
    }
  }

  return groups;
}

/**
 * 获取通知类型标签
 * 
 * @param type - 通知类型
 * @returns 类型标签
 */
export function getTypeLabel(type: NotificationType): string {
  return TYPE_LABELS[type] || '通知';
}

/**
 * 获取通知类型图标
 * 
 * @param type - 通知类型
 * @returns 类型图标
 */
export function getTypeIcon(type: NotificationType): string {
  return TYPE_ICONS[type] || '📌';
}

/**
 * 检查通知是否在正确的分组中
 * 
 * @param notification - 通知
 * @param groupType - 分组类型
 * @returns 是否匹配
 */
export function isNotificationInCorrectGroup(
  notification: Notification, 
  groupType: NotificationType
): boolean {
  return notification.type === groupType;
}

/**
 * 检查分组内通知是否按时间降序排序
 * 
 * @param notifications - 通知列表
 * @returns 是否按时间降序排序
 */
export function isNotificationsSortedDescending(notifications: Notification[]): boolean {
  for (let i = 0; i < notifications.length - 1; i++) {
    const currentTime = new Date(notifications[i].created_at).getTime();
    const nextTime = new Date(notifications[i + 1].created_at).getTime();
    if (currentTime < nextTime) {
      return false;
    }
  }
  return true;
}
