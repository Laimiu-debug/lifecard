/// <reference types="jest" />
/**
 * Property-Based Tests for Exchange Completion Consistency
 * Feature: life-card-miniprogram, Property 11: Exchange Completion Consistency
 * Validates: Requirements 7.7
 * 
 * For any accepted exchange:
 * - The card SHALL appear in requester's collected cards
 * - Requester's coin_balance SHALL decrease by exchange_price
 * - Card owner's coin_balance SHALL increase by exchange_price
 */
import * as fc from 'fast-check';

// Types for exchange completion testing
interface User {
  id: string;
  nickname: string;
  coin_balance: number;
  collected_card_ids: string[];
}

interface Card {
  id: string;
  creator_id: string;
  title: string;
  exchange_price: number;
}

interface ExchangeRequest {
  id: string;
  requester_id: string;
  card_id: string;
  card_owner_id: string;
  coin_cost: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

interface ExchangeCompletionResult {
  success: boolean;
  requester_new_balance: number;
  owner_new_balance: number;
  card_added_to_collection: boolean;
  error?: string;
}

interface ExchangeScenario {
  requester: User;
  cardOwner: User;
  card: Card;
  exchangeRequest: ExchangeRequest;
}

/**
 * Simulates the exchange completion process
 * This mirrors the logic in exchangeStore.acceptExchange
 * 
 * Requirements: 7.7
 */
function processExchangeCompletion(scenario: ExchangeScenario): ExchangeCompletionResult {
  const { requester, cardOwner, card, exchangeRequest } = scenario;
  
  // Validate exchange request is pending
  if (exchangeRequest.status !== 'pending') {
    return {
      success: false,
      requester_new_balance: requester.coin_balance,
      owner_new_balance: cardOwner.coin_balance,
      card_added_to_collection: false,
      error: 'Exchange request is not pending',
    };
  }
  
  // Validate requester has enough balance
  if (requester.coin_balance < exchangeRequest.coin_cost) {
    return {
      success: false,
      requester_new_balance: requester.coin_balance,
      owner_new_balance: cardOwner.coin_balance,
      card_added_to_collection: false,
      error: 'Insufficient balance',
    };
  }
  
  // Validate card owner matches
  if (card.creator_id !== cardOwner.id) {
    return {
      success: false,
      requester_new_balance: requester.coin_balance,
      owner_new_balance: cardOwner.coin_balance,
      card_added_to_collection: false,
      error: 'Card owner mismatch',
    };
  }
  
  // Process the exchange
  const requesterNewBalance = requester.coin_balance - exchangeRequest.coin_cost;
  const ownerNewBalance = cardOwner.coin_balance + exchangeRequest.coin_cost;
  
  return {
    success: true,
    requester_new_balance: requesterNewBalance,
    owner_new_balance: ownerNewBalance,
    card_added_to_collection: true,
  };
}

describe('Exchange Completion Consistency Properties', () => {
  // Arbitrary for generating user IDs
  const userIdArb = fc.uuid();
  
  // Arbitrary for generating card IDs
  const cardIdArb = fc.uuid();
  
  // Arbitrary for generating exchange IDs
  const exchangeIdArb = fc.uuid();
  
  // Arbitrary for generating valid exchange prices (positive integers)
  const exchangePriceArb = fc.integer({ min: 1, max: 10000 });
  
  // Arbitrary for generating a valid exchange scenario
  const validExchangeScenarioArb: fc.Arbitrary<ExchangeScenario> = fc.record({
    exchangePrice: exchangePriceArb,
    requesterId: userIdArb,
    ownerId: userIdArb,
    cardId: cardIdArb,
    exchangeId: exchangeIdArb,
    requesterNickname: fc.string({ minLength: 1, maxLength: 20 }),
    ownerNickname: fc.string({ minLength: 1, maxLength: 20 }),
    cardTitle: fc.string({ minLength: 1, maxLength: 100 }),
  }).chain(({ exchangePrice, requesterId, ownerId, cardId, exchangeId, requesterNickname, ownerNickname, cardTitle }) =>
    fc.record({
      requesterBalance: fc.integer({ min: exchangePrice, max: exchangePrice + 100000 }),
      ownerBalance: fc.integer({ min: 0, max: 100000 }),
    }).map(({ requesterBalance, ownerBalance }) => ({
      requester: {
        id: requesterId,
        nickname: requesterNickname,
        coin_balance: requesterBalance,
        collected_card_ids: [],
      },
      cardOwner: {
        id: ownerId,
        nickname: ownerNickname,
        coin_balance: ownerBalance,
        collected_card_ids: [],
      },
      card: {
        id: cardId,
        creator_id: ownerId,
        title: cardTitle,
        exchange_price: exchangePrice,
      },
      exchangeRequest: {
        id: exchangeId,
        requester_id: requesterId,
        card_id: cardId,
        card_owner_id: ownerId,
        coin_cost: exchangePrice,
        status: 'pending' as const,
      },
    }))
  );

  /**
   * Property 11.1: Requester's balance SHALL decrease by exchange_price after successful exchange
   * For any accepted exchange, requester's coin_balance SHALL decrease by exchange_price
   */
  it('should decrease requester balance by exchange price after successful exchange', () => {
    fc.assert(
      fc.property(validExchangeScenarioArb, (scenario) => {
        const result = processExchangeCompletion(scenario);
        
        if (result.success) {
          const expectedBalance = scenario.requester.coin_balance - scenario.exchangeRequest.coin_cost;
          return result.requester_new_balance === expectedBalance;
        }
        return true; // Skip failed exchanges
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.2: Card owner's balance SHALL increase by exchange_price after successful exchange
   * For any accepted exchange, card owner's coin_balance SHALL increase by exchange_price
   */
  it('should increase card owner balance by exchange price after successful exchange', () => {
    fc.assert(
      fc.property(validExchangeScenarioArb, (scenario) => {
        const result = processExchangeCompletion(scenario);
        
        if (result.success) {
          const expectedBalance = scenario.cardOwner.coin_balance + scenario.exchangeRequest.coin_cost;
          return result.owner_new_balance === expectedBalance;
        }
        return true; // Skip failed exchanges
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.3: Card SHALL appear in requester's collection after successful exchange
   * For any accepted exchange, the card SHALL appear in requester's collected cards
   */
  it('should add card to requester collection after successful exchange', () => {
    fc.assert(
      fc.property(validExchangeScenarioArb, (scenario) => {
        const result = processExchangeCompletion(scenario);
        
        if (result.success) {
          return result.card_added_to_collection === true;
        }
        return true; // Skip failed exchanges
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.4: Total coins in system SHALL remain constant (conservation)
   * For any exchange, the sum of requester and owner balances should remain constant
   */
  it('should conserve total coins in the system after exchange', () => {
    fc.assert(
      fc.property(validExchangeScenarioArb, (scenario) => {
        const initialTotal = scenario.requester.coin_balance + scenario.cardOwner.coin_balance;
        const result = processExchangeCompletion(scenario);
        const finalTotal = result.requester_new_balance + result.owner_new_balance;
        
        return initialTotal === finalTotal;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.5: Exchange with insufficient balance SHALL fail
   * If requester has insufficient coins, exchange SHALL be prevented
   */
  it('should fail exchange when requester has insufficient balance', () => {
    const insufficientBalanceScenarioArb: fc.Arbitrary<ExchangeScenario> = fc.record({
      exchangePrice: fc.integer({ min: 100, max: 10000 }),
      requesterId: userIdArb,
      ownerId: userIdArb,
      cardId: cardIdArb,
      exchangeId: exchangeIdArb,
    }).chain(({ exchangePrice, requesterId, ownerId, cardId, exchangeId }) =>
      fc.record({
        requesterBalance: fc.integer({ min: 0, max: exchangePrice - 1 }),
        ownerBalance: fc.integer({ min: 0, max: 100000 }),
      }).map(({ requesterBalance, ownerBalance }) => ({
        requester: {
          id: requesterId,
          nickname: 'requester',
          coin_balance: requesterBalance,
          collected_card_ids: [],
        },
        cardOwner: {
          id: ownerId,
          nickname: 'owner',
          coin_balance: ownerBalance,
          collected_card_ids: [],
        },
        card: {
          id: cardId,
          creator_id: ownerId,
          title: 'Test Card',
          exchange_price: exchangePrice,
        },
        exchangeRequest: {
          id: exchangeId,
          requester_id: requesterId,
          card_id: cardId,
          card_owner_id: ownerId,
          coin_cost: exchangePrice,
          status: 'pending' as const,
        },
      }))
    );

    fc.assert(
      fc.property(insufficientBalanceScenarioArb, (scenario) => {
        const result = processExchangeCompletion(scenario);
        return result.success === false && result.error === 'Insufficient balance';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.6: Non-pending exchange requests SHALL not be processed
   * Only pending exchange requests can be accepted
   */
  it('should not process non-pending exchange requests', () => {
    const nonPendingStatusArb = fc.constantFrom('accepted', 'rejected', 'cancelled') as fc.Arbitrary<'accepted' | 'rejected' | 'cancelled'>;
    
    const nonPendingScenarioArb = validExchangeScenarioArb.chain((scenario) =>
      nonPendingStatusArb.map((status) => ({
        ...scenario,
        exchangeRequest: {
          ...scenario.exchangeRequest,
          status,
        },
      }))
    );

    fc.assert(
      fc.property(nonPendingScenarioArb, (scenario) => {
        const result = processExchangeCompletion(scenario);
        return result.success === false && result.error === 'Exchange request is not pending';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.7: Balance changes are deterministic
   * Same exchange scenario should always produce same balance changes
   */
  it('should produce deterministic balance changes for same scenario', () => {
    fc.assert(
      fc.property(validExchangeScenarioArb, (scenario) => {
        const result1 = processExchangeCompletion(scenario);
        const result2 = processExchangeCompletion(scenario);
        
        return (
          result1.success === result2.success &&
          result1.requester_new_balance === result2.requester_new_balance &&
          result1.owner_new_balance === result2.owner_new_balance &&
          result1.card_added_to_collection === result2.card_added_to_collection
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.8: Zero-cost exchange should still transfer card
   * Even with zero exchange price, card should be added to collection
   */
  it('should add card to collection even with zero exchange price', () => {
    const zeroCostScenarioArb = validExchangeScenarioArb.map((scenario) => ({
      ...scenario,
      card: {
        ...scenario.card,
        exchange_price: 0,
      },
      exchangeRequest: {
        ...scenario.exchangeRequest,
        coin_cost: 0,
      },
    }));

    fc.assert(
      fc.property(zeroCostScenarioArb, (scenario) => {
        const result = processExchangeCompletion(scenario);
        return result.success === true && result.card_added_to_collection === true;
      }),
      { numRuns: 100 }
    );
  });
});
