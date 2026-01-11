/**
 * 通知徽章工具函数
 * Life Card 微信小程序
 * 
 * Requirements: 10.1
 */

import type { UnreadCount } from '../types/api';

// 徽章显示结果
export interface BadgeDisplayResult {
  /** 是否显示徽章 */
  visible: boolean;
  /** 徽章文本 (如 "5" 或 "99+") */
  text: string;
  /** 原始未读数 */
  count: number;
}

// 最大显示数量
export const MAX_BADGE_DISPLAY = 99;

// 超出最大数量时的显示文本
export const OVERFLOW_TEXT = '99+';

/**
 * 计算徽章显示状态
 * 
 * Requirements: 10.1
 * - If unread_count > 0, badge SHALL be visible with correct count
 * - If unread_count = 0, badge SHALL NOT be visible
 * 
 * @param unreadCount - 未读计数
 * @returns 徽章显示结果
 */
export function computeBadgeDisplay(unreadCount: number): BadgeDisplayResult {
  // 确保 count 是非负整数
  const count = Math.max(0, Math.floor(unreadCount));
  
  if (count === 0) {
    return {
      visible: false,
      text: '',
      count: 0,
    };
  }
  
  return {
    visible: true,
    text: count > MAX_BADGE_DISPLAY ? OVERFLOW_TEXT : String(count),
    count,
  };
}

/**
 * 从 UnreadCount 对象计算徽章显示状态
 * 
 * @param unreadCount - 未读计数对象
 * @returns 徽章显示结果
 */
export function computeBadgeFromUnreadCount(unreadCount: UnreadCount): BadgeDisplayResult {
  return computeBadgeDisplay(unreadCount.total);
}

/**
 * 检查徽章是否应该显示
 * 
 * @param unreadCount - 未读计数
 * @returns 是否应该显示徽章
 */
export function shouldShowBadge(unreadCount: number): boolean {
  return unreadCount > 0;
}

/**
 * 格式化徽章文本
 * 
 * @param count - 未读数量
 * @returns 格式化后的文本
 */
export function formatBadgeText(count: number): string {
  if (count <= 0) {
    return '';
  }
  return count > MAX_BADGE_DISPLAY ? OVERFLOW_TEXT : String(count);
}

/**
 * 验证徽章显示结果的一致性
 * 
 * @param result - 徽章显示结果
 * @returns 是否一致
 */
export function isBadgeResultConsistent(result: BadgeDisplayResult): boolean {
  // 如果 count 为 0，visible 应该为 false，text 应该为空
  if (result.count === 0) {
    return result.visible === false && result.text === '';
  }
  
  // 如果 count > 0，visible 应该为 true
  if (result.count > 0 && !result.visible) {
    return false;
  }
  
  // 如果 count > 99，text 应该为 "99+"
  if (result.count > MAX_BADGE_DISPLAY && result.text !== OVERFLOW_TEXT) {
    return false;
  }
  
  // 如果 count <= 99 且 count > 0，text 应该等于 count 的字符串形式
  if (result.count > 0 && result.count <= MAX_BADGE_DISPLAY && result.text !== String(result.count)) {
    return false;
  }
  
  return true;
}
