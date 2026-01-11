/**
 * 通知页面
 * 显示分组通知列表
 * 
 * Requirements: 10.2, 10.3
 */

import { notificationStore, NotificationFilter } from '../../stores/notification';
import { formatRelativeTime } from '../../utils/format';
import type { Notification, NotificationType } from '../../types/api';

// 声明微信小程序全局对象
declare const wx: {
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  showModal: (options: { 
    title: string; 
    content: string; 
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    success?: (res: { confirm: boolean; cancel: boolean }) => void;
  }) => void;
  stopPullDownRefresh: () => void;
  navigateTo: (options: { url: string }) => void;
  showActionSheet: (options: {
    itemList: string[];
    success?: (res: { tapIndex: number }) => void;
    fail?: () => void;
  }) => void;
};

// 通知分组
interface NotificationGroup {
  type: NotificationType;
  title: string;
  icon: string;
  notifications: FormattedNotification[];
  unreadCount: number;
}

// 格式化后的通知
interface FormattedNotification extends Notification {
  formattedTime: string;
  typeIcon: string;
  typeLabel: string;
}

// 筛选选项
interface FilterOption {
  value: NotificationFilter;
  label: string;
}

// 页面数据接口
interface PageData {
  /** 当前筛选类型 */
  activeFilter: NotificationFilter;
  /** 筛选选项 */
  filterOptions: FilterOption[];
  /** 分组后的通知列表 */
  groupedNotifications: NotificationGroup[];
  /** 扁平通知列表（筛选后） */
  notifications: FormattedNotification[];
  /** 是否正在加载 */
  loading: boolean;
  /** 是否有更多 */
  hasMore: boolean;
  /** 总未读数 */
  totalUnread: number;
  /** 是否显示分组视图 */
  showGroupView: boolean;
}

Page({
  data: {
    activeFilter: 'all' as NotificationFilter,
    activeFilterLabel: '' as string,
    filterOptions: [
      { value: 'all', label: '全部' },
      { value: 'exchange_request', label: '交换请求' },
      { value: 'exchange_accepted', label: '交换成功' },
      { value: 'comment', label: '评论' },
      { value: 'like', label: '点赞' },
      { value: 'follow', label: '关注' },
      { value: 'system', label: '系统' },
    ] as FilterOption[],
    groupedNotifications: [] as NotificationGroup[],
    notifications: [] as FormattedNotification[],
    loading: false,
    hasMore: true,
    totalUnread: 0,
    showGroupView: true,
  } as PageData,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadNotifications(true);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时刷新未读计数
    this.updateUnreadCount();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadNotifications(true).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadNotifications(false);
    }
  },

  /**
   * 加载通知列表
   * Requirements: 10.2
   */
  async loadNotifications(reset: boolean = true): Promise<void> {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      await notificationStore.loadNotifications(reset);
      
      // 格式化通知数据
      const formattedNotifications = this.formatNotifications(notificationStore.notifications);
      
      // 根据视图模式处理数据
      if (this.data.showGroupView && this.data.activeFilter === 'all') {
        // 分组视图
        const groupedNotifications = this.groupNotificationsByType(formattedNotifications);
        this.setData({
          groupedNotifications,
          notifications: formattedNotifications,
          hasMore: notificationStore.hasMore,
          totalUnread: notificationStore.totalUnread,
        });
      } else {
        // 列表视图
        this.setData({
          notifications: formattedNotifications,
          hasMore: notificationStore.hasMore,
          totalUnread: notificationStore.totalUnread,
        });
      }
    } catch (error) {
      console.error('Load notifications failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 格式化通知列表
   */
  formatNotifications(notifications: Notification[]): FormattedNotification[] {
    return notifications.map(notification => ({
      ...notification,
      formattedTime: formatRelativeTime(new Date(notification.created_at)),
      typeIcon: this.getTypeIcon(notification.type),
      typeLabel: this.getTypeLabel(notification.type),
    }));
  },

  /**
   * 按类型分组通知
   * Requirements: 10.3
   */
  groupNotificationsByType(notifications: FormattedNotification[]): NotificationGroup[] {
    // 定义分组顺序和配置
    const groupConfig: Array<{ type: NotificationType; title: string; icon: string }> = [
      { type: 'exchange_request', title: '交换请求', icon: '🔄' },
      { type: 'exchange_accepted', title: '交换成功', icon: '✅' },
      { type: 'exchange_rejected', title: '交换被拒', icon: '❌' },
      { type: 'comment', title: '评论', icon: '💬' },
      { type: 'like', title: '点赞', icon: '❤️' },
      { type: 'follow', title: '关注', icon: '👤' },
      { type: 'system', title: '系统通知', icon: '📢' },
    ];

    const groups: NotificationGroup[] = [];

    for (const config of groupConfig) {
      const groupNotifications = notifications.filter(n => n.type === config.type);
      
      if (groupNotifications.length > 0) {
        // 按时间降序排序
        groupNotifications.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        const unreadCount = groupNotifications.filter(n => !n.is_read).length;
        
        groups.push({
          type: config.type,
          title: config.title,
          icon: config.icon,
          notifications: groupNotifications,
          unreadCount,
        });
      }
    }

    return groups;
  },

  /**
   * 获取通知类型图标
   */
  getTypeIcon(type: NotificationType): string {
    const iconMap: Record<NotificationType, string> = {
      exchange_request: '🔄',
      exchange_accepted: '✅',
      exchange_rejected: '❌',
      comment: '💬',
      like: '❤️',
      follow: '👤',
      system: '📢',
    };
    return iconMap[type] || '📌';
  },

  /**
   * 获取通知类型标签
   */
  getTypeLabel(type: NotificationType): string {
    const labelMap: Record<NotificationType, string> = {
      exchange_request: '交换请求',
      exchange_accepted: '交换成功',
      exchange_rejected: '交换被拒',
      comment: '评论',
      like: '点赞',
      follow: '关注',
      system: '系统通知',
    };
    return labelMap[type] || '通知';
  },

  /**
   * 更新未读计数
   */
  async updateUnreadCount(): Promise<void> {
    try {
      await notificationStore.loadUnreadCount();
      this.setData({ totalUnread: notificationStore.totalUnread });
    } catch (error) {
      console.error('Update unread count failed:', error);
    }
  },

  /**
   * 切换筛选类型
   */
  async onFilterChange(e: WechatMiniprogram.TouchEvent): Promise<void> {
    const filter = e.currentTarget.dataset.filter as NotificationFilter;
    
    if (filter === this.data.activeFilter) return;
    
    // 计算筛选标签
    const filterOption = this.data.filterOptions.find(f => f.value === filter);
    const activeFilterLabel = filter === 'all' ? '' : (filterOption?.label || '');
    
    this.setData({ 
      activeFilter: filter,
      activeFilterLabel,
      showGroupView: filter === 'all',
    });
    
    await notificationStore.setFilter(filter);
    await this.loadNotifications(true);
  },

  /**
   * 切换视图模式
   */
  onToggleView(): void {
    this.setData({ 
      showGroupView: !this.data.showGroupView,
    });
    
    if (this.data.showGroupView) {
      // 重新分组
      const groupedNotifications = this.groupNotificationsByType(this.data.notifications);
      this.setData({ groupedNotifications });
    }
  },

  /**
   * 点击通知
   * Requirements: 10.4
   */
  async onNotificationTap(e: WechatMiniprogram.TouchEvent): Promise<void> {
    const notificationId = e.currentTarget.dataset.id as string;
    const notification = this.data.notifications.find(n => n.id === notificationId);
    
    if (!notification) return;

    // 标记为已读
    if (!notification.is_read) {
      await notificationStore.markAsRead(notificationId);
      
      // 更新本地状态
      this.updateNotificationReadStatus(notificationId);
    }

    // 检查是否可以跳转
    if (this.isNotificationNavigable(notification)) {
      // 跳转到相关内容
      this.navigateToRelatedContent(notification);
    }
  },

  /**
   * 检查通知是否可以跳转
   * 用于判断通知是否有有效的跳转目标
   */
  isNotificationNavigable(notification: Notification): boolean {
    // 如果有明确的 related_type 和 related_id，可以跳转
    if (notification.related_type && notification.related_id) {
      return true;
    }

    // 根据通知类型判断
    switch (notification.type) {
      case 'exchange_request':
      case 'exchange_accepted':
      case 'exchange_rejected':
        // 交换相关通知总是可以跳转到交换管理页
        return true;
        
      case 'comment':
      case 'like':
        // 评论和点赞需要有 related_id
        return !!notification.related_id;
        
      case 'follow':
        // 关注通知需要有 sender_id
        return !!notification.sender_id;
        
      case 'system':
        // 系统通知需要有 related_id 和有效的 related_type
        return !!(notification.related_id && 
          (notification.related_type === 'card' || notification.related_type === 'user'));
        
      default:
        return false;
    }
  },

  /**
   * 更新通知已读状态
   */
  updateNotificationReadStatus(notificationId: string): void {
    const notifications = this.data.notifications.map(n => 
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    
    // 更新分组数据
    const groupedNotifications = this.data.groupedNotifications.map(group => ({
      ...group,
      notifications: group.notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: group.notifications.filter(n => 
        n.id === notificationId ? false : !n.is_read
      ).length,
    }));
    
    this.setData({
      notifications,
      groupedNotifications,
      totalUnread: Math.max(0, this.data.totalUnread - 1),
    });
  },

  /**
   * 跳转到相关内容
   * Requirements: 10.4
   * 
   * 根据通知类型和关联内容跳转到相应页面：
   * - exchange_request/exchange_accepted/exchange_rejected → 交换管理页
   * - comment → 卡片详情页（评论所在的卡片）
   * - like → 卡片详情页（被点赞的卡片）
   * - follow → 关注者的用户主页
   * - system → 根据 related_type 跳转或不跳转
   */
  navigateToRelatedContent(notification: Notification): void {
    // 首先根据 related_type 处理（如果有明确的关联类型）
    if (notification.related_type && notification.related_id) {
      switch (notification.related_type) {
        case 'card':
          wx.navigateTo({ 
            url: `/pages/card-detail/card-detail?id=${notification.related_id}` 
          });
          return;
        case 'user':
          wx.navigateTo({ 
            url: `/pages/user-profile/user-profile?id=${notification.related_id}` 
          });
          return;
        case 'exchange':
          wx.navigateTo({ 
            url: '/pages/exchange/exchange' 
          });
          return;
        case 'comment':
          // 评论通知跳转到卡片详情
          wx.navigateTo({ 
            url: `/pages/card-detail/card-detail?id=${notification.related_id}` 
          });
          return;
      }
    }

    // 如果没有 related_type，根据通知类型判断跳转
    switch (notification.type) {
      case 'exchange_request':
      case 'exchange_accepted':
      case 'exchange_rejected':
        // 交换相关通知跳转到交换管理页
        wx.navigateTo({ 
          url: '/pages/exchange/exchange' 
        });
        break;
        
      case 'comment':
        // 评论通知：如果有 related_id，跳转到卡片详情
        if (notification.related_id) {
          wx.navigateTo({ 
            url: `/pages/card-detail/card-detail?id=${notification.related_id}` 
          });
        }
        break;
        
      case 'like':
        // 点赞通知：跳转到被点赞的卡片详情
        if (notification.related_id) {
          wx.navigateTo({ 
            url: `/pages/card-detail/card-detail?id=${notification.related_id}` 
          });
        }
        break;
        
      case 'follow':
        // 关注通知：跳转到关注者的用户主页
        if (notification.sender_id) {
          wx.navigateTo({ 
            url: `/pages/user-profile/user-profile?id=${notification.sender_id}` 
          });
        }
        break;
        
      case 'system':
        // 系统通知：根据 related_id 和 related_type 判断
        // 如果没有关联内容，则不跳转
        if (notification.related_id && notification.related_type === 'card') {
          wx.navigateTo({ 
            url: `/pages/card-detail/card-detail?id=${notification.related_id}` 
          });
        } else if (notification.related_id && notification.related_type === 'user') {
          wx.navigateTo({ 
            url: `/pages/user-profile/user-profile?id=${notification.related_id}` 
          });
        }
        // 其他系统通知不跳转
        break;
        
      default:
        // 未知类型，不跳转
        console.warn('Unknown notification type:', notification.type);
        break;
    }
  },

  /**
   * 长按通知显示操作菜单
   */
  onNotificationLongPress(e: WechatMiniprogram.TouchEvent): void {
    const notificationId = e.currentTarget.dataset.id as string;
    const notification = this.data.notifications.find(n => n.id === notificationId);
    
    if (!notification) return;

    const itemList = notification.is_read 
      ? ['删除'] 
      : ['标记为已读', '删除'];

    wx.showActionSheet({
      itemList,
      success: async (res) => {
        if (notification.is_read) {
          // 只有删除选项
          if (res.tapIndex === 0) {
            await this.deleteNotification(notificationId);
          }
        } else {
          // 有标记已读和删除选项
          if (res.tapIndex === 0) {
            await notificationStore.markAsRead(notificationId);
            this.updateNotificationReadStatus(notificationId);
          } else if (res.tapIndex === 1) {
            await this.deleteNotification(notificationId);
          }
        }
      },
    });
  },

  /**
   * 删除通知
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await notificationStore.deleteNotification(notificationId);
      
      // 更新本地状态
      const notifications = this.data.notifications.filter(n => n.id !== notificationId);
      const groupedNotifications = this.data.groupedNotifications.map(group => ({
        ...group,
        notifications: group.notifications.filter(n => n.id !== notificationId),
        unreadCount: group.notifications.filter(n => 
          n.id !== notificationId && !n.is_read
        ).length,
      })).filter(group => group.notifications.length > 0);
      
      this.setData({
        notifications,
        groupedNotifications,
      });
    } catch (error) {
      console.error('Delete notification failed:', error);
    }
  },

  /**
   * 全部标记为已读
   * Requirements: 10.5
   */
  onMarkAllRead(): void {
    if (this.data.totalUnread === 0) {
      wx.showToast({ title: '没有未读通知', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认',
      content: '确定要将所有通知标记为已读吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          await notificationStore.markAllAsRead();
          
          // 更新本地状态
          const notifications = this.data.notifications.map(n => ({ ...n, is_read: true }));
          const groupedNotifications = this.data.groupedNotifications.map(group => ({
            ...group,
            notifications: group.notifications.map(n => ({ ...n, is_read: true })),
            unreadCount: 0,
          }));
          
          this.setData({
            notifications,
            groupedNotifications,
            totalUnread: 0,
          });
        }
      },
    });
  },

  /**
   * 点击分组标题展开/收起
   */
  onGroupTap(e: WechatMiniprogram.TouchEvent): void {
    const groupType = e.currentTarget.dataset.type as NotificationType;
    
    // 切换到该类型的筛选
    this.setData({ 
      activeFilter: groupType as NotificationFilter,
      showGroupView: false,
    });
    
    notificationStore.setFilter(groupType as NotificationFilter);
    this.loadNotifications(true);
  },

  /**
   * 跳转到用户主页
   */
  onSenderTap(e: WechatMiniprogram.TouchEvent): void {
    const senderId = e.currentTarget.dataset.senderId as string;
    if (senderId) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?id=${senderId}`,
      });
    }
  },
});
