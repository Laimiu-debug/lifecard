/**
 * 类型定义统一导出
 * Life Card 微信小程序
 */

// 卡片相关类型
export type {
  CardType,
  PrivacyLevel,
  MediaType,
  TimeRange,
  MediaItem,
  Location,
  LifeCard,
  LifeCardSummary,
  CardCreateData,
  CardUpdateData,
  SearchQuery,
  CardFeedResult,
  CardSearchResult,
  Comment,
  CardFolder,
  LikeResult,
} from './card';

// 用户相关类型
export type {
  TransactionType,
  UserProfile,
  UserSummary,
  ProfileUpdateData,
  CoinTransaction,
  FollowUser,
  FollowListResult,
  LoginResult,
  TokenData,
  UserStats,
} from './user';

// 交换相关类型
export type {
  ExchangeStatus,
  ExchangeRequest,
  ExchangeResult,
  PriceInfo,
  ExchangeCreateData,
  ExchangeRecord,
  ExchangeListResult,
  ExchangeHistoryResult,
  ExchangeStats,
} from './exchange';

// API 相关类型
export type {
  ApiResponse,
  PaginatedResult,
  CursorPaginatedResult,
  AppError,
  ValidationResult,
  RequestConfig,
  NotificationType,
  Notification,
  NotificationListResult,
  UnreadCount,
  UploadResult,
  BatchUploadResult,
} from './api';

export { ErrorCode } from './api';
