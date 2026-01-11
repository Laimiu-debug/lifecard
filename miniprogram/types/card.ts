/**
 * 卡片相关类型定义
 * Life Card 微信小程序
 */

// 卡片类型枚举
export type CardType = 'day_card' | 'week_card' | 'fragment_card' | 'moment_card';

// 隐私级别枚举
export type PrivacyLevel = 'public' | 'friends_only' | 'exchange_only';

// 媒体类型
export type MediaType = 'image' | 'video';

// 时间范围
export type TimeRange = 'day' | 'week' | 'month';

// 媒体项
export interface MediaItem {
  id: string;
  media_type: MediaType;
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

// 位置信息
export interface Location {
  name: string;
  latitude: number;
  longitude: number;
}

// 用户摘要（用于卡片中的创建者信息）
export interface UserSummary {
  id: string;
  nickname: string;
  avatar_url?: string;
  is_following?: boolean;
}

// 完整卡片
export interface LifeCard {
  id: string;
  creator_id: string;
  creator?: UserSummary;
  card_type: CardType;
  title: string;
  description: string;
  media: MediaItem[];
  location?: Location;
  emotion_tags: string[];
  interest_tags: string[];
  privacy_level: PrivacyLevel;
  exchange_price: number;
  like_count: number;
  comment_count: number;
  exchange_count: number;
  is_liked: boolean;
  is_collected: boolean;
  created_at: string;
  updated_at: string;
}

// 卡片摘要（用于列表展示）
export interface LifeCardSummary {
  id: string;
  creator_id: string;
  creator?: UserSummary;
  card_type: CardType;
  title: string;
  thumbnail_url?: string;
  like_count: number;
  comment_count: number;
  exchange_count: number;
  is_liked: boolean;
  created_at: string;
}

// 创建卡片数据
export interface CardCreateData {
  card_type: CardType;
  title: string;
  description: string;
  media?: MediaItem[];
  location?: Location;
  emotion_tags?: string[];
  interest_tags?: string[];
  privacy_level?: PrivacyLevel;
}

// 更新卡片数据
export interface CardUpdateData {
  title?: string;
  description?: string;
  media?: MediaItem[];
  location?: Location;
  emotion_tags?: string[];
  interest_tags?: string[];
  privacy_level?: PrivacyLevel;
}

// 搜索查询
export interface SearchQuery {
  keyword?: string;
  card_type?: CardType;
  interest_tags?: string[];
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}

// Feed 结果
export interface CardFeedResult {
  cards: LifeCard[];
  has_more: boolean;
  next_cursor?: string;
}

// 搜索结果
export interface CardSearchResult {
  cards: LifeCard[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// 评论
export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  user?: UserSummary;
  content: string;
  created_at: string;
}

// 文件夹
export interface CardFolder {
  id: string;
  user_id: string;
  name: string;
  card_count?: number;
  created_at: string;
}

// 点赞结果
export interface LikeResult {
  like_count: number;
  is_liked: boolean;
}
