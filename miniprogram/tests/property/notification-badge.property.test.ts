/**
 * Property-Based Tests for Notification Badge Accuracy
 * Feature: life-card-miniprogram, Property 16: Notification Badge Accuracy
 * Validates: Requirements 10.1
 */
import * as fc from 'fast-check';
import {
  computeBadgeDisplay,
  computeBadgeFromUnreadCount,
  shouldShowBadge,
  formatBadgeText,
  isBadgeResultConsistent,
  MAX_BADGE_DISPLAY,
  OVERFLOW_TEXT,
} from '../../utils/notification-badge';
import type { UnreadCount } from '../../types/api';

// Arbitrary for non-negative integers (unread counts)
const unreadCountArb = fc.nat({ max: 1000 });

// Arbitrary for zero count
const zeroCountArb = fc.constant(0);

// Arbitrary for positive count (1 to 99)
const smallPositiveCountArb = fc.integer({ min: 1, max: MAX_BADGE_DISPLAY });

// Arbitrary for large count (> 99)
const largeCountArb = fc.integer({ min: MAX_BADGE_DISPLAY + 1, max: 10000 });

// Arbitrary for UnreadCount object
const unreadCountObjArb: fc.Arbitrary<UnreadCount> = fc.record({
  total: unreadCountArb,
  exchange: unreadCountArb,
  comment: unreadCountArb,
  like: unreadCountArb,
  follow: unreadCountArb,
  system: unreadCountArb,
});

describe('Notification Badge Accuracy Properties', () => {
  /**
   * Property 16: Notification Badge Accuracy
   * Validates: Requirements 10.1
   * 
   * - If unread_count > 0, badge SHALL be visible with correct count
   * - If unread_count = 0, badge SHALL NOT be visible
   */
  describe('Badge Visibility (Requirements 10.1)', () => {
    it('should NOT show badge when unread_count is 0', () => {
      fc.assert(
        fc.property(
          zeroCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return result.visible === false && result.text === '';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show badge when unread_count > 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (count) => {
            const result = computeBadgeDisplay(count);
            return result.visible === true && result.text.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent visibility based on count', () => {
      fc.assert(
        fc.property(
          unreadCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            // Visibility should match whether count > 0
            return result.visible === (count > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Badge Text Accuracy (Requirements 10.1)', () => {
    it('should display exact count when count <= 99', () => {
      fc.assert(
        fc.property(
          smallPositiveCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return result.text === String(count);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display "99+" when count > 99', () => {
      fc.assert(
        fc.property(
          largeCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return result.text === OVERFLOW_TEXT;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve original count in result', () => {
      fc.assert(
        fc.property(
          unreadCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return result.count === count;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Badge Result Consistency (Requirements 10.1)', () => {
    it('should always produce consistent badge results', () => {
      fc.assert(
        fc.property(
          unreadCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return isBadgeResultConsistent(result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - same input produces same output', () => {
      fc.assert(
        fc.property(
          unreadCountArb,
          (count) => {
            const result1 = computeBadgeDisplay(count);
            const result2 = computeBadgeDisplay(count);
            return (
              result1.visible === result2.visible &&
              result1.text === result2.text &&
              result1.count === result2.count
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('UnreadCount Object Integration (Requirements 10.1)', () => {
    it('should compute badge from UnreadCount object using total', () => {
      fc.assert(
        fc.property(
          unreadCountObjArb,
          (unreadCount) => {
            const result = computeBadgeFromUnreadCount(unreadCount);
            const directResult = computeBadgeDisplay(unreadCount.total);
            return (
              result.visible === directResult.visible &&
              result.text === directResult.text &&
              result.count === directResult.count
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show badge only when total > 0 regardless of individual counts', () => {
      fc.assert(
        fc.property(
          unreadCountObjArb,
          (unreadCount) => {
            const result = computeBadgeFromUnreadCount(unreadCount);
            return result.visible === (unreadCount.total > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Helper Functions (Requirements 10.1)', () => {
    it('shouldShowBadge should match computeBadgeDisplay visibility', () => {
      fc.assert(
        fc.property(
          unreadCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return shouldShowBadge(count) === result.visible;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('formatBadgeText should match computeBadgeDisplay text', () => {
      fc.assert(
        fc.property(
          unreadCountArb,
          (count) => {
            const result = computeBadgeDisplay(count);
            return formatBadgeText(count) === result.text;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases (Requirements 10.1)', () => {
    it('should handle negative counts by treating as 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),
          (negativeCount) => {
            const result = computeBadgeDisplay(negativeCount);
            // Negative counts should be treated as 0
            return result.visible === false && result.count === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle floating point counts by flooring', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),
          (floatCount) => {
            const result = computeBadgeDisplay(floatCount);
            const expectedCount = Math.max(0, Math.floor(floatCount));
            return result.count === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary value 99 correctly', () => {
      const result = computeBadgeDisplay(99);
      expect(result.visible).toBe(true);
      expect(result.text).toBe('99');
    });

    it('should handle boundary value 100 correctly', () => {
      const result = computeBadgeDisplay(100);
      expect(result.visible).toBe(true);
      expect(result.text).toBe(OVERFLOW_TEXT);
    });
  });
});
