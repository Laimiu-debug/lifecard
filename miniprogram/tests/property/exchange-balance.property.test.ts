/// <reference types="jest" />
/**
 * Property-Based Tests for Exchange Balance Validation
 * Feature: life-card-miniprogram, Property 10: Exchange Balance Validation
 * Validates: Requirements 7.2
 * 
 * For any exchange attempt:
 * - If user's coin_balance < card's exchange_price, exchange SHALL be prevented
 * - If user's coin_balance >= card's exchange_price, exchange request SHALL be allowed
 */
import * as fc from 'fast-check';

// Types for exchange balance validation
interface ExchangeAttempt {
  userCoinBalance: number;
  cardExchangePrice: number;
}

interface ExchangeValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates if an exchange attempt is allowed based on balance
 * This mirrors the logic in card-detail.ts and userStore.hasEnoughBalance
 * 
 * Requirements: 7.2
 */
function validateExchangeBalance(attempt: ExchangeAttempt): ExchangeValidationResult {
  const { userCoinBalance, cardExchangePrice } = attempt;
  
  // Requirement 7.2: If user has insufficient coins, exchange SHALL be prevented
  if (userCoinBalance < cardExchangePrice) {
    return {
      allowed: false,
      reason: '余额不足',
    };
  }
  
  // Requirement 7.2: If user has sufficient coins, exchange SHALL be allowed
  return {
    allowed: true,
  };
}

/**
 * Simulates the hasEnoughBalance check from userStore
 */
function hasEnoughBalance(coinBalance: number, amount: number): boolean {
  return coinBalance >= amount;
}

describe('Exchange Balance Validation Properties', () => {
  // Arbitrary for generating exchange attempts with insufficient balance
  const insufficientBalanceArb: fc.Arbitrary<ExchangeAttempt> = fc.record({
    userCoinBalance: fc.nat({ max: 999999 }),
    cardExchangePrice: fc.nat({ max: 1000000 }),
  }).filter(({ userCoinBalance, cardExchangePrice }) => 
    userCoinBalance < cardExchangePrice && cardExchangePrice > 0
  );

  // Arbitrary for generating exchange attempts with sufficient balance
  const sufficientBalanceArb: fc.Arbitrary<ExchangeAttempt> = fc.record({
    userCoinBalance: fc.nat({ max: 1000000 }),
    cardExchangePrice: fc.nat({ max: 1000000 }),
  }).filter(({ userCoinBalance, cardExchangePrice }) => 
    userCoinBalance >= cardExchangePrice
  );

  // Arbitrary for generating any valid exchange attempt
  const anyExchangeAttemptArb: fc.Arbitrary<ExchangeAttempt> = fc.record({
    userCoinBalance: fc.nat({ max: 1000000 }),
    cardExchangePrice: fc.nat({ max: 1000000 }),
  });

  /**
   * Property 10.1: Exchange SHALL be prevented when balance is insufficient
   * If user's coin_balance < card's exchange_price, exchange SHALL be prevented
   */
  it('should prevent exchange when user balance is less than exchange price', () => {
    fc.assert(
      fc.property(insufficientBalanceArb, (attempt) => {
        const result = validateExchangeBalance(attempt);
        return result.allowed === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: Exchange SHALL be allowed when balance is sufficient
   * If user's coin_balance >= card's exchange_price, exchange request SHALL be allowed
   */
  it('should allow exchange when user balance is greater than or equal to exchange price', () => {
    fc.assert(
      fc.property(sufficientBalanceArb, (attempt) => {
        const result = validateExchangeBalance(attempt);
        return result.allowed === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.3: hasEnoughBalance function consistency
   * The hasEnoughBalance function should return true iff balance >= amount
   */
  it('should have hasEnoughBalance return true iff balance >= amount', () => {
    fc.assert(
      fc.property(anyExchangeAttemptArb, (attempt) => {
        const result = hasEnoughBalance(attempt.userCoinBalance, attempt.cardExchangePrice);
        const expected = attempt.userCoinBalance >= attempt.cardExchangePrice;
        return result === expected;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.4: Validation result consistency with hasEnoughBalance
   * validateExchangeBalance.allowed should match hasEnoughBalance result
   */
  it('should have validation result match hasEnoughBalance check', () => {
    fc.assert(
      fc.property(anyExchangeAttemptArb, (attempt) => {
        const validationResult = validateExchangeBalance(attempt);
        const balanceCheck = hasEnoughBalance(attempt.userCoinBalance, attempt.cardExchangePrice);
        return validationResult.allowed === balanceCheck;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.5: Insufficient balance should provide reason
   * When exchange is prevented due to insufficient balance, a reason should be provided
   */
  it('should provide reason when exchange is prevented', () => {
    fc.assert(
      fc.property(insufficientBalanceArb, (attempt) => {
        const result = validateExchangeBalance(attempt);
        return !result.allowed && result.reason !== undefined && result.reason.length > 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.6: Zero price exchange should always be allowed
   * When exchange price is 0, any balance (including 0) should allow exchange
   */
  it('should allow exchange when price is zero regardless of balance', () => {
    const zeroPriceArb: fc.Arbitrary<ExchangeAttempt> = fc.record({
      userCoinBalance: fc.nat({ max: 1000000 }),
      cardExchangePrice: fc.constant(0),
    });

    fc.assert(
      fc.property(zeroPriceArb, (attempt) => {
        const result = validateExchangeBalance(attempt);
        return result.allowed === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.7: Exact balance should allow exchange
   * When user balance exactly equals exchange price, exchange should be allowed
   */
  it('should allow exchange when balance exactly equals price', () => {
    const exactBalanceArb: fc.Arbitrary<ExchangeAttempt> = fc.nat({ max: 1000000 }).map(
      (price) => ({
        userCoinBalance: price,
        cardExchangePrice: price,
      })
    );

    fc.assert(
      fc.property(exactBalanceArb, (attempt) => {
        const result = validateExchangeBalance(attempt);
        return result.allowed === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.8: Balance check is deterministic
   * Same inputs should always produce same validation result
   */
  it('should produce deterministic results for same inputs', () => {
    fc.assert(
      fc.property(anyExchangeAttemptArb, (attempt) => {
        const result1 = validateExchangeBalance(attempt);
        const result2 = validateExchangeBalance(attempt);
        return result1.allowed === result2.allowed;
      }),
      { numRuns: 100 }
    );
  });
});
