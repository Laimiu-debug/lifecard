/**
 * Property-Based Tests for Notification Grouping
 * Feature: life-card-miniprogram, Property 17: Notification Grouping
 * Validates: Requirements 10.3
 */
import * as fc from 'fast-check';
import {
  groupNotificationsByType,
  isNotificationsSortedDescending,
  NOTIFICATION_TYPES,
  GROUP_CONFIG,
  TYPE_LABELS,
} from '../../utils/notification-grouping';
import type { Notification, NotificationType } from '../../types/api';

// Arbitrary for notification type
const notificationTypeArb: fc.Arbitrary<NotificationType> = fc.constantFrom(...NOTIFICATION_TYPES);

// Arbitrary for ISO date string within a reasonable range
const dateStringArb = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2025-12-31'),
}).map(d => d.toISOString());

// Arbitrary for a notification
const notificationArb: fc.Arbitrary<Notification> = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  type: notificationTypeArb,
  title: fc.string({ minLength: 1, maxLength: 100 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  related_id: fc.option(fc.uuid(), { nil: undefined }),
  related_type: fc.option(
    fc.constantFrom('card', 'user', 'exchange', 'comment') as fc.Arbitrary<'card' | 'user' | 'exchange' | 'comment'>,
    { nil: undefined }
  ),
  sender_id: fc.option(fc.uuid(), { nil: undefined }),
  sender: fc.option(
    fc.record({
      id: fc.uuid(),
      nickname: fc.string({ minLength: 1, maxLength: 50 }),
      avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
    }),
    { nil: undefined }
  ),
  is_read: fc.boolean(),
  created_at: dateStringArb,
});

// Arbitrary for array of notifications
const notificationsArb = fc.array(notificationArb, { minLength: 0, maxLength: 50 });

describe('Notification Grouping Properties', () => {
  /**
   * Property 17: Notification Grouping
   * Validates: Requirements 10.3
   * 
   * - Notifications SHALL be grouped by type (exchange, comment, like)
   * - Within each group, notifications SHALL be sorted by timestamp descending
   */
  describe('Grouping by Type (Requirements 10.3)', () => {
    it('should group all notifications by their type', () => {
      fc.assert(
        fc.property(
          notificationsArb,
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // All notifications should be present in some group
            const totalNotificationsInGroups = groups.reduce(
              (sum, g) => sum + g.notifications.length, 
              0
            );
            return totalNotificationsInGroups === notifications.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place each notification in the correct type group', () => {
      fc.assert(
        fc.property(
          notificationsArb,
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Each notification should be in the group matching its type
            for (const group of groups) {
              for (const notification of group.notifications) {
                if (notification.type !== group.type) {
                  return false;
                }
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not have duplicate notifications across groups', () => {
      fc.assert(
        fc.property(
          notificationsArb,
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Collect all notification IDs from groups
            const notificationIds = new Set<string>();
            for (const group of groups) {
              for (const notification of group.notifications) {
                if (notificationIds.has(notification.id)) {
                  return false; // Duplicate found
                }
                notificationIds.add(notification.id);
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only return groups with at least one notification', () => {
      fc.assert(
        fc.property(
          notificationsArb,
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // All returned groups should have notifications
            for (const group of groups) {
              if (group.notifications.length === 0) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sorting within Groups (Requirements 10.3)', () => {
    it('should sort notifications within each group by timestamp descending', () => {
      fc.assert(
        fc.property(
          notificationsArb.filter(n => n.length > 1),
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Each group's notifications should be sorted by timestamp descending
            for (const group of groups) {
              if (!isNotificationsSortedDescending(group.notifications)) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have newest notification first in each group', () => {
      fc.assert(
        fc.property(
          notificationsArb.filter(n => n.length > 1),
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            for (const group of groups) {
              if (group.notifications.length < 2) continue;
              
              const firstTime = new Date(group.notifications[0].created_at).getTime();
              const lastTime = new Date(
                group.notifications[group.notifications.length - 1].created_at
              ).getTime();
              
              // First notification should be newer or equal to last
              if (firstTime < lastTime) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Group Metadata (Requirements 10.3)', () => {
    it('should have valid type labels for each group', () => {
      fc.assert(
        fc.property(
          notificationsArb.filter(n => n.length > 0),
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Each group should have a valid title
            for (const group of groups) {
              if (!group.title || group.title.length === 0) {
                return false;
              }
              // Title should match the expected label for the type
              const expectedLabel = TYPE_LABELS[group.type];
              if (expectedLabel && group.title !== expectedLabel) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have correct unread count for each group', () => {
      fc.assert(
        fc.property(
          notificationsArb,
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Each group's unreadCount should match actual unread notifications
            for (const group of groups) {
              const actualUnread = group.notifications.filter(n => !n.is_read).length;
              if (group.unreadCount !== actualUnread) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have icon for each group', () => {
      fc.assert(
        fc.property(
          notificationsArb.filter(n => n.length > 0),
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Each group should have an icon
            for (const group of groups) {
              if (!group.icon || group.icon.length === 0) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Group Order Consistency', () => {
    it('should maintain consistent group order based on GROUP_CONFIG', () => {
      fc.assert(
        fc.property(
          notificationsArb.filter(n => n.length > 0),
          (notifications) => {
            const groups = groupNotificationsByType(notifications);
            
            // Get the expected order from GROUP_CONFIG
            const configOrder = GROUP_CONFIG.map(c => c.type);
            
            // Groups should appear in the same relative order as GROUP_CONFIG
            let lastConfigIndex = -1;
            for (const group of groups) {
              const configIndex = configOrder.indexOf(group.type);
              if (configIndex < lastConfigIndex) {
                return false; // Order violation
              }
              lastConfigIndex = configIndex;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
