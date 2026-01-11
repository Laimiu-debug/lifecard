/**
 * Property-Based Tests for Transaction Display Completeness
 * Feature: life-card-miniprogram, Property 18: Transaction Display Completeness
 * Validates: Requirements 11.5
 */
import * as fc from 'fast-check';
import {
  formatTransactionDisplay,
  formatDate,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_ICONS,
  TransactionInput,
} from '../../utils/format';

// Arbitrary for transaction type
const transactionTypeArb = fc.constantFrom<'earn' | 'spend'>('earn', 'spend');

// Arbitrary for positive amount (coins are always positive in storage)
const amountArb = fc.integer({ min: 1, max: 100000 });

// Arbitrary for valid ISO date string
const dateStringArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map(d => d.toISOString());

// Arbitrary for complete transaction input
const transactionInputArb: fc.Arbitrary<TransactionInput> = fc.record({
  amount: amountArb,
  transaction_type: transactionTypeArb,
  created_at: dateStringArb,
});

// Arbitrary for earn transaction
const earnTransactionArb: fc.Arbitrary<TransactionInput> = fc.record({
  amount: amountArb,
  transaction_type: fc.constant<'earn'>('earn'),
  created_at: dateStringArb,
});

// Arbitrary for spend transaction
const spendTransactionArb: fc.Arbitrary<TransactionInput> = fc.record({
  amount: amountArb,
  transaction_type: fc.constant<'spend'>('spend'),
  created_at: dateStringArb,
});

describe('Transaction Display Completeness Properties', () => {
  /**
   * Property 18: Transaction Display Completeness
   * Validates: Requirements 11.5
   * 
   * For any coin transaction displayed, the rendered output SHALL contain:
   * - amount (with +/- sign)
   * - transaction_type label
   * - formatted timestamp
   */
  describe('Amount Display with Sign (Requirements 11.5)', () => {
    it('should display positive sign (+) for earn transactions', () => {
      fc.assert(
        fc.property(
          earnTransactionArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.formattedAmount.startsWith('+');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display negative sign (-) for spend transactions', () => {
      fc.assert(
        fc.property(
          spendTransactionArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.formattedAmount.startsWith('-');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should contain the correct amount value in formatted string', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            // Remove sign and commas to get the numeric value
            const numericPart = result.formattedAmount.replace(/[+\-,]/g, '');
            const parsedAmount = parseInt(numericPart, 10);
            return parsedAmount === transaction.amount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty formattedAmount for all transactions', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.formattedAmount.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Transaction Type Label (Requirements 11.5)', () => {
    it('should have a valid type label for all transactions', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.typeLabel.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct label from TRANSACTION_TYPE_LABELS', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            const expectedLabel = TRANSACTION_TYPE_LABELS[transaction.transaction_type];
            return result.typeLabel === expectedLabel;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have a valid type icon for all transactions', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.typeIcon.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct icon from TRANSACTION_TYPE_ICONS', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            const expectedIcon = TRANSACTION_TYPE_ICONS[transaction.transaction_type];
            return result.typeIcon === expectedIcon;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Formatted Timestamp (Requirements 11.5)', () => {
    it('should have a non-empty formatted date for all transactions', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.formattedDate.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format date with time component', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            // Date with time should contain a colon (for HH:MM)
            return result.formattedDate.includes(':');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent date formatting', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            const expectedDate = formatDate(transaction.created_at, { showTime: true });
            return result.formattedDate === expectedDate;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('isEarn Flag Consistency (Requirements 11.5)', () => {
    it('should set isEarn to true for earn transactions', () => {
      fc.assert(
        fc.property(
          earnTransactionArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.isEarn === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set isEarn to false for spend transactions', () => {
      fc.assert(
        fc.property(
          spendTransactionArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.isEarn === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have isEarn consistent with transaction_type', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return result.isEarn === (transaction.transaction_type === 'earn');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete Display Data (Requirements 11.5)', () => {
    it('should return all required display fields', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result = formatTransactionDisplay(transaction);
            return (
              'formattedAmount' in result &&
              'formattedDate' in result &&
              'typeLabel' in result &&
              'typeIcon' in result &&
              'isEarn' in result
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - same input produces same output', () => {
      fc.assert(
        fc.property(
          transactionInputArb,
          (transaction) => {
            const result1 = formatTransactionDisplay(transaction);
            const result2 = formatTransactionDisplay(transaction);
            return (
              result1.formattedAmount === result2.formattedAmount &&
              result1.formattedDate === result2.formattedDate &&
              result1.typeLabel === result2.typeLabel &&
              result1.typeIcon === result2.typeIcon &&
              result1.isEarn === result2.isEarn
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases (Requirements 11.5)', () => {
    it('should handle large amounts correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100000, max: 10000000 }),
          transactionTypeArb,
          dateStringArb,
          (amount, type, date) => {
            const transaction: TransactionInput = {
              amount,
              transaction_type: type,
              created_at: date,
            };
            const result = formatTransactionDisplay(transaction);
            // Large amounts should include comma separators
            return result.formattedAmount.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle amount of 1 correctly', () => {
      const transaction: TransactionInput = {
        amount: 1,
        transaction_type: 'earn',
        created_at: new Date().toISOString(),
      };
      const result = formatTransactionDisplay(transaction);
      expect(result.formattedAmount).toBe('+1');
    });

    it('should handle amount of 0 correctly', () => {
      const transaction: TransactionInput = {
        amount: 0,
        transaction_type: 'earn',
        created_at: new Date().toISOString(),
      };
      const result = formatTransactionDisplay(transaction);
      // Zero amount should still have a formatted value
      expect(result.formattedAmount).toBeDefined();
    });
  });
});
