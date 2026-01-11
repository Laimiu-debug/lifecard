/**
 * 卡片状态管理 Store
 * 使用 MobX 实现 Feed、搜索结果、当前卡片状态管理
 * 
 * Requirements: 4.1, 4.2, 5.6
 */

import { observable, action } from 'mobx-miniprogram';
import { request } from '../services/request';
import type { 
  LifeCard, 
  CardFeedResult, 
  CardSearchResult,
  SearchQuery,
  TimeRange,
  Comment,
  LikeResult,
} from '../types/card';

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
};

// Feed 类型
export type FeedType = 'recommend' | 'hot' | 'nearby';

// Store 状态接口
interface CardStoreState {
  /** Feed 卡片列表 */
  feedCards: LifeCard[];
  /** Feed 游标 */
  feedCursor: string | null;
  /** Feed 是否有更多 */
  feedHasMore: boolean;
  /** Feed 是否正在加载 */
  feedLoading: boolean;
  /** 当前 Feed 类型 */
  feedType: FeedType;
  
  /** 搜索结果 */
  searchResults: LifeCard[];
  /** 搜索查询条件 */
  searchQuery: SearchQuery;
  /** 搜索当前页 */
  searchPage: number;
  /** 搜索是否有更多 */
  searchHasMore: boolean;
  /** 搜索是否正在加载 */
  searchLoading: boolean;
  /** 搜索总数 */
  searchTotal: number;
  
  /** 热门卡片列表 */
  hotCards: LifeCard[];
  /** 热门时间范围 */
  hotTimeRange: TimeRange;
  /** 热门是否正在加载 */
  hotLoading: boolean;
  
  /** 当前查看的卡片 */
  currentCard: LifeCard | null;
  /** 当前卡片评论列表 */
  currentComments: Comment[];
  /** 评论当前页 */
  commentsPage: number;
  /** 评论是否有更多 */
  commentsHasMore: boolean;
  /** 评论是否正在加载 */
  commentsLoading: boolean;
  
  /** 错误信息 */
  error: string | null;
}

// Store Actions 接口
interface CardStoreActions {
  /** 加载 Feed */
  loadFeed(refresh?: boolean): Promise<void>;
  /** 切换 Feed 类型 */
  switchFeedType(type: FeedType): Promise<void>;
  /** 搜索卡片 */
  searchCards(query: SearchQuery, reset?: boolean): Promise<void>;
  /** 加载更多搜索结果 */
  loadMoreSearchResults(): Promise<void>;
  /** 清除搜索结果 */
  clearSearchResults(): void;
  /** 加载热门卡片 */
  loadHotCards(timeRange?: TimeRange): Promise<void>;
  /** 加载卡片详情 */
  loadCardDetail(cardId: string): Promise<void>;
  /** 点赞卡片 */
  likeCard(cardId: string): Promise<void>;
  /** 取消点赞 */
  unlikeCard(cardId: string): Promise<void>;
  /** 加载评论 */
  loadComments(cardId: string, reset?: boolean): Promise<void>;
  /** 添加评论 */
  addComment(cardId: string, content: string): Promise<Comment>;
  /** 更新卡片（本地更新） */
  updateCardInList(cardId: string, updates: Partial<LifeCard>): void;
  /** 从列表中移除卡片 */
  removeCardFromList(cardId: string): void;
  /** 清除当前卡片 */
  clearCurrentCard(): void;
  /** 清除错误 */
  clearError(): void;
}

// 完整 Store 类型
export type CardStore = CardStoreState & CardStoreActions;

/**
 * 卡片 Store
 * 管理 Feed、搜索、热门、当前卡片状态
 */
export const cardStore: CardStore = observable({
  // ==================== Feed 状态 ====================
  
  /** Feed 卡片列表 */
  feedCards: [] as LifeCard[],
  
  /** Feed 游标 */
  feedCursor: null as string | null,
  
  /** Feed 是否有更多 */
  feedHasMore: true,
  
  /** Feed 是否正在加载 */
  feedLoading: false,
  
  /** 当前 Feed 类型 */
  feedType: 'recommend' as FeedType,

  // ==================== 搜索状态 ====================
  
  /** 搜索结果 */
  searchResults: [] as LifeCard[],
  
  /** 搜索查询条件 */
  searchQuery: {} as SearchQuery,
  
  /** 搜索当前页 */
  searchPage: 1,
  
  /** 搜索是否有更多 */
  searchHasMore: true,
  
  /** 搜索是否正在加载 */
  searchLoading: false,
  
  /** 搜索总数 */
  searchTotal: 0,

  // ==================== 热门状态 ====================
  
  /** 热门卡片列表 */
  hotCards: [] as LifeCard[],
  
  /** 热门时间范围 */
  hotTimeRange: 'week' as TimeRange,
  
  /** 热门是否正在加载 */
  hotLoading: false,

  // ==================== 当前卡片状态 ====================
  
  /** 当前查看的卡片 */
  currentCard: null as LifeCard | null,
  
  /** 当前卡片评论列表 */
  currentComments: [] as Comment[],
  
  /** 评论当前页 */
  commentsPage: 1,
  
  /** 评论是否有更多 */
  commentsHasMore: true,
  
  /** 评论是否正在加载 */
  commentsLoading: false,

  // ==================== 通用状态 ====================
  
  /** 错误信息 */
  error: null as string | null,

  // ==================== Actions ====================

  /**
   * 加载 Feed
   * 支持下拉刷新和上拉加载更多
   * 使用 cursor 分页实现无限滚动
   * 
   * Requirements: 4.1, 4.2, 4.3
   */
  loadFeed: action(async function(this: CardStoreState, refresh = false): Promise<void> {
    // 如果正在加载，跳过（防止重复请求）
    if (this.feedLoading) return;
    
    // 如果不是刷新且没有更多数据，跳过
    // Requirements: 4.2 - 分页结束时不再请求
    if (!refresh && !this.feedHasMore) return;
    
    this.feedLoading = true;
    this.error = null;
    
    try {
      // 刷新时重置游标，实现从头加载
      // Requirements: 4.3 - 下拉刷新从头开始
      const cursor = refresh ? undefined : (this.feedCursor || undefined);
      
      const params: Record<string, any> = {
        limit: 20,
        feed_type: this.feedType,
      };
      
      // 使用 cursor 进行分页
      // Requirements: 4.2 - cursor-based pagination
      if (cursor) {
        params.cursor = cursor;
      }
      
      const result = await request.get<CardFeedResult>('/api/cards/feed', params);
      
      if (refresh) {
        // 刷新：替换整个列表
        // Requirements: 4.3 - 刷新时重置列表
        this.feedCards = result.cards;
      } else {
        // 加载更多：追加到列表末尾
        // Requirements: 4.2 - 无限滚动追加数据
        this.feedCards = [...this.feedCards, ...result.cards];
      }
      
      // 更新 cursor 和 hasMore 状态
      // Requirements: 4.2 - 维护分页状态
      this.feedCursor = result.next_cursor || null;
      this.feedHasMore = result.has_more;
    } catch (err: any) {
      this.error = err?.message || '加载失败';
      console.error('Load feed failed:', err);
    } finally {
      this.feedLoading = false;
    }
  }),

  /**
   * 切换 Feed 类型
   * 
   * Requirements: 4.6
   */
  switchFeedType: action(async function(this: CardStoreState & CardStoreActions, type: FeedType): Promise<void> {
    if (this.feedType === type) return;
    
    this.feedType = type;
    this.feedCards = [];
    this.feedCursor = null;
    this.feedHasMore = true;
    
    await this.loadFeed(true);
  }),

  /**
   * 搜索卡片
   * 
   * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6
   */
  searchCards: action(async function(
    this: CardStoreState, 
    query: SearchQuery, 
    reset = true
  ): Promise<void> {
    if (this.searchLoading) return;
    
    this.searchLoading = true;
    this.error = null;
    
    // 重置搜索状态
    if (reset) {
      this.searchQuery = query;
      this.searchPage = 1;
      this.searchResults = [];
      this.searchHasMore = true;
      this.searchTotal = 0;
    }
    
    try {
      const params: Record<string, any> = {
        page: this.searchPage,
        page_size: 20,
      };
      
      // 添加搜索条件
      if (query.keyword) {
        params.keyword = query.keyword;
      }
      if (query.card_type) {
        params.card_type = query.card_type;
      }
      if (query.interest_tags && query.interest_tags.length > 0) {
        params.interest_tags = query.interest_tags.join(',');
      }
      if (query.latitude !== undefined && query.longitude !== undefined) {
        params.latitude = query.latitude;
        params.longitude = query.longitude;
        if (query.radius_km) {
          params.radius_km = query.radius_km;
        }
      }
      
      const result = await request.get<CardSearchResult>('/api/cards/search', params);
      
      if (reset) {
        this.searchResults = result.cards;
      } else {
        this.searchResults = [...this.searchResults, ...result.cards];
      }
      
      this.searchTotal = result.total;
      this.searchHasMore = result.has_more;
    } catch (err: any) {
      this.error = err?.message || '搜索失败';
      console.error('Search cards failed:', err);
    } finally {
      this.searchLoading = false;
    }
  }),

  /**
   * 加载更多搜索结果
   * 
   * Requirements: 5.6
   */
  loadMoreSearchResults: action(async function(this: CardStoreState & CardStoreActions): Promise<void> {
    if (this.searchLoading || !this.searchHasMore) return;
    
    this.searchPage += 1;
    await this.searchCards(this.searchQuery, false);
  }),

  /**
   * 清除搜索结果
   */
  clearSearchResults: action(function(this: CardStoreState): void {
    this.searchResults = [];
    this.searchQuery = {};
    this.searchPage = 1;
    this.searchHasMore = true;
    this.searchTotal = 0;
  }),

  /**
   * 加载热门卡片
   * 
   * Requirements: 4.7
   */
  loadHotCards: action(async function(
    this: CardStoreState, 
    timeRange?: TimeRange
  ): Promise<void> {
    if (this.hotLoading) return;
    
    this.hotLoading = true;
    this.error = null;
    
    if (timeRange) {
      this.hotTimeRange = timeRange;
    }
    
    try {
      const result = await request.get<LifeCard[]>('/api/cards/hot', {
        time_range: this.hotTimeRange,
        limit: 50,
      });
      
      this.hotCards = result;
    } catch (err: any) {
      this.error = err?.message || '加载热门失败';
      console.error('Load hot cards failed:', err);
    } finally {
      this.hotLoading = false;
    }
  }),

  /**
   * 加载卡片详情
   * 
   * Requirements: 6.1
   */
  loadCardDetail: action(async function(this: CardStoreState, cardId: string): Promise<void> {
    this.error = null;
    
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      
      const card = await request.get<LifeCard>(`/api/cards/${cardId}`);
      this.currentCard = card;
    } catch (err: any) {
      this.error = err?.message || '加载卡片失败';
      console.error('Load card detail failed:', err);
      wx.showToast({ title: this.error || '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }),

  /**
   * 点赞卡片
   * 
   * Requirements: 6.3
   */
  likeCard: action(async function(this: CardStoreState & CardStoreActions, cardId: string): Promise<void> {
    try {
      // 乐观更新
      this.updateCardInList(cardId, {
        is_liked: true,
        like_count: (this.currentCard?.like_count || 0) + 1,
      });
      
      const result = await request.post<LikeResult>(`/api/cards/${cardId}/like`);
      
      // 用服务器返回的数据更新
      this.updateCardInList(cardId, {
        is_liked: result.is_liked,
        like_count: result.like_count,
      });
    } catch (err: any) {
      // 回滚乐观更新
      this.updateCardInList(cardId, {
        is_liked: false,
        like_count: Math.max(0, (this.currentCard?.like_count || 1) - 1),
      });
      console.error('Like card failed:', err);
      wx.showToast({ title: '点赞失败', icon: 'none' });
    }
  }),

  /**
   * 取消点赞
   * 
   * Requirements: 6.3
   */
  unlikeCard: action(async function(this: CardStoreState & CardStoreActions, cardId: string): Promise<void> {
    try {
      // 乐观更新
      this.updateCardInList(cardId, {
        is_liked: false,
        like_count: Math.max(0, (this.currentCard?.like_count || 1) - 1),
      });
      
      const result = await request.delete<LikeResult>(`/api/cards/${cardId}/like`);
      
      // 用服务器返回的数据更新
      this.updateCardInList(cardId, {
        is_liked: result.is_liked,
        like_count: result.like_count,
      });
    } catch (err: any) {
      // 回滚乐观更新
      this.updateCardInList(cardId, {
        is_liked: true,
        like_count: (this.currentCard?.like_count || 0) + 1,
      });
      console.error('Unlike card failed:', err);
      wx.showToast({ title: '取消点赞失败', icon: 'none' });
    }
  }),

  /**
   * 加载评论
   * 
   * Requirements: 6.4
   */
  loadComments: action(async function(
    this: CardStoreState, 
    cardId: string, 
    reset = true
  ): Promise<void> {
    if (this.commentsLoading) return;
    
    this.commentsLoading = true;
    
    if (reset) {
      this.currentComments = [];
      this.commentsPage = 1;
      this.commentsHasMore = true;
    }
    
    try {
      const result = await request.get<{ comments: Comment[]; has_more: boolean }>(
        `/api/cards/${cardId}/comments`,
        { page: this.commentsPage, page_size: 20 }
      );
      
      if (reset) {
        this.currentComments = result.comments;
      } else {
        this.currentComments = [...this.currentComments, ...result.comments];
      }
      
      this.commentsHasMore = result.has_more;
    } catch (err: any) {
      console.error('Load comments failed:', err);
    } finally {
      this.commentsLoading = false;
    }
  }),

  /**
   * 添加评论
   * 
   * Requirements: 6.4, 6.5
   */
  addComment: action(async function(
    this: CardStoreState, 
    cardId: string, 
    content: string
  ): Promise<Comment> {
    try {
      const comment = await request.post<Comment>(`/api/cards/${cardId}/comments`, { content });
      
      // 添加到评论列表开头
      this.currentComments = [comment, ...this.currentComments];
      
      // 更新卡片评论数
      if (this.currentCard && this.currentCard.id === cardId) {
        this.currentCard = {
          ...this.currentCard,
          comment_count: this.currentCard.comment_count + 1,
        };
      }
      
      wx.showToast({ title: '评论成功', icon: 'success' });
      return comment;
    } catch (err: any) {
      console.error('Add comment failed:', err);
      wx.showToast({ title: '评论失败', icon: 'none' });
      throw err;
    }
  }),

  /**
   * 更新卡片（本地更新）
   * 用于乐观更新和同步状态
   */
  updateCardInList: action(function(
    this: CardStoreState, 
    cardId: string, 
    updates: Partial<LifeCard>
  ): void {
    // 更新当前卡片
    if (this.currentCard && this.currentCard.id === cardId) {
      this.currentCard = { ...this.currentCard, ...updates };
    }
    
    // 更新 Feed 列表中的卡片
    const feedIndex = this.feedCards.findIndex(c => c.id === cardId);
    if (feedIndex !== -1) {
      this.feedCards = [
        ...this.feedCards.slice(0, feedIndex),
        { ...this.feedCards[feedIndex], ...updates },
        ...this.feedCards.slice(feedIndex + 1),
      ];
    }
    
    // 更新搜索结果中的卡片
    const searchIndex = this.searchResults.findIndex(c => c.id === cardId);
    if (searchIndex !== -1) {
      this.searchResults = [
        ...this.searchResults.slice(0, searchIndex),
        { ...this.searchResults[searchIndex], ...updates },
        ...this.searchResults.slice(searchIndex + 1),
      ];
    }
    
    // 更新热门列表中的卡片
    const hotIndex = this.hotCards.findIndex(c => c.id === cardId);
    if (hotIndex !== -1) {
      this.hotCards = [
        ...this.hotCards.slice(0, hotIndex),
        { ...this.hotCards[hotIndex], ...updates },
        ...this.hotCards.slice(hotIndex + 1),
      ];
    }
  }),

  /**
   * 从列表中移除卡片
   */
  removeCardFromList: action(function(this: CardStoreState, cardId: string): void {
    this.feedCards = this.feedCards.filter(c => c.id !== cardId);
    this.searchResults = this.searchResults.filter(c => c.id !== cardId);
    this.hotCards = this.hotCards.filter(c => c.id !== cardId);
    
    if (this.currentCard && this.currentCard.id === cardId) {
      this.currentCard = null;
    }
  }),

  /**
   * 清除当前卡片
   */
  clearCurrentCard: action(function(this: CardStoreState): void {
    this.currentCard = null;
    this.currentComments = [];
    this.commentsPage = 1;
    this.commentsHasMore = true;
  }),

  /**
   * 清除错误
   */
  clearError: action(function(this: CardStoreState): void {
    this.error = null;
  }),
});
