/**
 * 交换服务
 * 实现交换请求、接受、拒绝等接口
 * 
 * Requirements: 7.1, 7.3, 7.6
 */

import { request } from './request';
import type {
  ExchangeRequest,
  ExchangeResult,
  ExchangeListResult,
  ExchangeHistoryResult,
  ExchangeStats,
  PriceInfo,
} from '../types/exchange';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * 交换服务类
 * 封装所有交换相关的 API 调用
 */
class ExchangeService {
  // ==================== 交换请求操作 ====================

  /**
   * 创建交换请求
   * 
   * Requirements: 7.1, 7.3
   * @param cardId 卡片 ID
   * @param message 可选的留言
   * @returns 创建的交换请求
   */
  async createExchangeRequest(cardId: string, message?: string): Promise<ExchangeRequest> {
    try {
      const data: Record<string, any> = { card_id: cardId };
      if (message) {
        data.message = message;
      }
      const result = await request.post<ExchangeRequest>('/api/exchanges', data);
      return result;
    } catch (error) {
      console.error('Create exchange request failed:', error);
      throw error;
    }
  }

  /**
   * 接受交换请求
   * 
   * Requirements: 7.6
   * @param exchangeId 交换请求 ID
   * @returns 交换结果
   */
  async acceptExchange(exchangeId: string): Promise<ExchangeResult> {
    try {
      const result = await request.post<ExchangeResult>(`/api/exchanges/${exchangeId}/accept`);
      return result;
    } catch (error) {
      console.error('Accept exchange failed:', error);
      throw error;
    }
  }

  /**
   * 拒绝交换请求
   * 
   * Requirements: 7.6
   * @param exchangeId 交换请求 ID
   */
  async rejectExchange(exchangeId: string): Promise<void> {
    try {
      await request.post<void>(`/api/exchanges/${exchangeId}/reject`);
    } catch (error) {
      console.error('Reject exchange failed:', error);
      throw error;
    }
  }

  /**
   * 取消交换请求（由请求者取消）
   * 
   * @param exchangeId 交换请求 ID
   */
  async cancelExchange(exchangeId: string): Promise<void> {
    try {
      await request.post<void>(`/api/exchanges/${exchangeId}/cancel`);
    } catch (error) {
      console.error('Cancel exchange failed:', error);
      throw error;
    }
  }

  // ==================== 交换请求查询 ====================

  /**
   * 获取待处理的交换请求（收到的）
   * 
   * Requirements: 7.6
   * @returns 待处理请求列表
   */
  async getPendingRequests(): Promise<ExchangeListResult> {
    try {
      const result = await request.get<ExchangeListResult>('/api/exchanges/pending');
      return result;
    } catch (error) {
      console.error('Get pending requests failed:', error);
      throw error;
    }
  }

  /**
   * 获取已发送的交换请求
   * 
   * @returns 已发送请求列表
   */
  async getSentRequests(): Promise<ExchangeListResult> {
    try {
      const result = await request.get<ExchangeListResult>('/api/exchanges/sent');
      return result;
    } catch (error) {
      console.error('Get sent requests failed:', error);
      throw error;
    }
  }

  /**
   * 获取交换历史
   * 
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 交换历史分页结果
   */
  async getExchangeHistory(
    page: number = 1,
    pageSize: number = 20
  ): Promise<ExchangeHistoryResult> {
    try {
      const result = await request.get<ExchangeHistoryResult>('/api/exchanges/history', {
        page,
        page_size: pageSize,
      });
      return result;
    } catch (error) {
      console.error('Get exchange history failed:', error);
      throw error;
    }
  }

  /**
   * 获取交换统计
   * 
   * @returns 交换统计数据
   */
  async getExchangeStats(): Promise<ExchangeStats> {
    try {
      const stats = await request.get<ExchangeStats>('/api/exchanges/stats');
      return stats;
    } catch (error) {
      console.error('Get exchange stats failed:', error);
      throw error;
    }
  }

  // ==================== 价格查询 ====================

  /**
   * 获取交换价格
   * 
   * Requirements: 7.1
   * @param cardId 卡片 ID
   * @returns 价格信息
   */
  async getExchangePrice(cardId: string): Promise<PriceInfo> {
    try {
      const priceInfo = await request.get<PriceInfo>(`/api/exchanges/price/${cardId}`);
      return priceInfo;
    } catch (error) {
      console.error('Get exchange price failed:', error);
      throw error;
    }
  }

  // ==================== 交换详情 ====================

  /**
   * 获取交换请求详情
   * 
   * @param exchangeId 交换请求 ID
   * @returns 交换请求详情
   */
  async getExchangeDetail(exchangeId: string): Promise<ExchangeRequest> {
    try {
      const exchange = await request.get<ExchangeRequest>(`/api/exchanges/${exchangeId}`);
      return exchange;
    } catch (error) {
      console.error('Get exchange detail failed:', error);
      throw error;
    }
  }
}

// 导出单例
export const exchangeService = new ExchangeService();

// 导出类以便测试
export { ExchangeService };
