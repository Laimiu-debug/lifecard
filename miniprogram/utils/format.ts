/**
 * 格式化工具
 * 提供日期、数字等格式化功能
 */

/**
 * 日期格式化选项
 */
export interface DateFormatOptions {
  showTime?: boolean;
  showSeconds?: boolean;
  relative?: boolean;
}

/**
 * 格式化日期
 * @param date 日期字符串或 Date 对象
 * @param options 格式化选项
 */
export function formatDate(
  date: string | Date | number,
  options: DateFormatOptions = {}
): string {
  const { showTime = false, showSeconds = false, relative = false } = options;
  
  const d = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;
  
  if (isNaN(d.getTime())) {
    return '';
  }

  // 相对时间格式化
  if (relative) {
    return formatRelativeTime(d);
  }

  const year = d.getFullYear();
  const month = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  
  let result = `${year}-${month}-${day}`;
  
  if (showTime) {
    const hours = padZero(d.getHours());
    const minutes = padZero(d.getMinutes());
    result += ` ${hours}:${minutes}`;
    
    if (showSeconds) {
      const seconds = padZero(d.getSeconds());
      result += `:${seconds}`;
    }
  }
  
  return result;
}


/**
 * 格式化相对时间
 * @param date Date 对象
 */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 30) {
    return `${days}天前`;
  } else if (months < 12) {
    return `${months}个月前`;
  } else {
    return `${years}年前`;
  }
}

/**
 * 数字补零
 */
function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * 格式化数字（添加千分位分隔符）
 * @param num 数字
 * @param decimals 小数位数
 */
export function formatNumber(num: number, decimals: number = 0): string {
  if (isNaN(num)) return '0';
  
  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return parts.join('.');
}

/**
 * 格式化计数（简化大数字显示）
 * @param count 计数
 */
export function formatCount(count: number): string {
  if (isNaN(count) || count < 0) return '0';
  
  if (count < 1000) {
    return count.toString();
  } else if (count < 10000) {
    return `${(count / 1000).toFixed(1)}k`;
  } else if (count < 100000000) {
    return `${(count / 10000).toFixed(1)}万`;
  } else {
    return `${(count / 100000000).toFixed(1)}亿`;
  }
}

/**
 * 格式化金币数量
 * @param coins 金币数量
 * @param showSign 是否显示正负号
 */
export function formatCoins(coins: number, showSign: boolean = false): string {
  if (isNaN(coins)) return '0';
  
  const formatted = formatNumber(Math.abs(coins));
  
  if (showSign) {
    if (coins > 0) {
      return `+${formatted}`;
    } else if (coins < 0) {
      return `-${formatted}`;
    }
  }
  
  return formatted;
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 */
export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * 截断文本
 * @param text 文本
 * @param maxLength 最大长度
 * @param suffix 后缀
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 交易类型标签映射
 */
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  earn: '获得',
  spend: '消费',
};

/**
 * 交易类型图标映射
 */
export const TRANSACTION_TYPE_ICONS: Record<string, string> = {
  earn: '📈',
  spend: '📉',
};

/**
 * 格式化后的交易记录显示数据
 * Requirements: 11.5
 */
export interface FormattedTransactionDisplay {
  /** 格式化后的金额（带+/-符号） */
  formattedAmount: string;
  /** 格式化后的日期时间 */
  formattedDate: string;
  /** 交易类型标签 */
  typeLabel: string;
  /** 交易类型图标 */
  typeIcon: string;
  /** 是否为收入 */
  isEarn: boolean;
}

/**
 * 交易记录输入数据
 */
export interface TransactionInput {
  amount: number;
  transaction_type: 'earn' | 'spend';
  created_at: string;
}

/**
 * 格式化交易记录显示
 * 将交易记录转换为显示所需的格式化数据
 * 
 * Requirements: 11.5
 * Property 18: Transaction Display Completeness
 * 
 * @param transaction 交易记录
 * @returns 格式化后的显示数据
 */
export function formatTransactionDisplay(transaction: TransactionInput): FormattedTransactionDisplay {
  const isEarn = transaction.transaction_type === 'earn';
  
  // 格式化金额：收入为正数显示+，支出为负数显示-
  const signedAmount = isEarn ? transaction.amount : -transaction.amount;
  const formattedAmount = formatCoins(signedAmount, true);
  
  // 格式化日期时间
  const formattedDate = formatDate(transaction.created_at, { showTime: true });
  
  // 获取类型标签和图标
  const typeLabel = TRANSACTION_TYPE_LABELS[transaction.transaction_type] || transaction.transaction_type;
  const typeIcon = TRANSACTION_TYPE_ICONS[transaction.transaction_type] || '💰';
  
  return {
    formattedAmount,
    formattedDate,
    typeLabel,
    typeIcon,
    isEarn,
  };
}
