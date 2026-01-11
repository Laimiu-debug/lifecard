/**
 * 交换相关类型定义
 * Life Card 微信小程序
 */

import type { LifeCardSummary, UserSummary } from './card';

// 交换状态
export type ExchangeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

// 交换请求
export interface ExchangeRequest {
  id: string;
  requester_id: string;
  requester?: UserSummary;
  card_id: string;
  card?: LifeCardSummary;
  card_owner_id: string;
  card_owner?: UserSummary;
  status: ExchangeStatus;
  coin_cost: number;
  message?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

// 交换结果
export interface ExchangeResult {
  exchange_id: string;
  card_id: string;
  coins_transferred: number;
  requester_new_balance: number;
  owner_new_balance: number;
}

// 价格信息
export interface PriceInfo {
  base_price: number;
  popularity_bonus: number;
  total_price: number;
}

// 创建交换请求数据
export interface ExchangeCreateData {
  card_id: string;
  message?: string;
}

// 交换记录（历史）
export interface ExchangeRecord {
  id: string;
  card_id: string;
  card_title: string;
  card_thumbnail?: string;
  other_user_id: string;
  other_user_nickname: string;
  other_user_avatar?: string;
  direction: 'sent' | 'received';
  status: ExchangeStatus;
  coin_amount: number;
  created_at: string;
  completed_at?: string;
}

// 交换列表结果
export interface ExchangeListResult {
  exchanges: ExchangeRequest[];
  total: number;
  has_more: boolean;
}

// 交换历史结果
export interface ExchangeHistoryResult {
  records: ExchangeRecord[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// 交换统计
export interface ExchangeStats {
  total_sent: number;
  total_received: number;
  pending_sent: number;
  pending_received: number;
  completed: number;
}
