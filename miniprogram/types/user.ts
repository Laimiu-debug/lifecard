/**
 * 用户相关类型定义
 * Life Card 微信小程序
 */

// 交易类型
export type TransactionType = 'earn' | 'spend';

// 用户资料
export interface UserProfile {
  id: string;
  wechat_openid?: string;
  nickname: string;
  avatar_url?: string;
  bio?: string;
  age_range?: string;
  location?: string;
  card_count: number;
  follower_count: number;
  following_count: number;
  coin_balance: number;
  is_following?: boolean;
  is_mutual_follow?: boolean;
  created_at: string;
}

// 用户摘要（用于列表展示）
export interface UserSummary {
  id: string;
  nickname: string;
  avatar_url?: string;
}

// 资料更新数据
export interface ProfileUpdateData {
  nickname?: string;
  avatar_url?: string;
  bio?: string;
  age_range?: string;
  location?: string;
}

// 金币交易记录
export interface CoinTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: TransactionType;
  description: string;
  related_id?: string;
  created_at: string;
}

// 关注用户信息
export interface FollowUser {
  id: string;
  nickname: string;
  avatar_url?: string;
  bio?: string;
  card_count: number;
  is_following: boolean;
  is_mutual_follow: boolean;
}

// 关注列表结果
export interface FollowListResult {
  users: FollowUser[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// 登录结果
export interface LoginResult {
  token: string;
  user: UserProfile;
  is_new_user: boolean;
}

// Token 存储数据
export interface TokenData {
  token: string;
  expires_at: number;
}

// 用户统计
export interface UserStats {
  card_count: number;
  collected_count: number;
  follower_count: number;
  following_count: number;
  total_likes: number;
  total_exchanges: number;
}
