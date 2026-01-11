/**
 * Card Grouping Utilities
 * Requirements: 8.6, 8.7 - 时间线和分类视图
 */
import type { CardType } from '../types/card';

// 卡片类型标签映射
export const cardTypeLabels: Record<string, string> = {
  day_card: '一天体验',
  week_card: '一周体验',
  fragment_card: '人生片段',
  moment_card: '重要时刻',
};

// 卡片类型图标映射
export const cardTypeIcons: Record<string, string> = {
  day_card: '📅',
  week_card: '📆',
  fragment_card: '🎬',
  moment_card: '⭐',
};

// 时间线分组项
export interface TimelineGroup {
  date: string;
  dateLabel: string;
  cards: FormattedCard[];
}

// 分类分组项
export interface CategoryGroup {
  cardType: CardType;
  typeLabel: string;
  typeIcon: string;
  count: number;
  cards: FormattedCard[];
}

// 格式化后的卡片（包含显示用的额外字段）
export interface FormattedCard {
  id: string;
  card_type: CardType;
  created_at: string;
  formattedDate: string;
  cardTypeLabel: string;
  [key: string]: unknown;
}

/**
 * 格式化日期键（用于分组）
 * @param date Date 对象
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期标签（用于显示）
 * @param date Date 对象
 * @returns 人性化的日期标签
 */
export function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const cardDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (cardDate.getTime() === today.getTime()) {
    return '今天';
  } else if (cardDate.getTime() === yesterday.getTime()) {
    return '昨天';
  } else if (cardDate.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } else {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
}

/**
 * 按日期分组卡片（时间线视图）
 * Requirements: 8.6 - 实现按日期分组
 * @param cards 卡片列表
 * @returns 按日期分组的卡片列表，按日期降序排序
 */
export function groupCardsByDate(cards: FormattedCard[]): TimelineGroup[] {
  const groups: Map<string, TimelineGroup> = new Map();
  
  for (const card of cards) {
    const date = new Date(card.created_at);
    const dateKey = formatDateKey(date);
    const dateLabel = formatDateLabel(date);
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        dateLabel,
        cards: [],
      });
    }
    
    groups.get(dateKey)!.cards.push(card);
  }
  
  // 按日期降序排序
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    return b.date.localeCompare(a.date);
  });
  
  return sortedGroups;
}

/**
 * 按类型分组卡片（分类视图）
 * Requirements: 8.7 - 实现按类型分组
 * @param cards 卡片列表
 * @returns 按类型分组的卡片列表，只返回有卡片的分组
 */
export function groupCardsByType(cards: FormattedCard[]): CategoryGroup[] {
  const groups: Map<CardType, CategoryGroup> = new Map();
  
  // 定义类型顺序
  const typeOrder: CardType[] = ['day_card', 'week_card', 'fragment_card', 'moment_card'];
  
  // 初始化所有类型分组
  for (const cardType of typeOrder) {
    groups.set(cardType, {
      cardType,
      typeLabel: cardTypeLabels[cardType] || cardType,
      typeIcon: cardTypeIcons[cardType] || '📄',
      count: 0,
      cards: [],
    });
  }
  
  // 将卡片分配到对应分组
  for (const card of cards) {
    const group = groups.get(card.card_type);
    if (group) {
      group.cards.push(card);
      group.count++;
    }
  }
  
  // 按预定义顺序返回，只返回有卡片的分组
  return typeOrder
    .map(type => groups.get(type)!)
    .filter(group => group.count > 0);
}
