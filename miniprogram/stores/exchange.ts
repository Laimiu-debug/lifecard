/**
 * 交换状态管理 Store
 * 使用 MobX 实现交换请求列表状态管理
 * 
 * Requirements: 7.4, 7.5
 */

import { observable, action } from 'mobx-miniprogram';
import { request } from '../services/request';
import type { 
  ExchangeRequest, 
  ExchangeResult,
  ExchangeRecord,
  ExchangeListResult,
  ExchangeHistoryResult,
  ExchangeStats,
  PriceInfo,
} from '../types/exchange';

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
  showModal: (options: { 
    title: string; 
    content: string; 
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    success?: (res: { confirm: boolean; cancel: boolean }) => void;
  }) => void;
};

// Store 状态接口
interface ExchangeStoreState {
  /** 待处理的交换请求（收到的） */
  pendingRequests: ExchangeRequest[];
  /** 待处理请求是否正在加载 */
  pendingLoading: boolean;
  /** 待处理请求总数 */
  pendingTotal: number;
  
  /** 已发送的交换请求 */
  sentRequests: ExchangeRequest[];
  /** 已发送请求是否正在加载 */
  sentLoading: boolean;
  /** 已发送请求总数 */
  sentTotal: number;
  
  /** 交换历史记录 */
  historyRecords: ExchangeRecord[];
  /** 历史记录当前页 */
  historyPage: number;
  /** 历史记录是否有更多 */
  historyHasMore: boolean;
  /** 历史记录是否正在加载 */
  historyLoading: boolean;
  
  /** 交换统计 */
  stats: ExchangeStats | null;
  
  /** 当前操作的交换请求 */
  currentExchange: ExchangeRequest | null;
  
  /** 错误信息 */
  error: string | null;
}

// Store Actions 接口
interface ExchangeStoreActions {
  /** 获取待处理请求数量 */
  readonly pendingCount: number;
  /** 获取已发送请求数量 */
  readonly sentCount: number;
  /** 加载待处理的交换请求 */
  loadPendingRequests(): Promise<void>;
  /** 加载已发送的交换请求 */
  loadSentRequests(): Promise<void>;
  /** 加载交换历史 */
  loadHistory(reset?: boolean): Promise<void>;
  /** 加载交换统计 */
  loadStats(): Promise<void>;
  /** 创建交换请求 */
  createExchange(cardId: string, message?: string): Promise<ExchangeResult>;
  /** 接受交换请求 */
  acceptExchange(exchangeId: string): Promise<ExchangeResult>;
  /** 拒绝交换请求 */
  rejectExchange(exchangeId: string): Promise<void>;
  /** 取消交换请求 */
  cancelExchange(exchangeId: string): Promise<void>;
  /** 获取交换价格 */
  getExchangePrice(cardId: string): Promise<PriceInfo>;
  /** 更新交换请求状态（本地更新） */
  updateExchangeStatus(exchangeId: string, status: ExchangeRequest['status']): void;
  /** 从列表中移除交换请求 */
  removeExchangeFromList(exchangeId: string): void;
  /** 清除当前交换 */
  clearCurrentExchange(): void;
  /** 清除错误 */
  clearError(): void;
  /** 刷新所有列表 */
  refreshAll(): Promise<void>;
}

// 完整 Store 类型
export type ExchangeStore = ExchangeStoreState & ExchangeStoreActions;

/**
 * 交换 Store
 * 管理交换请求列表状态
 */
export const exchangeStore: ExchangeStore = observable({
  // ==================== 待处理请求状态 ====================
  
  /** 待处理的交换请求（收到的） */
  pendingRequests: [] as ExchangeRequest[],
  
  /** 待处理请求是否正在加载 */
  pendingLoading: false,
  
  /** 待处理请求总数 */
  pendingTotal: 0,

  // ==================== 已发送请求状态 ====================
  
  /** 已发送的交换请求 */
  sentRequests: [] as ExchangeRequest[],
  
  /** 已发送请求是否正在加载 */
  sentLoading: false,
  
  /** 已发送请求总数 */
  sentTotal: 0,

  // ==================== 历史记录状态 ====================
  
  /** 交换历史记录 */
  historyRecords: [] as ExchangeRecord[],
  
  /** 历史记录当前页 */
  historyPage: 1,
  
  /** 历史记录是否有更多 */
  historyHasMore: true,
  
  /** 历史记录是否正在加载 */
  historyLoading: false,

  // ==================== 其他状态 ====================
  
  /** 交换统计 */
  stats: null as ExchangeStats | null,
  
  /** 当前操作的交换请求 */
  currentExchange: null as ExchangeRequest | null,
  
  /** 错误信息 */
  error: null as string | null,

  // ==================== 计算属性 ====================
  
  /** 获取待处理请求数量 */
  get pendingCount(): number {
    return this.pendingRequests.length;
  },
  
  /** 获取已发送请求数量 */
  get sentCount(): number {
    return this.sentRequests.length;
  },

  // ==================== Actions ====================

  /**
   * 加载待处理的交换请求（收到的）
   * 
   * Requirements: 7.5
   */
  loadPendingRequests: action(async function(this: ExchangeStoreState): Promise<void> {
    if (this.pendingLoading) return;
    
    this.pendingLoading = true;
    this.error = null;
    
    try {
      const result = await request.get<ExchangeListResult>('/api/exchanges/pending');
      
      this.pendingRequests = result.exchanges;
      this.pendingTotal = result.total;
    } catch (err: any) {
      this.error = err?.message || '加载待处理请求失败';
      console.error('Load pending requests failed:', err);
    } finally {
      this.pendingLoading = false;
    }
  }),

  /**
   * 加载已发送的交换请求
   * 
   * Requirements: 7.4
   */
  loadSentRequests: action(async function(this: ExchangeStoreState): Promise<void> {
    if (this.sentLoading) return;
    
    this.sentLoading = true;
    this.error = null;
    
    try {
      const result = await request.get<ExchangeListResult>('/api/exchanges/sent');
      
      this.sentRequests = result.exchanges;
      this.sentTotal = result.total;
    } catch (err: any) {
      this.error = err?.message || '加载已发送请求失败';
      console.error('Load sent requests failed:', err);
    } finally {
      this.sentLoading = false;
    }
  }),

  /**
   * 加载交换历史
   * 
   * Requirements: 7.5
   */
  loadHistory: action(async function(this: ExchangeStoreState, reset = true): Promise<void> {
    if (this.historyLoading) return;
    if (!reset && !this.historyHasMore) return;
    
    this.historyLoading = true;
    this.error = null;
    
    if (reset) {
      this.historyPage = 1;
      this.historyRecords = [];
      this.historyHasMore = true;
    }
    
    try {
      const result = await request.get<ExchangeHistoryResult>('/api/exchanges/history', {
        page: this.historyPage,
        page_size: 20,
      });
      
      if (reset) {
        this.historyRecords = result.records;
      } else {
        this.historyRecords = [...this.historyRecords, ...result.records];
      }
      
      this.historyHasMore = result.has_more;
      this.historyPage += 1;
    } catch (err: any) {
      this.error = err?.message || '加载交换历史失败';
      console.error('Load exchange history failed:', err);
    } finally {
      this.historyLoading = false;
    }
  }),

  /**
   * 加载交换统计
   */
  loadStats: action(async function(this: ExchangeStoreState): Promise<void> {
    try {
      const stats = await request.get<ExchangeStats>('/api/exchanges/stats');
      this.stats = stats;
    } catch (err: any) {
      console.error('Load exchange stats failed:', err);
    }
  }),

  /**
   * 创建交换请求
   * 
   * Requirements: 7.3, 7.4
   */
  createExchange: action(async function(
    this: ExchangeStoreState, 
    cardId: string, 
    message?: string
  ): Promise<ExchangeResult> {
    this.error = null;
    
    try {
      wx.showLoading({ title: '发送请求中...', mask: true });
      
      const result = await request.post<ExchangeResult>('/api/exchanges', {
        card_id: cardId,
        message,
      });
      
      wx.hideLoading();
      wx.showToast({ title: '交换请求已发送', icon: 'success' });
      
      // 刷新已发送列表
      await (this as ExchangeStoreState & ExchangeStoreActions).loadSentRequests();
      
      return result;
    } catch (err: any) {
      wx.hideLoading();
      this.error = err?.message || '发送交换请求失败';
      console.error('Create exchange failed:', err);
      wx.showToast({ title: this.error || '发送失败', icon: 'none' });
      throw err;
    }
  }),

  /**
   * 接受交换请求
   * 
   * Requirements: 7.6, 7.7
   * - 接受后，卡片添加到请求者的收藏
   * - 卡片所有者获得金币
   * - 请求者扣除金币
   */
  acceptExchange: action(async function(
    this: ExchangeStoreState & ExchangeStoreActions, 
    exchangeId: string
  ): Promise<ExchangeResult> {
    this.error = null;
    
    try {
      wx.showLoading({ title: '处理中...', mask: true });
      
      const result = await request.post<ExchangeResult>(`/api/exchanges/${exchangeId}/accept`);
      
      // 从待处理列表中移除或更新状态
      this.updateExchangeStatus(exchangeId, 'accepted');
      
      wx.hideLoading();
      wx.showToast({ title: '交换成功', icon: 'success' });
      
      return result;
    } catch (err: any) {
      wx.hideLoading();
      this.error = err?.message || '接受交换失败';
      console.error('Accept exchange failed:', err);
      wx.showToast({ title: this.error || '操作失败', icon: 'none' });
      throw err;
    }
  }),

  /**
   * 拒绝交换请求
   * 
   * Requirements: 7.6
   * - 拒绝后，请求状态变为 rejected
   * - 请求者的金币不会被扣除
   */
  rejectExchange: action(async function(
    this: ExchangeStoreState & ExchangeStoreActions, 
    exchangeId: string
  ): Promise<void> {
    this.error = null;
    
    try {
      wx.showLoading({ title: '处理中...', mask: true });
      
      await request.post(`/api/exchanges/${exchangeId}/reject`);
      
      // 更新状态为已拒绝
      this.updateExchangeStatus(exchangeId, 'rejected');
      
      wx.hideLoading();
      wx.showToast({ title: '已拒绝', icon: 'success' });
    } catch (err: any) {
      wx.hideLoading();
      this.error = err?.message || '拒绝交换失败';
      console.error('Reject exchange failed:', err);
      wx.showToast({ title: this.error || '操作失败', icon: 'none' });
      throw err;
    }
  }),

  /**
   * 取消交换请求
   * 
   * Requirements: 7.4
   */
  cancelExchange: action(async function(
    this: ExchangeStoreState & ExchangeStoreActions, 
    exchangeId: string
  ): Promise<void> {
    this.error = null;
    
    try {
      wx.showLoading({ title: '取消中...', mask: true });
      
      await request.delete(`/api/exchanges/${exchangeId}`);
      
      // 从已发送列表中移除
      this.removeExchangeFromList(exchangeId);
      
      wx.hideLoading();
      wx.showToast({ title: '已取消', icon: 'success' });
    } catch (err: any) {
      wx.hideLoading();
      this.error = err?.message || '取消交换失败';
      console.error('Cancel exchange failed:', err);
      wx.showToast({ title: this.error || '操作失败', icon: 'none' });
      throw err;
    }
  }),

  /**
   * 获取交换价格
   * 
   * Requirements: 7.1
   */
  getExchangePrice: action(async function(
    this: ExchangeStoreState, 
    cardId: string
  ): Promise<PriceInfo> {
    try {
      const priceInfo = await request.get<PriceInfo>(`/api/cards/${cardId}/exchange-price`);
      return priceInfo;
    } catch (err: any) {
      console.error('Get exchange price failed:', err);
      throw err;
    }
  }),

  /**
   * 更新交换请求状态（本地更新）
   */
  updateExchangeStatus: action(function(
    this: ExchangeStoreState, 
    exchangeId: string, 
    status: ExchangeRequest['status']
  ): void {
    // 更新待处理列表
    const pendingIndex = this.pendingRequests.findIndex(e => e.id === exchangeId);
    if (pendingIndex !== -1) {
      this.pendingRequests = [
        ...this.pendingRequests.slice(0, pendingIndex),
        { ...this.pendingRequests[pendingIndex], status },
        ...this.pendingRequests.slice(pendingIndex + 1),
      ];
    }
    
    // 更新已发送列表
    const sentIndex = this.sentRequests.findIndex(e => e.id === exchangeId);
    if (sentIndex !== -1) {
      this.sentRequests = [
        ...this.sentRequests.slice(0, sentIndex),
        { ...this.sentRequests[sentIndex], status },
        ...this.sentRequests.slice(sentIndex + 1),
      ];
    }
    
    // 更新当前交换
    if (this.currentExchange && this.currentExchange.id === exchangeId) {
      this.currentExchange = { ...this.currentExchange, status };
    }
  }),

  /**
   * 从列表中移除交换请求
   */
  removeExchangeFromList: action(function(this: ExchangeStoreState, exchangeId: string): void {
    this.pendingRequests = this.pendingRequests.filter(e => e.id !== exchangeId);
    this.sentRequests = this.sentRequests.filter(e => e.id !== exchangeId);
    
    // 更新总数
    this.pendingTotal = this.pendingRequests.length;
    this.sentTotal = this.sentRequests.length;
    
    if (this.currentExchange && this.currentExchange.id === exchangeId) {
      this.currentExchange = null;
    }
  }),

  /**
   * 清除当前交换
   */
  clearCurrentExchange: action(function(this: ExchangeStoreState): void {
    this.currentExchange = null;
  }),

  /**
   * 清除错误
   */
  clearError: action(function(this: ExchangeStoreState): void {
    this.error = null;
  }),

  /**
   * 刷新所有列表
   */
  refreshAll: action(async function(this: ExchangeStoreState & ExchangeStoreActions): Promise<void> {
    await Promise.all([
      this.loadPendingRequests(),
      this.loadSentRequests(),
      this.loadStats(),
    ]);
  }),
});
