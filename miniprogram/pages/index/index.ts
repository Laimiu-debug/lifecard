/**
 * 首页 - Feed 卡片流
 * 实现 Tab 切换（推荐/热门/随机）
 * 实现下拉刷新和上拉加载（无限滚动）
 * 集成 cursor 分页
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.6
 */

import { createStoreBindings } from 'mobx-miniprogram-bindings';
import { cardStore } from '../../stores/card';
import { notificationStore } from '../../stores/notification';
import { cardService } from '../../services/card';
import type { LifeCard, TimeRange } from '../../types/card';

// Tab 类型定义
type TabType = 'recommend' | 'hot' | 'random';

// 页面数据接口
interface PageData {
  activeTab: TabType;
  cards: LifeCard[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  unreadCount: number;
  hotTimeRange: TimeRange;
  randomExcludeIds: string[];
}

Page({
  data: {
    activeTab: 'recommend' as TabType,
    cards: [] as LifeCard[],
    cursor: null as string | null,
    hasMore: true,
    loading: false,
    refreshing: false,
    loadingMore: false,
    unreadCount: 0,
    hotTimeRange: 'week' as TimeRange,
    randomExcludeIds: [] as string[],
  } as PageData,

  // Store bindings
  storeBindings: null as any,
  notificationBindings: null as any,

  onLoad() {
    // 绑定 card store
    this.storeBindings = createStoreBindings(this, {
      store: cardStore,
      fields: ['feedCards', 'feedLoading', 'feedHasMore', 'feedCursor', 'hotCards', 'hotLoading'],
      actions: ['loadFeed', 'switchFeedType', 'loadHotCards'],
    });

    // 绑定 notification store
    this.notificationBindings = createStoreBindings(this, {
      store: notificationStore,
      fields: ['totalUnread'],
      actions: [],
    });

    // 加载初始数据
    this.loadInitialData();
  },

  onShow() {
    // 每次显示页面时刷新未读计数
    this.refreshUnreadCount();
  },

  onUnload() {
    // 清理 store bindings
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings();
    }
    if (this.notificationBindings) {
      this.notificationBindings.destroyStoreBindings();
    }
  },

  /**
   * 下拉刷新处理
   * Requirements: 4.3 - 下拉刷新重新加载 Feed
   */
  onPullDownRefresh() {
    this.refreshFeed();
  },

  /**
   * 上拉触底处理 - 无限滚动加载更多
   * Requirements: 4.2 - 支持无限滚动加载
   */
  onReachBottom() {
    const { hasMore, loading, loadingMore, activeTab } = this.data;
    
    // 热门 Tab 不支持分页加载
    if (activeTab === 'hot') {
      return;
    }
    
    // 如果还有更多数据且当前没有在加载中，则加载更多
    if (hasMore && !loading && !loadingMore) {
      this.loadMoreCards();
    }
  },

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    this.setData({ loading: true });
    
    try {
      // 加载未读通知计数
      await notificationStore.loadUnreadCount();
      this.setData({ unreadCount: notificationStore.totalUnread });
      
      // 加载推荐 Feed（初始加载，重置 cursor）
      await this.loadFeedCards(true);
    } catch (error) {
      console.error('Load initial data failed:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载未读计数
   */
  async refreshUnreadCount() {
    try {
      await notificationStore.loadUnreadCount();
      this.setData({ unreadCount: notificationStore.totalUnread });
    } catch (error) {
      console.error('Load unread count failed:', error);
    }
  },

  /**
   * 切换 Tab
   * Requirements: 4.6
   */
  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as TabType;
    if (tab !== this.data.activeTab) {
      // 切换 Tab 时重置所有分页状态
      this.setData({
        activeTab: tab,
        cards: [],
        cursor: null,
        hasMore: true,
        randomExcludeIds: [],
      });
      this.loadFeedCards(true);
    }
  },

  /**
   * 加载 Feed 卡片
   * 支持 cursor 分页
   * 
   * Requirements: 4.1, 4.2
   * @param refresh 是否刷新（重置 cursor）
   */
  async loadFeedCards(refresh = false) {
    const { loading, loadingMore } = this.data;
    
    // 防止重复加载
    if ((loading || loadingMore) && !refresh) return;

    // 设置加载状态
    if (refresh) {
      this.setData({ loading: true, refreshing: true });
    } else {
      this.setData({ loadingMore: true });
    }

    try {
      const { activeTab, cursor, cards, hotTimeRange, randomExcludeIds } = this.data;

      let newCards: LifeCard[] = [];
      let newCursor: string | null = null;
      let newHasMore = true;

      switch (activeTab) {
        case 'recommend':
          // 使用 cursor 分页加载推荐 Feed
          // Requirements: 4.2 - cursor-based pagination
          const feedResult = await cardService.getFeed(
            refresh ? undefined : (cursor || undefined),
            20
          );
          newCards = feedResult.cards;
          newCursor = feedResult.next_cursor || null;
          newHasMore = feedResult.has_more;
          break;

        case 'hot':
          // 加载热门卡片（一次性加载，不支持分页）
          const hotCards = await cardService.getHotCards(hotTimeRange, 50);
          newCards = hotCards;
          newHasMore = false; // 热门卡片一次性加载
          newCursor = null;
          break;

        case 'random':
          // 加载随机卡片（使用 excludeIds 实现伪分页）
          const excludeIds = refresh ? [] : randomExcludeIds;
          const randomCards = await cardService.getRandomCards(10, excludeIds);
          newCards = randomCards;
          // 更新排除列表以避免重复
          const newExcludeIds = [...excludeIds, ...randomCards.map(c => c.id)];
          this.setData({ randomExcludeIds: newExcludeIds });
          // 如果返回了足够的卡片，可能还有更多
          newHasMore = randomCards.length >= 10;
          newCursor = null;
          break;
      }

      // 更新数据
      if (refresh) {
        // 刷新时替换整个列表，重置 cursor
        // Requirements: 4.3 - 刷新时从头开始
        this.setData({
          cards: newCards,
          cursor: newCursor,
          hasMore: newHasMore,
        });
      } else {
        // 加载更多时追加到列表，更新 cursor
        // Requirements: 4.2 - 无限滚动追加数据
        this.setData({
          cards: [...cards, ...newCards],
          cursor: newCursor,
          hasMore: newHasMore,
        });
      }
    } catch (error) {
      console.error('Load feed failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ 
        loading: false, 
        refreshing: false,
        loadingMore: false,
      });
    }
  },

  /**
   * 加载更多卡片（上拉加载）
   * Requirements: 4.2 - 无限滚动
   */
  async loadMoreCards() {
    await this.loadFeedCards(false);
  },

  /**
   * 刷新 Feed（下拉刷新）
   * Requirements: 4.3 - 下拉刷新重新加载
   */
  async refreshFeed() {
    // 重置所有分页状态
    this.setData({
      cards: [],
      cursor: null,
      hasMore: true,
      randomExcludeIds: [],
    });

    await this.loadFeedCards(true);

    // 停止下拉刷新动画
    wx.stopPullDownRefresh();
  },

  /**
   * 热门时间范围切换
   * Requirements: 4.7
   */
  onHotTimeRangeChange(e: WechatMiniprogram.TouchEvent) {
    const timeRange = e.currentTarget.dataset.range as TimeRange;
    if (timeRange !== this.data.hotTimeRange) {
      this.setData({
        hotTimeRange: timeRange,
        cards: [],
      });
      this.loadFeedCards(true);
    }
  },

  /**
   * 换一批随机卡片
   */
  onRefreshRandom() {
    this.setData({
      cards: [],
      randomExcludeIds: [],
    });
    this.loadFeedCards(true);
  },

  /**
   * 跳转到卡片详情
   */
  onCardTap(e: WechatMiniprogram.CustomEvent) {
    const { card } = e.detail;
    if (card && card.id) {
      wx.navigateTo({
        url: `/pages/card-detail/card-detail?id=${card.id}`,
      });
    }
  },

  /**
   * 跳转到用户主页
   */
  onCreatorTap(e: WechatMiniprogram.CustomEvent) {
    const { userId } = e.detail;
    if (userId) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?id=${userId}`,
      });
    }
  },

  /**
   * 跳转到搜索页
   */
  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/search',
    });
  },

  /**
   * 跳转到通知页
   */
  onNotificationTap() {
    wx.navigateTo({
      url: '/pages/notifications/notifications',
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'Life Card - 分享你的人生体验',
      path: '/pages/index/index',
    };
  },
});
