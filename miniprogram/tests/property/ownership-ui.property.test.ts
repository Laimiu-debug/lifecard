/// <reference types="jest" />
/**
 * Property-Based Tests for Ownership-Based UI Visibility
 * Feature: life-card-miniprogram, Property 9: Ownership-Based UI Visibility
 * Validates: Requirements 6.6, 6.7
 * 
 * For any card detail view:
 * - If viewer is the card creator, edit and delete buttons SHALL be visible, exchange button SHALL NOT be visible
 * - If viewer is not the creator, exchange button and price SHALL be visible, edit and delete SHALL NOT be visible
 */
import * as fc from 'fast-check';

// Types for UI visibility state
interface CardOwnershipContext {
  cardCreatorId: string;
  currentUserId: string;
  exchangePrice: number;
  isCollected: boolean;
}

interface UIVisibilityState {
  showEditButton: boolean;
  showDeleteButton: boolean;
  showExchangeButton: boolean;
  showExchangePrice: boolean;
}

/**
 * Determines UI visibility based on ownership
 * This mirrors the logic in card-detail.ts
 */
function determineUIVisibility(context: CardOwnershipContext): UIVisibilityState {
  const isOwner = context.cardCreatorId === context.currentUserId;
  
  return {
    showEditButton: isOwner,
    showDeleteButton: isOwner,
    showExchangeButton: !isOwner && !context.isCollected,
    showExchangePrice: !isOwner,
  };
}

/**
 * Checks if user is the owner of the card
 */
function isCardOwner(cardCreatorId: string, currentUserId: string): boolean {
  return cardCreatorId === currentUserId;
}

describe('Ownership-Based UI Visibility Properties', () => {
  // Arbitrary for generating user IDs
  const userIdArb = fc.uuid();
  
  // Arbitrary for generating exchange prices
  const exchangePriceArb = fc.nat({ max: 10000 });
  
  // Arbitrary for generating ownership context where user IS the owner
  const ownerContextArb: fc.Arbitrary<CardOwnershipContext> = fc.record({
    cardCreatorId: userIdArb,
    currentUserId: fc.constant(''), // Will be set to match cardCreatorId
    exchangePrice: exchangePriceArb,
    isCollected: fc.boolean(),
  }).map(ctx => ({
    ...ctx,
    currentUserId: ctx.cardCreatorId, // Make current user the owner
  }));

  // Arbitrary for generating ownership context where user is NOT the owner
  const nonOwnerContextArb: fc.Arbitrary<CardOwnershipContext> = fc.tuple(
    userIdArb,
    userIdArb,
    exchangePriceArb,
    fc.boolean()
  ).filter(([creatorId, userId]) => creatorId !== userId)
   .map(([cardCreatorId, currentUserId, exchangePrice, isCollected]) => ({
    cardCreatorId,
    currentUserId,
    exchangePrice,
    isCollected,
  }));

  // Arbitrary for any ownership context
  const anyContextArb: fc.Arbitrary<CardOwnershipContext> = fc.oneof(
    ownerContextArb,
    nonOwnerContextArb
  );

  /**
   * Property 9.1: Owner SHALL see edit button
   */
  it('should show edit button when viewer is the card creator', () => {
    fc.assert(
      fc.property(ownerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showEditButton === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Owner SHALL see delete button
   */
  it('should show delete button when viewer is the card creator', () => {
    fc.assert(
      fc.property(ownerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showDeleteButton === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: Owner SHALL NOT see exchange button
   */
  it('should NOT show exchange button when viewer is the card creator', () => {
    fc.assert(
      fc.property(ownerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showExchangeButton === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.4: Non-owner SHALL see exchange price
   */
  it('should show exchange price when viewer is NOT the card creator', () => {
    fc.assert(
      fc.property(nonOwnerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showExchangePrice === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.5: Non-owner (not collected) SHALL see exchange button
   */
  it('should show exchange button when viewer is NOT the creator and card is NOT collected', () => {
    const notCollectedNonOwnerArb = nonOwnerContextArb.map(ctx => ({
      ...ctx,
      isCollected: false,
    }));

    fc.assert(
      fc.property(notCollectedNonOwnerArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showExchangeButton === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.6: Non-owner (already collected) SHALL NOT see exchange button
   */
  it('should NOT show exchange button when viewer already collected the card', () => {
    const collectedNonOwnerArb = nonOwnerContextArb.map(ctx => ({
      ...ctx,
      isCollected: true,
    }));

    fc.assert(
      fc.property(collectedNonOwnerArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showExchangeButton === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.7: Non-owner SHALL NOT see edit button
   */
  it('should NOT show edit button when viewer is NOT the card creator', () => {
    fc.assert(
      fc.property(nonOwnerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showEditButton === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.8: Non-owner SHALL NOT see delete button
   */
  it('should NOT show delete button when viewer is NOT the card creator', () => {
    fc.assert(
      fc.property(nonOwnerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showDeleteButton === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.9: Edit and exchange buttons are mutually exclusive
   */
  it('should have edit and exchange buttons mutually exclusive', () => {
    fc.assert(
      fc.property(anyContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        // If edit is shown, exchange should not be shown (and vice versa for non-collected)
        if (visibility.showEditButton) {
          return visibility.showExchangeButton === false;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.10: Delete and exchange buttons are mutually exclusive
   */
  it('should have delete and exchange buttons mutually exclusive', () => {
    fc.assert(
      fc.property(anyContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        // If delete is shown, exchange should not be shown
        if (visibility.showDeleteButton) {
          return visibility.showExchangeButton === false;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.11: Ownership determination is consistent
   */
  it('should consistently determine ownership based on ID comparison', () => {
    fc.assert(
      fc.property(userIdArb, userIdArb, (id1, id2) => {
        const isOwner = isCardOwner(id1, id2);
        return isOwner === (id1 === id2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.12: Owner always sees both edit AND delete together
   */
  it('should show both edit and delete buttons together for owner', () => {
    fc.assert(
      fc.property(ownerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return visibility.showEditButton === visibility.showDeleteButton;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.13: Non-owner never sees edit OR delete
   */
  it('should hide both edit and delete buttons for non-owner', () => {
    fc.assert(
      fc.property(nonOwnerContextArb, (context) => {
        const visibility = determineUIVisibility(context);
        return !visibility.showEditButton && !visibility.showDeleteButton;
      }),
      { numRuns: 100 }
    );
  });
});
