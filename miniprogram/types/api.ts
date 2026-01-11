/**
 * API 响应类型定义
 * Life Card 微信小程序
 */

// 通用 API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
}

// 分页结果
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// 游标分页结果
export interface CursorPaginatedResult<T> {
  items: T[];
  has_more: boolean;
  next_cursor?: string;
}

// 错误码枚举
export enum ErrorCode {
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // 认证错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // 权限错误
  FORBIDDEN = 'FORBIDDEN',
  
  // 资源错误
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMS = 'INVALID_PARAMS',
  
  // 业务错误
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  EXCHANGE_NOT_ALLOWED = 'EXCHANGE_NOT_ALLOWED',
  CARD_NOT_AVAILABLE = 'CARD_NOT_AVAILABLE',
  ALREADY_COLLECTED = 'ALREADY_COLLECTED',
  CANNOT_EXCHANGE_OWN_CARD = 'CANNOT_EXCHANGE_OWN_CARD',
  
  // 服务器错误
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// 应用错误
export interface AppError {
  code: ErrorCode | string;
  message: string;
  details?: Record<string, string>;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// 请求配置
export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: Record<string, unknown>;
  params?: Record<string, string | number | boolean>;
  header?: Record<string, string>;
  needAuth?: boolean;
  timeout?: number;
}

// 通知类型
export type NotificationType = 'exchange_request' | 'exchange_accepted' | 'exchange_rejected' | 'comment' | 'like' | 'follow' | 'system';

// 通知
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  content: string;
  related_id?: string;
  related_type?: 'card' | 'user' | 'exchange' | 'comment';
  sender_id?: string;
  sender?: {
    id: string;
    nickname: string;
    avatar_url?: string;
  };
  is_read: boolean;
  created_at: string;
}

// 通知列表结果
export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unread_count: number;
  has_more: boolean;
}

// 未读计数
export interface UnreadCount {
  total: number;
  exchange: number;
  comment: number;
  like: number;
  follow: number;
  system: number;
}

// 上传结果
export interface UploadResult {
  url: string;
  file_id: string;
  thumbnail_url?: string;
}

// 批量上传结果
export interface BatchUploadResult {
  success: UploadResult[];
  failed: Array<{
    index: number;
    error: string;
  }>;
}
