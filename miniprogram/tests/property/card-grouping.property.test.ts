/**
 * Property-Based Tests for Card Grouping Correctness
 * Feature: life-card-miniprogram, Property 13: Card Grouping Correctness
 * Validates: Requirements 8.6, 8.7
 */
import * as fc from 'fast-check';
import {
  groupCardsByDate,
  groupCardsByType,
  formatDateKey,
  cardTypeLabels,
  FormattedCard,
} from '../../utils/card-grouping';
import type { CardType } from '../../types/card';

// Card types for testing
const CARD_TYPES: CardType[] = ['day_card', 'week_card', 'fragment_card', 'moment_card'];

// Arbitrary for card type
const cardTypeArb = fc.constantFrom(...CARD_TYPES);

// Arbitrary for ISO date string within a reasonable range
const dateStringArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2025-12-31'),
}).map(d => d.toISOString());

// Arbitrary for a formatted card (as used by grouping functions)
const formattedCardArb: fc.Arbitrary<FormattedCard> = fc.record({
  id: fc.uuid(),
  card_type: cardTypeArb,
  created_at: dateStringArb,
  formattedDate: fc.string({ minLength: 1, maxLength: 20 }),
  cardTypeLabel: fc.constantFrom(...Object.values(cardTypeLabels)),
});

// Arbitrary for array of formatted cards
const formattedCardsArb = fc.array(formattedCardArb, { minLength: 0, maxLength: 50 });

describe('Card Grouping Correctness Properties', () => {
  /**
   * Property 13.1: Timeline view SHALL group cards by date (created_at) in descending order
   * Validates: Requirements 8.6
   */
  describe('Timeline View Grouping (Requirements 8.6)', () => {
    it('should group all cards by their creation date', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByDate(cards);
            
            // All cards should be present in some group
            const totalCardsInGroups = groups.reduce((sum, g) => sum + g.cards.length, 0);
            return totalCardsInGroups === cards.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have groups sorted by date in descending order', () => {
      fc.assert(
        fc.property(
          formattedCardsArb.filter(cards => cards.length > 1),
          (cards) => {
            const groups = groupCardsByDate(cards);
            
            // Check that groups are sorted in descending order by date
            for (let i = 0; i < groups.length - 1; i++) {
              if (groups[i].date < groups[i + 1].date) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place each card in the correct date group', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByDate(cards);
            
            // Each card should be in the group matching its created_at date
            for (const group of groups) {
              for (const card of group.cards) {
                const expectedDateKey = formatDateKey(new Date(card.created_at));
                if (group.date !== expectedDateKey) {
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

    it('should not have duplicate cards across groups', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByDate(cards);
            
            // Collect all card IDs from groups
            const cardIds = new Set<string>();
            for (const group of groups) {
              for (const card of group.cards) {
                if (cardIds.has(card.id)) {
                  return false; // Duplicate found
                }
                cardIds.add(card.id);
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13.2: Category view SHALL group cards by card_type with correct counts
   * Validates: Requirements 8.7
   */
  describe('Category View Grouping (Requirements 8.7)', () => {
    it('should group all cards by their card type', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByType(cards);
            
            // All cards should be present in some group
            const totalCardsInGroups = groups.reduce((sum, g) => sum + g.cards.length, 0);
            return totalCardsInGroups === cards.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have correct count for each category group', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByType(cards);
            
            // Each group's count should match the actual number of cards
            for (const group of groups) {
              if (group.count !== group.cards.length) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place each card in the correct type group', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByType(cards);
            
            // Each card should be in the group matching its card_type
            for (const group of groups) {
              for (const card of group.cards) {
                if (card.card_type !== group.cardType) {
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

    it('should only return groups with at least one card', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByType(cards);
            
            // All returned groups should have count > 0
            for (const group of groups) {
              if (group.count === 0 || group.cards.length === 0) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not have duplicate cards across groups', () => {
      fc.assert(
        fc.property(
          formattedCardsArb,
          (cards) => {
            const groups = groupCardsByType(cards);
            
            // Collect all card IDs from groups
            const cardIds = new Set<string>();
            for (const group of groups) {
              for (const card of group.cards) {
                if (cardIds.has(card.id)) {
                  return false; // Duplicate found
                }
                cardIds.add(card.id);
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid type labels for each group', () => {
      fc.assert(
        fc.property(
          formattedCardsArb.filter(cards => cards.length > 0),
          (cards) => {
            const groups = groupCardsByType(cards);
            
            // Each group should have a valid type label
            for (const group of groups) {
              if (!group.typeLabel || group.typeLabel.length === 0) {
                return false;
              }
              // Type label should match the expected label for the card type
              const expectedLabel = cardTypeLabels[group.cardType];
              if (expectedLabel && group.typeLabel !== expectedLabel) {
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
});
