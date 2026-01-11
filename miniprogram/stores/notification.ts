/**
 * 通知状态管理 Store
 * 使用 MobX 实现未读计数和通知列表管理
 * 
 * Requirements: 10.1, 10.2
 */

import { observable, action } from 'mobx-miniprogram';
import { request } from '../services/request';
import type { 
  Notification, 
  NotificationListResult,
  NotificationType,
  UnreadCount,
} from '../types/api';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

// 声明微信小程序全局对象
declare const wx: {
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  showLoading: (options: { title: string; mask?: boolean }) => void;
  hideLoading: () => void;
  setTabBarBadge: (options: { index: number; text: string; success?: () => void; fail?: () => void }) => void;
  removeTabBarBadge: (options: { index: number; success?: () => void; fail?: () => void }) => void;
};

// 通知筛选类型
export type NotificationFilter = 'all' | NotificationType;

// Store 状态接口
interface NotificationStoreState {
  /** 通知列表 */
  notifications: Notification[];
  /** 当前页 */
  page: number;
  /** 是否有更多 */
  hasMore: boolean;
  /** 是否正在加载 */
  loading: boolean;
  /** 总数 */
  total: number;
  
  /** 未读计数 */
  unreadCount: UnreadCount;
  
  /** 当前筛选类型 */
  filter: NotificationFilter;
  
  /** 错误信息 */
  error: string | null;
}

// Store Actions 接口
interface NotificationStoreActions {
  /** 获取总未读数 */
  readonly totalUnread: number;
  /** 是否有未读通知 */
  readonly hasUnread: boolean;
  /** 按类型分组的通知 */
  readonly groupedNotifications: Record<NotificationType, Notification[]>;
  /** 加载通知列表 */
  loadNotifications(reset?: boolean): Promise<void>;
  /** 加载未读计数 */
  loadUnreadCount(): Promise<void>;
  /** 标记单条通知为已读 */
  markAsRead(notificationId: string): Promise<void>;
  /** 标记所有通知为已读 */
  markAllAsRead(): Promise<void>;
  /** 标记某类型通知为已读 */
  markTypeAsRead(type: NotificationType): Promise<void>;
  /** 设置筛选类型 */
  setFilter(filter: NotificationFilter): Promise<void>;
  /** 删除通知 */
  deleteNotification(notificationId: string): Promise<void>;
  /** 更新 TabBar 徽章 */
  updateTabBarBadge(): void;
  /** 清除错误 */
  clearError(): void;
  /** 刷新通知 */
  refresh(): Promise<void>;
}

// 完整 Store 类型
export type NotificationStore = NotificationStoreState & NotificationStoreActions;

/**
 * 通知 Store
 * 管理未读计数和通知列表
 */
export const notificationStore: NotificationStore = observable({
  // ==================== 状态 ====================
  
  /** 通知列表 */
  notifications: [] as Notification[],
  
  /** 当前页 */
  page: 1,
  
  /** 是否有更多 */
  hasMore: true,
  
  /** 是否正在加载 */
  loading: false,
  
  /** 总数 */
  total: 0,
  
  /** 未读计数 */
  unreadCount: {
    total: 0,
    exchange: 0,
    comment: 0,
    like: 0,
    follow: 0,
    system: 0,
  } as UnreadCount,
  
  /** 当前筛选类型 */
  filter: 'all' as NotificationFilter,
  
  /** 错误信息 */
  error: null as string | null,

  // ==================== 计算属性 ====================
  
  /** 获取总未读数 */
  get totalUnread(): number {
    return this.unreadCount.total;
  },
  
  /** 是否有未读通知 */
  get hasUnread(): boolean {
    return this.unreadCount.total > 0;
  },
  
  /** 按类型分组的通知 */
  get groupedNotifications(): Record<NotificationType, Notification[]> {
    const groups: Record<NotificationType, Notification[]> = {
      exchange_request: [],
      exchange_accepted: [],
      exchange_rejected: [],
      comment: [],
      like: [],
      follow: [],
      system: [],
    };
    
    for (const notification of this.notifications) {
      if (groups[notification.type]) {
        groups[notification.type].push(notification);
      }
    }
    
    return groups;
  },

  // ==================== Actions ====================

  /**
   * 加载通知列表
   * 
   * Requirements: 10.2
   */
  loadNotifications: action(async function(this: NotificationStoreState, reset = true): Promise<void> {
    if (this.loading) return;
    if (!reset && !this.hasMore) return;
    
    this.loading = true;
    this.error = null;
    
    if (reset) {
      this.page = 1;
      this.notifications = [];
      this.hasMore = true;
    }
    
    try {
      const params: Record<string, any> = {
        page: this.page,
        page_size: 20,
      };
      
      // 添加类型筛选
      if (this.filter !== 'all') {
        params.type = this.filter;
      }
      
      const result = await request.get<NotificationListResult>('/api/notifications', params);
      
      if (reset) {
        this.notifications = result.notifications;
      } else {
        this.notifications = [...this.notifications, ...result.notifications];
      }
      
      this.total = result.total;
      this.hasMore = result.has_more;
      this.page += 1;
      
      // 同步更新未读计数
      this.unreadCount = {
        ...this.unreadCount,
        total: result.unread_count,
      };
    } catch (err: any) {
      this.error = err?.message || '加载通知失败';
      console.error('Load notifications failed:', err);
    } finally {
      this.loading = false;
    }
  }),

  /**
   * 加载未读计数
   * 
   * Requirements: 10.1
   */
  loadUnreadCount: action(async function(this: NotificationStoreState & NotificationStoreActions): Promise<void> {
    try {
      const count = await request.get<UnreadCount>('/api/notifications/unread-count');
      this.unreadCount = count;
      
      // 更新 TabBar 徽章
      this.updateTabBarBadge();
    } catch (err: any) {
      console.error('Load unread count failed:', err);
    }
  }),

  /**
   * 标记单条通知为已读
   * 
   * Requirements: 10.5
   */
  markAsRead: action(async function(this: NotificationStoreState & NotificationStoreActions, notificationId: string): Promise<void> {
    try {
      await request.post(`/api/notifications/${notificationId}/read`);
      
      // 更新本地状态
      const index = this.notifications.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        const notification = this.notifications[index];
        if (!notification.is_read) {
          // 更新通知状态
          this.notifications = [
            ...this.notifications.slice(0, index),
            { ...notification, is_read: true },
            ...this.notifications.slice(index + 1),
          ];
          
          // 更新未读计数
          this.unreadCount = {
            ...this.unreadCount,
            total: Math.max(0, this.unreadCount.total - 1),
          };
          
          // 更新 TabBar 徽章
          this.updateTabBarBadge();
        }
      }
    } catch (err: any) {
      console.error('Mark as read failed:', err);
    }
  }),

  /**
   * 标记所有通知为已读
   * 
   * Requirements: 10.5
   */
  markAllAsRead: action(async function(this: NotificationStoreState & NotificationStoreActions): Promise<void> {
    try {
      await request.post('/api/notifications/read-all');
      
      // 更新本地状态
      this.notifications = this.notifications.map(n => ({
        ...n,
        is_read: true,
      }));
      
      // 重置未读计数
      this.unreadCount = {
        total: 0,
        exchange: 0,
        comment: 0,
        like: 0,
        follow: 0,
        system: 0,
      };
      
      // 更新 TabBar 徽章
      this.updateTabBarBadge();
      
      wx.showToast({ title: '已全部标记为已读', icon: 'success' });
    } catch (err: any) {
      console.error('Mark all as read failed:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }),

  /**
   * 标记某类型通知为已读
   */
  markTypeAsRead: action(async function(this: NotificationStoreState & NotificationStoreActions, type: NotificationType): Promise<void> {
    try {
      await request.post('/api/notifications/read-type', { type });
      
      // 更新本地状态
      this.notifications = this.notifications.map(n => 
        n.type === type ? { ...n, is_read: true } : n
      );
      
      // 更新该类型的未读计数
      const typeKey = type.replace('_request', '').replace('_accepted', '').replace('_rejected', '') as keyof UnreadCount;
      const typeCount = this.unreadCount[typeKey] || 0;
      
      this.unreadCount = {
        ...this.unreadCount,
        total: Math.max(0, this.unreadCount.total - typeCount),
        [typeKey]: 0,
      };
      
      // 更新 TabBar 徽章
      this.updateTabBarBadge();
    } catch (err: any) {
      console.error('Mark type as read failed:', err);
    }
  }),

  /**
   * 设置筛选类型
   */
  setFilter: action(async function(this: NotificationStoreState & NotificationStoreActions, filter: NotificationFilter): Promise<void> {
    if (this.filter === filter) return;
    
    this.filter = filter;
    await this.loadNotifications(true);
  }),

  /**
   * 删除通知
   */
  deleteNotification: action(async function(this: NotificationStoreState & NotificationStoreActions, notificationId: string): Promise<void> {
    try {
      await request.delete(`/api/notifications/${notificationId}`);
      
      // 从列表中移除
      const notification = this.notifications.find(n => n.id === notificationId);
      this.notifications = this.notifications.filter(n => n.id !== notificationId);
      this.total = Math.max(0, this.total - 1);
      
      // 如果是未读通知，更新未读计数
      if (notification && !notification.is_read) {
        this.unreadCount = {
          ...this.unreadCount,
          total: Math.max(0, this.unreadCount.total - 1),
        };
        this.updateTabBarBadge();
      }
      
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (err: any) {
      console.error('Delete notification failed:', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }),

  /**
   * 更新 TabBar 徽章
   * 在"我的"Tab 上显示未读通知数
   * 
   * Requirements: 10.1
   */
  updateTabBarBadge: action(function(this: NotificationStoreState): void {
    const count = this.unreadCount.total;
    
    // "我的"页面在 TabBar 的索引（根据 app.json 配置）
    // TabBar 顺序: 首页(0), 发现(1), 创建(2), 卡片(3), 我的(4)
    const profileTabIndex = 4;
    
    if (count > 0) {
      const badgeText = count > 99 ? '99+' : String(count);
      wx.setTabBarBadge({
        index: profileTabIndex,
        text: badgeText,
        fail: () => {
          // TabBar 可能不存在（如在非 TabBar 页面）
          console.warn('Failed to set TabBar badge');
        },
      });
    } else {
      wx.removeTabBarBadge({
        index: profileTabIndex,
        fail: () => {
          console.warn('Failed to remove TabBar badge');
        },
      });
    }
  }),

  /**
   * 清除错误
   */
  clearError: action(function(this: NotificationStoreState): void {
    this.error = null;
  }),

  /**
   * 刷新通知
   */
  refresh: action(async function(this: NotificationStoreState & NotificationStoreActions): Promise<void> {
    await Promise.all([
      this.loadNotifications(true),
      this.loadUnreadCount(),
    ]);
  }),
});
