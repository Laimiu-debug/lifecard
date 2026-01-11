/**
 * 用户服务
 * 实现资料获取、更新、关注接口
 * 
 * Requirements: 2.1, 2.3, 9.1, 9.2
 */

import { request } from './request';
import type {
  UserProfile,
  ProfileUpdateData,
  CoinTransaction,
  FollowListResult,
  UserStats,
} from '../types/user';
import type { PaginatedResult } from '../types/api';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * 关注操作结果
 */
export interface FollowResult {
  is_following: boolean;
  follower_count: number;
}

/**
 * 余额信息
 */
export interface BalanceInfo {
  balance: number;
}

/**
 * 交易历史分页结果
 */
export interface TransactionHistoryResult {
  transactions: CoinTransaction[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * 用户服务类
 * 封装所有用户相关的 API 调用
 */
class UserService {
  // ==================== 资料管理 ====================

  /**
   * 获取当前用户资料
   * 
   * Requirements: 2.1
   * @returns 当前用户资料
   */
  async getMyProfile(): Promise<UserProfile> {
    try {
      const profile = await request.get<UserProfile>('/api/users/me');
      return profile;
    } catch (error) {
      console.error('Get my profile failed:', error);
      throw error;
    }
  }

  /**
   * 获取指定用户资料
   * 
   * Requirements: 2.1
   * @param userId 用户 ID
   * @returns 用户资料
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const profile = await request.get<UserProfile>(`/api/users/${userId}`);
      return profile;
    } catch (error) {
      console.error('Get user profile failed:', error);
      throw error;
    }
  }

  /**
   * 更新当前用户资料
   * 
   * Requirements: 2.3
   * @param data 更新数据
   * @returns 更新后的用户资料
   */
  async updateProfile(data: ProfileUpdateData): Promise<UserProfile> {
    try {
      const profile = await request.put<UserProfile>('/api/users/me', data);
      return profile;
    } catch (error) {
      console.error('Update profile failed:', error);
      throw error;
    }
  }

  /**
   * 更新用户头像
   * 
   * Requirements: 2.6
   * @param avatarUrl 头像 URL
   * @returns 更新后的用户资料
   */
  async updateAvatar(avatarUrl: string): Promise<UserProfile> {
    try {
      const profile = await request.put<UserProfile>('/api/users/me', {
        avatar_url: avatarUrl,
      });
      return profile;
    } catch (error) {
      console.error('Update avatar failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   * 
   * @param userId 用户 ID（可选，默认当前用户）
   * @returns 用户统计信息
   */
  async getUserStats(userId?: string): Promise<UserStats> {
    try {
      const url = userId ? `/api/users/${userId}/stats` : '/api/users/me/stats';
      const stats = await request.get<UserStats>(url);
      return stats;
    } catch (error) {
      console.error('Get user stats failed:', error);
      throw error;
    }
  }

  // ==================== 关注功能 ====================

  /**
   * 关注用户
   * 
   * Requirements: 9.1, 9.2
   * @param userId 要关注的用户 ID
   * @returns 关注结果
   */
  async followUser(userId: string): Promise<FollowResult> {
    try {
      const result = await request.post<FollowResult>(`/api/users/${userId}/follow`);
      return result;
    } catch (error) {
      console.error('Follow user failed:', error);
      throw error;
    }
  }

  /**
   * 取消关注用户
   * 
   * Requirements: 9.1, 9.2
   * @param userId 要取消关注的用户 ID
   * @returns 关注结果
   */
  async unfollowUser(userId: string): Promise<FollowResult> {
    try {
      const result = await request.delete<FollowResult>(`/api/users/${userId}/follow`);
      return result;
    } catch (error) {
      console.error('Unfollow user failed:', error);
      throw error;
    }
  }

  /**
   * 获取关注列表
   * 
   * Requirements: 9.3, 9.4
   * @param userId 用户 ID（可选，默认当前用户）
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 关注列表
   */
  async getFollowing(
    userId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<FollowListResult> {
    try {
      const url = userId ? `/api/users/${userId}/following` : '/api/users/me/following';
      const result = await request.get<FollowListResult>(url, {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get following failed:', error);
      throw error;
    }
  }

  /**
   * 获取粉丝列表
   * 
   * Requirements: 9.3, 9.4
   * @param userId 用户 ID（可选，默认当前用户）
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 粉丝列表
   */
  async getFollowers(
    userId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<FollowListResult> {
    try {
      const url = userId ? `/api/users/${userId}/followers` : '/api/users/me/followers';
      const result = await request.get<FollowListResult>(url, {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get followers failed:', error);
      throw error;
    }
  }

  /**
   * 检查是否关注了指定用户
   * 
   * @param userId 用户 ID
   * @returns 是否已关注
   */
  async isFollowing(userId: string): Promise<boolean> {
    try {
      const result = await request.get<{ is_following: boolean }>(`/api/users/${userId}/is-following`);
      return result.is_following;
    } catch (error) {
      console.error('Check following status failed:', error);
      throw error;
    }
  }

  // ==================== 金币与交易 ====================

  /**
   * 获取当前余额
   * 
   * Requirements: 11.1
   * @returns 余额信息
   */
  async getBalance(): Promise<BalanceInfo> {
    try {
      const result = await request.get<BalanceInfo>('/api/users/me/balance');
      return result;
    } catch (error) {
      console.error('Get balance failed:', error);
      throw error;
    }
  }

  /**
   * 获取交易历史
   * 
   * Requirements: 11.2, 11.3, 11.4
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 交易历史
   */
  async getTransactionHistory(
    page: number = 1,
    pageSize: number = 20
  ): Promise<TransactionHistoryResult> {
    try {
      const result = await request.get<TransactionHistoryResult>('/api/users/me/transactions', {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get transaction history failed:', error);
      throw error;
    }
  }

  // ==================== 兴趣标签 ====================

  /**
   * 获取用户兴趣标签
   * 
   * @returns 兴趣标签列表
   */
  async getInterestTags(): Promise<string[]> {
    try {
      const result = await request.get<{ interest_tags: string[] }>('/api/users/me/interests');
      return result.interest_tags;
    } catch (error) {
      console.error('Get interest tags failed:', error);
      throw error;
    }
  }

  /**
   * 更新用户兴趣标签
   * 
   * @param tags 兴趣标签列表
   * @returns 更新后的标签列表
   */
  async updateInterestTags(tags: string[]): Promise<string[]> {
    try {
      const result = await request.put<{ interest_tags: string[] }>('/api/users/me/interests', {
        interest_tags: tags,
      });
      return result.interest_tags;
    } catch (error) {
      console.error('Update interest tags failed:', error);
      throw error;
    }
  }

  // ==================== 搜索用户 ====================

  /**
   * 搜索用户
   * 
   * @param keyword 搜索关键词
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 搜索结果
   */
  async searchUsers(
    keyword: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<UserProfile>> {
    try {
      const result = await request.get<PaginatedResult<UserProfile>>('/api/users/search', {
        keyword,
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Search users failed:', error);
      throw error;
    }
  }
}

// 导出单例
export const userService = new UserService();

// 导出类以便测试
export { UserService };
