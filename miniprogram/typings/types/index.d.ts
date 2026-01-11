/**
 * 微信小程序类型扩展
 */

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

// 卡片类型
type CardType = 'day_card' | 'week_card' | 'fragment_card' | 'moment_card';

// 隐私级别
type PrivacyLevel = 'public' | 'friends_only' | 'exchange_only';

// 交换状态
type ExchangeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

// 交易类型
type TransactionType = 'earn' | 'spend';

// 媒体类型
type MediaType = 'image' | 'video';

// 通知类型
type NotificationType = 'exchange' | 'comment' | 'like' | 'follow';

// 时间范围
type TimeRange = 'day' | 'week' | 'month';

// 声明全局命名空间
declare namespace LifeCard {
  // 媒体项
  interface MediaItem {
    id: string;
    media_type: MediaType;
    url: string;
    thumbnail_url?: string;
    width?: number;
    height?: number;
  }

  // 位置信息
  interface Location {
    name: string;
    latitude: number;
    longitude: number;
  }

  // 用户摘要
  interface UserSummary {
    id: string;
    nickname: string;
    avatar_url?: string;
  }

  // 用户资料
  interface UserProfile {
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
    created_at: string;
  }

  // 卡片
  interface Card {
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

  // 评论
  interface Comment {
    id: string;
    card_id: string;
    user_id: string;
    user?: UserSummary;
    content: string;
    created_at: string;
  }

  // 文件夹
  interface CardFolder {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
  }

  // 交换请求
  interface ExchangeRequest {
    id: string;
    requester_id: string;
    requester?: UserSummary;
    card_id: string;
    card?: Card;
    card_owner_id: string;
    status: ExchangeStatus;
    coin_cost: number;
    created_at: string;
    updated_at: string;
  }

  // 金币交易
  interface CoinTransaction {
    id: string;
    user_id: string;
    amount: number;
    transaction_type: TransactionType;
    description: string;
    created_at: string;
  }

  // 通知
  interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    content: string;
    related_id?: string;
    is_read: boolean;
    created_at: string;
  }

  // API 响应
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error_code?: string;
  }

  // 分页结果
  interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    has_more: boolean;
  }

  // Feed 结果
  interface FeedResult {
    cards: Card[];
    has_more: boolean;
    next_cursor?: string;
  }

  // 搜索查询
  interface SearchQuery {
    keyword?: string;
    card_type?: CardType;
    interest_tags?: string[];
    latitude?: number;
    longitude?: number;
    radius_km?: number;
  }
}
