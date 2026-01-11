/**
 * 卡片服务
 * 实现卡片 CRUD、Feed、搜索、点赞、评论等接口
 * 
 * Requirements: 3.8, 4.1, 4.2, 5.2, 6.3, 6.5
 */

import { request } from './request';
import type {
  LifeCard,
  CardCreateData,
  CardUpdateData,
  CardFeedResult,
  CardSearchResult,
  SearchQuery,
  TimeRange,
  Comment,
  CardFolder,
  LikeResult,
} from '../types/card';
import type { PaginatedResult } from '../types/api';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * 评论分页结果
 */
export interface CommentPaginatedResult {
  comments: Comment[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * 卡片创建结果（包含获得的金币）
 */
export interface CardCreateResult {
  card: LifeCard;
  coins_earned: number;
}

/**
 * 时间线分组结果
 */
export interface TimelineGroup {
  date: string;
  cards: LifeCard[];
}

/**
 * 分类分组结果
 */
export interface CategoryGroup {
  card_type: string;
  count: number;
  cards: LifeCard[];
}

/**
 * 卡片服务类
 * 封装所有卡片相关的 API 调用
 */
class CardService {
  // ==================== CRUD 操作 ====================

  /**
   * 创建卡片
   * 
   * Requirements: 3.8
   * @param data 卡片创建数据
   * @returns 创建的卡片和获得的金币
   */
  async createCard(data: CardCreateData): Promise<CardCreateResult> {
    try {
      const result = await request.post<CardCreateResult>('/api/cards', data);
      return result;
    } catch (error) {
      console.error('Create card failed:', error);
      throw error;
    }
  }

  /**
   * 获取卡片详情
   * 
   * @param cardId 卡片 ID
   * @returns 卡片详情
   */
  async getCard(cardId: string): Promise<LifeCard> {
    try {
      const card = await request.get<LifeCard>(`/api/cards/${cardId}`);
      return card;
    } catch (error) {
      console.error('Get card failed:', error);
      throw error;
    }
  }

  /**
   * 更新卡片
   * 
   * @param cardId 卡片 ID
   * @param data 更新数据
   * @returns 更新后的卡片
   */
  async updateCard(cardId: string, data: CardUpdateData): Promise<LifeCard> {
    try {
      const card = await request.put<LifeCard>(`/api/cards/${cardId}`, data);
      return card;
    } catch (error) {
      console.error('Update card failed:', error);
      throw error;
    }
  }

  /**
   * 删除卡片
   * 
   * @param cardId 卡片 ID
   */
  async deleteCard(cardId: string): Promise<void> {
    try {
      await request.delete<void>(`/api/cards/${cardId}`);
    } catch (error) {
      console.error('Delete card failed:', error);
      throw error;
    }
  }

  // ==================== Feed 和发现 ====================

  /**
   * 获取个性化 Feed
   * 
   * Requirements: 4.1, 4.2
   * @param cursor 游标（用于分页）
   * @param limit 每页数量
   * @returns Feed 结果
   */
  async getFeed(cursor?: string, limit: number = 20): Promise<CardFeedResult> {
    try {
      const params: Record<string, any> = { limit };
      if (cursor) {
        params.cursor = cursor;
      }
      const result = await request.get<CardFeedResult>('/api/cards/feed', params);
      return result;
    } catch (error) {
      console.error('Get feed failed:', error);
      throw error;
    }
  }

  /**
   * 搜索卡片
   * 
   * Requirements: 5.2
   * @param query 搜索条件
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 搜索结果
   */
  async searchCards(
    query: SearchQuery,
    page: number = 1,
    pageSize: number = 20
  ): Promise<CardSearchResult> {
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
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
        if (query.radius_km !== undefined) {
          params.radius_km = query.radius_km;
        }
      }

      const result = await request.get<CardSearchResult>('/api/cards/search', params);
      return result;
    } catch (error) {
      console.error('Search cards failed:', error);
      throw error;
    }
  }

  /**
   * 获取热门卡片
   * 
   * @param timeRange 时间范围
   * @param limit 数量限制
   * @returns 热门卡片列表
   */
  async getHotCards(timeRange: TimeRange = 'week', limit: number = 50): Promise<LifeCard[]> {
    try {
      const cards = await request.get<LifeCard[]>('/api/cards/hot', {
        time_range: timeRange,
        limit,
      });
      return cards;
    } catch (error) {
      console.error('Get hot cards failed:', error);
      throw error;
    }
  }

  /**
   * 获取随机卡片
   * 
   * @param count 数量
   * @param excludeIds 排除的卡片 ID 列表
   * @returns 随机卡片列表
   */
  async getRandomCards(count: number = 10, excludeIds?: string[]): Promise<LifeCard[]> {
    try {
      const params: Record<string, any> = { count };
      if (excludeIds && excludeIds.length > 0) {
        params.exclude_ids = excludeIds.join(',');
      }
      const cards = await request.get<LifeCard[]>('/api/cards/random', params);
      return cards;
    } catch (error) {
      console.error('Get random cards failed:', error);
      throw error;
    }
  }

  // ==================== 用户卡片集合 ====================

  /**
   * 获取我创建的卡片
   * 
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 分页结果
   */
  async getMyCards(page: number = 1, pageSize: number = 20): Promise<PaginatedResult<LifeCard>> {
    try {
      const result = await request.get<PaginatedResult<LifeCard>>('/api/cards/my-cards', {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get my cards failed:', error);
      throw error;
    }
  }

  /**
   * 获取我收藏的卡片
   * 
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 分页结果
   */
  async getCollectedCards(page: number = 1, pageSize: number = 20): Promise<PaginatedResult<LifeCard>> {
    try {
      const result = await request.get<PaginatedResult<LifeCard>>('/api/cards/collected', {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get collected cards failed:', error);
      throw error;
    }
  }

  /**
   * 获取指定用户的卡片
   * 
   * @param userId 用户 ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 分页结果
   */
  async getUserCards(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<LifeCard>> {
    try {
      const result = await request.get<PaginatedResult<LifeCard>>(`/api/users/${userId}/cards`, {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get user cards failed:', error);
      throw error;
    }
  }

  /**
   * 获取时间线视图（按日期分组）
   * 
   * @returns 时间线分组结果
   */
  async getTimeline(): Promise<TimelineGroup[]> {
    try {
      const result = await request.get<TimelineGroup[]>('/api/cards/timeline');
      return result;
    } catch (error) {
      console.error('Get timeline failed:', error);
      throw error;
    }
  }

  /**
   * 获取分类视图（按卡片类型分组）
   * 
   * @returns 分类分组结果
   */
  async getCardsByCategory(): Promise<CategoryGroup[]> {
    try {
      const result = await request.get<CategoryGroup[]>('/api/cards/by-category');
      return result;
    } catch (error) {
      console.error('Get cards by category failed:', error);
      throw error;
    }
  }

  // ==================== 社交互动 ====================

  /**
   * 点赞卡片
   * 
   * Requirements: 6.3
   * @param cardId 卡片 ID
   * @returns 点赞结果
   */
  async likeCard(cardId: string): Promise<LikeResult> {
    try {
      const result = await request.post<LikeResult>(`/api/cards/${cardId}/like`);
      return result;
    } catch (error) {
      console.error('Like card failed:', error);
      throw error;
    }
  }

  /**
   * 取消点赞
   * 
   * Requirements: 6.3
   * @param cardId 卡片 ID
   * @returns 点赞结果
   */
  async unlikeCard(cardId: string): Promise<LikeResult> {
    try {
      const result = await request.delete<LikeResult>(`/api/cards/${cardId}/like`);
      return result;
    } catch (error) {
      console.error('Unlike card failed:', error);
      throw error;
    }
  }

  /**
   * 添加评论
   * 
   * Requirements: 6.5
   * @param cardId 卡片 ID
   * @param content 评论内容
   * @returns 创建的评论
   */
  async addComment(cardId: string, content: string): Promise<Comment> {
    try {
      const comment = await request.post<Comment>(`/api/cards/${cardId}/comments`, { content });
      return comment;
    } catch (error) {
      console.error('Add comment failed:', error);
      throw error;
    }
  }

  /**
   * 获取评论列表
   * 
   * @param cardId 卡片 ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 评论分页结果
   */
  async getComments(
    cardId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<CommentPaginatedResult> {
    try {
      const result = await request.get<CommentPaginatedResult>(`/api/cards/${cardId}/comments`, {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get comments failed:', error);
      throw error;
    }
  }

  /**
   * 删除评论
   * 
   * @param commentId 评论 ID
   */
  async deleteComment(commentId: string): Promise<void> {
    try {
      await request.delete<void>(`/api/cards/comments/${commentId}`);
    } catch (error) {
      console.error('Delete comment failed:', error);
      throw error;
    }
  }

  // ==================== 文件夹管理 ====================

  /**
   * 创建文件夹
   * 
   * @param name 文件夹名称
   * @returns 创建的文件夹
   */
  async createFolder(name: string): Promise<CardFolder> {
    try {
      const folder = await request.post<CardFolder>('/api/cards/folders', { name });
      return folder;
    } catch (error) {
      console.error('Create folder failed:', error);
      throw error;
    }
  }

  /**
   * 获取文件夹列表
   * 
   * @returns 文件夹列表
   */
  async getFolders(): Promise<CardFolder[]> {
    try {
      const folders = await request.get<CardFolder[]>('/api/cards/folders');
      return folders;
    } catch (error) {
      console.error('Get folders failed:', error);
      throw error;
    }
  }

  /**
   * 获取文件夹中的卡片
   * 
   * @param folderId 文件夹 ID
   * @returns 卡片列表
   */
  async getFolderCards(folderId: string): Promise<LifeCard[]> {
    try {
      const cards = await request.get<LifeCard[]>(`/api/cards/folders/${folderId}/cards`);
      return cards;
    } catch (error) {
      console.error('Get folder cards failed:', error);
      throw error;
    }
  }

  /**
   * 移动卡片到文件夹
   * 
   * @param cardId 卡片 ID
   * @param folderId 目标文件夹 ID（null 表示移出文件夹）
   */
  async moveToFolder(cardId: string, folderId?: string): Promise<void> {
    try {
      await request.put<void>(`/api/cards/${cardId}/folder`, { folder_id: folderId || null });
    } catch (error) {
      console.error('Move to folder failed:', error);
      throw error;
    }
  }

  /**
   * 重命名文件夹
   * 
   * @param folderId 文件夹 ID
   * @param name 新名称
   * @returns 更新后的文件夹
   */
  async renameFolder(folderId: string, name: string): Promise<CardFolder> {
    try {
      const folder = await request.put<CardFolder>(`/api/cards/folders/${folderId}`, { name });
      return folder;
    } catch (error) {
      console.error('Rename folder failed:', error);
      throw error;
    }
  }

  /**
   * 删除文件夹
   * 
   * @param folderId 文件夹 ID
   */
  async deleteFolder(folderId: string): Promise<void> {
    try {
      await request.delete<void>(`/api/cards/folders/${folderId}`);
    } catch (error) {
      console.error('Delete folder failed:', error);
      throw error;
    }
  }

  // ==================== 隐私设置 ====================

  /**
   * 更新卡片隐私级别
   * 
   * @param cardId 卡片 ID
   * @param privacyLevel 隐私级别
   * @returns 更新后的隐私级别
   */
  async updatePrivacy(
    cardId: string,
    privacyLevel: 'public' | 'friends_only' | 'exchange_only'
  ): Promise<{ privacy_level: string }> {
    try {
      const result = await request.put<{ privacy_level: string }>(`/api/cards/${cardId}/privacy`, {
        privacy_level: privacyLevel,
      });
      return result;
    } catch (error) {
      console.error('Update privacy failed:', error);
      throw error;
    }
  }
}

// 导出单例
export const cardService = new CardService();

// 导出类以便测试
export { CardService };
