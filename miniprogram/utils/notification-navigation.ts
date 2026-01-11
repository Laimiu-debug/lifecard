/**
 * 通知导航工具
 * 处理通知点击跳转到相关内容
 * 
 * Requirements: 10.4
 */

import type { Notification, NotificationType } from '../types/api';

// 声明微信小程序全局对象
declare const wx: {
  navigateTo: (options: { url: string; fail?: (err: unknown) => void }) => void;
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none' }) => void;
};

/**
 * 导航目标类型
 */
export interface NavigationTarget {
  /** 目标页面路径 */
  url: string;
  /** 目标类型描述 */
  type: 'card' | 'user' | 'exchange' | 'none';
}

/**
 * 根据通知获取导航目标
 * 
 * @param notification - 通知对象
 * @returns 导航目标信息，如果无法导航则返回 null
 */
export function getNavigationTarget(notification: Notification): NavigationTarget | null {
  // 首先根据 related_type 处理（如果有明确的关联类型）
  if (notification.related_type && notification.related_id) {
    switch (notification.related_type) {
      case 'card':
        return {
          url: `/pages/card-detail/card-detail?id=${notification.related_id}`,
          type: 'card',
        };
      case 'user':
        return {
          url: `/pages/user-profile/user-profile?id=${notification.related_id}`,
          type: 'user',
        };
      case 'exchange':
        return {
          url: '/pages/exchange/exchange',
          type: 'exchange',
        };
      case 'comment':
        // 评论通知跳转到卡片详情
        return {
          url: `/pages/card-detail/card-detail?id=${notification.related_id}`,
          type: 'card',
        };
    }
  }

  // 如果没有 related_type，根据通知类型判断跳转
  switch (notification.type) {
    case 'exchange_request':
    case 'exchange_accepted':
    case 'exchange_rejected':
      // 交换相关通知跳转到交换管理页
      return {
        url: '/pages/exchange/exchange',
        type: 'exchange',
      };
      
    case 'comment':
      // 评论通知：如果有 related_id，跳转到卡片详情
      if (notification.related_id) {
        return {
          url: `/pages/card-detail/card-detail?id=${notification.related_id}`,
          type: 'card',
        };
      }
      break;
      
    case 'like':
      // 点赞通知：跳转到被点赞的卡片详情
      if (notification.related_id) {
        return {
          url: `/pages/card-detail/card-detail?id=${notification.related_id}`,
          type: 'card',
        };
      }
      break;
      
    case 'follow':
      // 关注通知：跳转到关注者的用户主页
      if (notification.sender_id) {
        return {
          url: `/pages/user-profile/user-profile?id=${notification.sender_id}`,
          type: 'user',
        };
      }
      break;
      
    case 'system':
      // 系统通知：根据 related_id 和 related_type 判断
      if (notification.related_id && notification.related_type === 'card') {
        return {
          url: `/pages/card-detail/card-detail?id=${notification.related_id}`,
          type: 'card',
        };
      } else if (notification.related_id && notification.related_type === 'user') {
        return {
          url: `/pages/user-profile/user-profile?id=${notification.related_id}`,
          type: 'user',
        };
      }
      break;
  }

  return null;
}

/**
 * 检查通知是否可以导航
 * 
 * @param notification - 通知对象
 * @returns 是否可以导航
 */
export function isNotificationNavigable(notification: Notification): boolean {
  return getNavigationTarget(notification) !== null;
}

/**
 * 导航到通知相关内容
 * 
 * @param notification - 通知对象
 * @returns 是否成功导航
 */
export function navigateToNotificationContent(notification: Notification): boolean {
  const target = getNavigationTarget(notification);
  
  if (!target) {
    console.warn('Cannot navigate: no valid target for notification', notification.id);
    return false;
  }

  wx.navigateTo({
    url: target.url,
    fail: (err) => {
      console.error('Navigation failed:', err);
      wx.showToast({ title: '跳转失败', icon: 'none' });
    },
  });

  return true;
}

/**
 * 根据通知类型获取默认导航目标
 * 用于没有 related_id 的情况
 * 
 * @param type - 通知类型
 * @returns 默认导航目标，如果没有默认目标则返回 null
 */
export function getDefaultNavigationForType(type: NotificationType): NavigationTarget | null {
  switch (type) {
    case 'exchange_request':
    case 'exchange_accepted':
    case 'exchange_rejected':
      return {
        url: '/pages/exchange/exchange',
        type: 'exchange',
      };
    default:
      return null;
  }
}
