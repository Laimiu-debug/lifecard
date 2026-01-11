/**
 * 交易历史页面
 * 显示金币交易记录列表
 * 
 * Requirements: 11.2, 11.3, 11.4
 */

import { userStore } from '../../stores/user';
import { userService, TransactionHistoryResult } from '../../services/user';
import { 
  formatTransactionDisplay, 
  FormattedTransactionDisplay
} from '../../utils/format';
import type { CoinTransaction } from '../../types/user';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// 格式化后的交易记录（包含原始数据和显示数据）
interface FormattedTransaction extends CoinTransaction, FormattedTransactionDisplay {}

// 页面数据接口
interface TransactionsPageData {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 金币余额 */
  coinBalance: number;
  /** 交易记录列表 */
  transactions: FormattedTransaction[];
  /** 是否正在加载 */
  loading: boolean;
  /** 是否正在刷新 */
  refreshing: boolean;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总数 */
  total: number;
  /** 是否为空 */
  isEmpty: boolean;
}

Page<TransactionsPageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    isLoggedIn: false,
    coinBalance: 0,
    transactions: [],
    loading: false,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    total: 0,
    isEmpty: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.initPage();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.syncFromStore();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.refreshTransactions().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreTransactions();
    }
  },

  /**
   * 初始化页面
   */
  initPage() {
    // 检查登录状态
    userStore.init();
    this.syncFromStore();

    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 加载交易记录
    this.loadTransactions();
  },

  /**
   * 从 Store 同步数据到页面
   */
  syncFromStore() {
    const { isLoggedIn, coinBalance } = userStore;
    this.setData({
      isLoggedIn,
      coinBalance,
    });
  },

  /**
   * 格式化交易记录
   * Requirements: 11.5
   */
  formatTransaction(transaction: CoinTransaction): FormattedTransaction {
    const displayData = formatTransactionDisplay(transaction);
    return {
      ...transaction,
      ...displayData,
    };
  },

  /**
   * 加载交易记录
   * Requirements: 11.2, 11.3, 11.4
   */
  async loadTransactions() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const result: TransactionHistoryResult = await userService.getTransactionHistory(
        1,
        this.data.pageSize
      );

      const formattedTransactions = result.transactions.map(t => this.formatTransaction(t));

      this.setData({
        transactions: formattedTransactions,
        page: 1,
        hasMore: result.has_more,
        total: result.total,
        isEmpty: formattedTransactions.length === 0,
      });
    } catch (error: any) {
      console.error('加载交易记录失败:', error);
      wx.showToast({ title: error?.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 刷新交易记录
   */
  async refreshTransactions() {
    if (this.data.refreshing) return;

    this.setData({ refreshing: true });

    try {
      // 刷新余额
      await userStore.refreshBalance();
      this.syncFromStore();

      // 重新加载交易记录
      const result: TransactionHistoryResult = await userService.getTransactionHistory(
        1,
        this.data.pageSize
      );

      const formattedTransactions = result.transactions.map(t => this.formatTransaction(t));

      this.setData({
        transactions: formattedTransactions,
        page: 1,
        hasMore: result.has_more,
        total: result.total,
        isEmpty: formattedTransactions.length === 0,
      });
    } catch (error: any) {
      console.error('刷新交易记录失败:', error);
      wx.showToast({ title: error?.message || '刷新失败', icon: 'none' });
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /**
   * 加载更多交易记录
   */
  async loadMoreTransactions() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const nextPage = this.data.page + 1;
      const result: TransactionHistoryResult = await userService.getTransactionHistory(
        nextPage,
        this.data.pageSize
      );

      const formattedTransactions = result.transactions.map(t => this.formatTransaction(t));

      this.setData({
        transactions: [...this.data.transactions, ...formattedTransactions],
        page: nextPage,
        hasMore: result.has_more,
      });
    } catch (error: any) {
      console.error('加载更多交易记录失败:', error);
      wx.showToast({ title: error?.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
