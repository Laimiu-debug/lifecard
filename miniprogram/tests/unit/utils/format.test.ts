/**
 * Format 工具测试
 */
import {
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatCount,
  formatCoins,
  formatFileSize,
  truncateText,
  formatTransactionDisplay,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_ICONS,
} from '../../../utils/format';

describe('Format Utils', () => {
  describe('formatDate', () => {
    it('should format date string correctly', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should format Date object correctly', () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date);
      expect(result).toBe('2024-01-15');
    });

    it('should include time when showTime is true', () => {
      const date = new Date(2024, 0, 15, 10, 30);
      const result = formatDate(date, { showTime: true });
      expect(result).toBe('2024-01-15 10:30');
    });

    it('should include seconds when showSeconds is true', () => {
      const date = new Date(2024, 0, 15, 10, 30, 45);
      const result = formatDate(date, { showTime: true, showSeconds: true });
      expect(result).toBe('2024-01-15 10:30:45');
    });

    it('should return empty string for invalid date', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "刚刚" for recent time', () => {
      const date = new Date(Date.now() - 30 * 1000); // 30秒前
      const result = formatRelativeTime(date);
      expect(result).toBe('刚刚');
    });

    it('should return minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000); // 5分钟前
      const result = formatRelativeTime(date);
      expect(result).toBe('5分钟前');
    });

    it('should return hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3小时前
      const result = formatRelativeTime(date);
      expect(result).toBe('3小时前');
    });

    it('should return days ago', () => {
      const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5天前
      const result = formatRelativeTime(date);
      expect(result).toBe('5天前');
    });
  });


  describe('formatNumber', () => {
    it('should format number with thousand separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format number with decimals', () => {
      expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    });

    it('should return "0" for NaN', () => {
      expect(formatNumber(NaN)).toBe('0');
    });
  });

  describe('formatCount', () => {
    it('should return number as is for small counts', () => {
      expect(formatCount(999)).toBe('999');
    });

    it('should format thousands with k', () => {
      expect(formatCount(1500)).toBe('1.5k');
    });

    it('should format ten thousands with 万', () => {
      expect(formatCount(15000)).toBe('1.5万');
    });

    it('should format hundred millions with 亿', () => {
      expect(formatCount(150000000)).toBe('1.5亿');
    });

    it('should return "0" for negative or NaN', () => {
      expect(formatCount(-1)).toBe('0');
      expect(formatCount(NaN)).toBe('0');
    });
  });

  describe('formatCoins', () => {
    it('should format coins without sign by default', () => {
      expect(formatCoins(100)).toBe('100');
    });

    it('should format coins with positive sign', () => {
      expect(formatCoins(100, true)).toBe('+100');
    });

    it('should format coins with negative sign', () => {
      expect(formatCoins(-100, true)).toBe('-100');
    });

    it('should return "0" for NaN', () => {
      expect(formatCoins(NaN)).toBe('0');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1536)).toBe('1.50 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1572864)).toBe('1.50 MB');
    });

    it('should return "0 B" for invalid input', () => {
      expect(formatFileSize(NaN)).toBe('0 B');
      expect(formatFileSize(-1)).toBe('0 B');
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('short', 10)).toBe('short');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncateText('this is a long text', 10)).toBe('this is...');
    });

    it('should use custom suffix', () => {
      expect(truncateText('this is a long text', 10, '…')).toBe('this is a…');
    });

    it('should return empty string for empty input', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  /**
   * 交易记录显示格式化测试
   * Requirements: 11.5
   */
  describe('formatTransactionDisplay', () => {
    it('should format earn transaction with positive sign', () => {
      const transaction = {
        amount: 100,
        transaction_type: 'earn' as const,
        created_at: '2024-01-15T10:30:00Z',
      };
      
      const result = formatTransactionDisplay(transaction);
      
      expect(result.formattedAmount).toBe('+100');
      expect(result.isEarn).toBe(true);
      expect(result.typeLabel).toBe('获得');
      expect(result.typeIcon).toBe('📈');
    });

    it('should format spend transaction with negative sign', () => {
      const transaction = {
        amount: 50,
        transaction_type: 'spend' as const,
        created_at: '2024-01-15T14:20:00Z',
      };
      
      const result = formatTransactionDisplay(transaction);
      
      expect(result.formattedAmount).toBe('-50');
      expect(result.isEarn).toBe(false);
      expect(result.typeLabel).toBe('消费');
      expect(result.typeIcon).toBe('📉');
    });

    it('should format date with time', () => {
      const transaction = {
        amount: 100,
        transaction_type: 'earn' as const,
        created_at: '2024-01-15T10:30:00Z',
      };
      
      const result = formatTransactionDisplay(transaction);
      
      // Should contain date and time
      expect(result.formattedDate).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('should format large amounts with thousand separators', () => {
      const transaction = {
        amount: 12345,
        transaction_type: 'earn' as const,
        created_at: '2024-01-15T10:30:00Z',
      };
      
      const result = formatTransactionDisplay(transaction);
      
      expect(result.formattedAmount).toBe('+12,345');
    });
  });

  describe('TRANSACTION_TYPE_LABELS', () => {
    it('should have correct labels', () => {
      expect(TRANSACTION_TYPE_LABELS.earn).toBe('获得');
      expect(TRANSACTION_TYPE_LABELS.spend).toBe('消费');
    });
  });

  describe('TRANSACTION_TYPE_ICONS', () => {
    it('should have correct icons', () => {
      expect(TRANSACTION_TYPE_ICONS.earn).toBe('📈');
      expect(TRANSACTION_TYPE_ICONS.spend).toBe('📉');
    });
  });
});
