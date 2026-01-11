/**
 * 交换管理页面
 * 显示待处理和已发送请求
 * 
 * Requirements: 7.5, 7.6, 7.7
 */

import { exchangeStore } from '../../stores/exchange';
import { userStore } from '../../stores/user';
import { formatRelativeTime } from '../../utils/format';
import type { ExchangeRequest } from '../../types/exchange';

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
};

// Tab 类型
type TabType = 'received' | 'sent';

// 页面数据接口
interface PageData {
  activeTab: TabType;
  pendingRequests: ExchangeRequest[];
  sentRequests: ExchangeRequest[];
  pendingLoading: boolean;
  sentLoading: boolean;
  pendingTotal: number;
  sentTotal: number;
}

Page({
  data: {
    activeTab: 'received' as TabType,
    pendingRequests: [] as ExchangeRequest[],
    sentRequests: [] as ExchangeRequest[],
    pendingLoading: false,
    sentLoading: false,
    pendingTotal: 0,
    sentTotal: 0,
  } as PageData,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadAllData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时刷新数据
    this.loadAllData();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadAllData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载所有数据
   */
  async loadAllData(): Promise<void> {
    await Promise.all([
      this.loadPendingRequests(),
      this.loadSentRequests(),
    ]);
  },

  /**
   * 加载待处理请求（收到的）
   * Requirements: 7.5
   */
  async loadPendingRequests(): Promise<void> {
    this.setData({ pendingLoading: true });
    
    try {
      await exchangeStore.loadPendingRequests();
      
      // 格式化请求数据
      const formattedRequests = exchangeStore.pendingRequests.map(req => ({
        ...req,
        formattedTime: formatRelativeTime(new Date(req.created_at)),
        statusText: this.getStatusText(req.status),
      }));
      
      this.setData({
        pendingRequests: formattedRequests,
        pendingTotal: exchangeStore.pendingTotal,
      });
    } catch (error) {
      console.error('Load pending requests failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ pendingLoading: false });
    }
  },

  /**
   * 加载已发送请求
   * Requirements: 7.5
   */
  async loadSentRequests(): Promise<void> {
    this.setData({ sentLoading: true });
    
    try {
      await exchangeStore.loadSentRequests();
      
      // 格式化请求数据
      const formattedRequests = exchangeStore.sentRequests.map(req => ({
        ...req,
        formattedTime: formatRelativeTime(new Date(req.created_at)),
        statusText: this.getStatusText(req.status),
      }));
      
      this.setData({
        sentRequests: formattedRequests,
        sentTotal: exchangeStore.sentTotal,
      });
    } catch (error) {
      console.error('Load sent requests failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ sentLoading: false });
    }
  },

  /**
   * 获取状态文本
   */
  getStatusText(status: ExchangeRequest['status']): string {
    const statusMap: Record<ExchangeRequest['status'], string> = {
      pending: '待处理',
      accepted: '已接受',
      rejected: '已拒绝',
      cancelled: '已取消',
      expired: '已过期',
    };
    return statusMap[status] || status;
  },

  /**
   * 切换 Tab
   */
  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as TabType;
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab });
    }
  },

  /**
   * 接受交换请求
   * Requirements: 7.6, 7.7
   * - 接受后，卡片添加到请求者的收藏
   * - 卡片所有者获得金币
   */
  onAccept(e: WechatMiniprogram.TouchEvent) {
    const exchangeId = e.currentTarget.dataset.id as string;
    const exchange = this.data.pendingRequests.find(req => req.id === exchangeId);
    
    if (!exchange) return;
    
    wx.showModal({
      title: '确认接受',
      content: `接受后，对方将获得此卡片的收藏权限，您将获得 ${exchange.coin_cost} 金币`,
      confirmText: '确认接受',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            await exchangeStore.acceptExchange(exchangeId);
            
            // 更新用户余额（卡片所有者获得金币）
            // Requirements: 7.7 - 卡片所有者获得金币
            userStore.updateCoinBalance(exchange.coin_cost);
            
            // 刷新列表以显示更新后的状态
            await this.loadPendingRequests();
          } catch (error) {
            console.error('Accept exchange failed:', error);
          }
        }
      },
    });
  },

  /**
   * 拒绝交换请求
   * Requirements: 7.6
   * - 拒绝后，请求状态变为 rejected
   * - 请求者的金币不会被扣除
   */
  onReject(e: WechatMiniprogram.TouchEvent) {
    const exchangeId = e.currentTarget.dataset.id as string;
    
    wx.showModal({
      title: '确认拒绝',
      content: '确定要拒绝这个交换请求吗？',
      confirmText: '确认拒绝',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            await exchangeStore.rejectExchange(exchangeId);
            // 刷新列表以显示更新后的状态
            await this.loadPendingRequests();
          } catch (error) {
            console.error('Reject exchange failed:', error);
          }
        }
      },
    });
  },

  /**
   * 取消已发送的交换请求
   */
  onCancel(e: WechatMiniprogram.TouchEvent) {
    const exchangeId = e.currentTarget.dataset.id as string;
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个交换请求吗？',
      confirmText: '确认取消',
      cancelText: '返回',
      success: async (res) => {
        if (res.confirm) {
          try {
            await exchangeStore.cancelExchange(exchangeId);
            // 刷新列表
            await this.loadSentRequests();
          } catch (error) {
            console.error('Cancel exchange failed:', error);
          }
        }
      },
    });
  },

  /**
   * 跳转到卡片详情
   */
  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const cardId = e.currentTarget.dataset.cardId as string;
    if (cardId) {
      wx.navigateTo({
        url: `/pages/card-detail/card-detail?id=${cardId}`,
      });
    }
  },

  /**
   * 跳转到用户主页
   */
  onUserTap(e: WechatMiniprogram.TouchEvent) {
    const userId = e.currentTarget.dataset.userId as string;
    if (userId) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?id=${userId}`,
      });
    }
  },
});
