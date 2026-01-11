/**
 * Property-Based Tests for Comment Content Validation
 * Feature: life-card-miniprogram, Property 8: Comment Content Validation
 * Validates: Requirements 6.5
 */
import * as fc from 'fast-check';
import { Validator, ValidationLimits } from '../../utils/validator';

describe('Comment Content Validation Properties', () => {
  const validator = new Validator();

  // Arbitrary for valid comment content (1-500 chars, non-whitespace)
  const validCommentArb = fc.string({ minLength: 1, maxLength: ValidationLimits.COMMENT_MAX_LENGTH })
    .filter(s => s.trim().length > 0);

  // Arbitrary for empty or whitespace-only content
  const emptyOrWhitespaceArb = fc.oneof(
    fc.constant(''),
    fc.constant(null as unknown as string),
    fc.constant(undefined as unknown as string),
    fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')).filter(s => s.length > 0)
  );

  // Arbitrary for content exceeding max length
  const tooLongCommentArb = fc.string({
    minLength: ValidationLimits.COMMENT_MAX_LENGTH + 1,
    maxLength: ValidationLimits.COMMENT_MAX_LENGTH + 200
  });

  /**
   * Property 8.1: Empty or whitespace-only content SHALL cause validation failure
   * Validates: Requirement 6.5
   * 
   * For any comment submission with empty or whitespace-only content,
   * the validation SHALL fail with a content error.
   */
  it('should fail validation when content is empty or whitespace-only', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        (content) => {
          const result = validator.validateComment(content);
          return !result.valid && 'content' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: Content exceeding max length SHALL cause validation failure
   * Validates: Requirement 6.5
   * 
   * For any comment content that exceeds the maximum allowed length (500 chars),
   * the validation SHALL fail with a content error.
   */
  it('should fail validation when content exceeds max length', () => {
    fc.assert(
      fc.property(
        tooLongCommentArb,
        (content) => {
          const result = validator.validateComment(content);
          return !result.valid && 'content' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: Valid content SHALL pass validation
   * Validates: Requirement 6.5
   * 
   * For any valid comment content (non-empty, non-whitespace, within length limit),
   * the validation SHALL pass with no errors.
   */
  it('should pass validation when content is valid', () => {
    fc.assert(
      fc.property(
        validCommentArb,
        (content) => {
          const result = validator.validateComment(content);
          return result.valid && Object.keys(result.errors).length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: Validation result consistency
   * Validates: Requirement 6.5
   * 
   * For any content, the validation result SHALL be consistent:
   * - valid === true implies errors is empty
   * - valid === false implies errors is non-empty
   */
  it('should have consistent validation result structure', () => {
    const anyContentArb = fc.oneof(
      validCommentArb,
      emptyOrWhitespaceArb,
      tooLongCommentArb
    );

    fc.assert(
      fc.property(
        anyContentArb,
        (content) => {
          const result = validator.validateComment(content);
          const hasErrors = Object.keys(result.errors).length > 0;
          // valid should be true iff there are no errors
          return result.valid === !hasErrors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.5: Boundary length validation
   * Validates: Requirement 6.5
   * 
   * Content at exactly max length SHALL pass, content at max length + 1 SHALL fail.
   */
  it('should correctly handle boundary length cases', () => {
    // Generate content at exactly max length
    const exactMaxLengthArb = fc.string({ 
      minLength: ValidationLimits.COMMENT_MAX_LENGTH, 
      maxLength: ValidationLimits.COMMENT_MAX_LENGTH 
    }).filter(s => s.trim().length > 0);

    // Generate content at max length + 1
    const oneOverMaxArb = fc.string({
      minLength: ValidationLimits.COMMENT_MAX_LENGTH + 1,
      maxLength: ValidationLimits.COMMENT_MAX_LENGTH + 1
    });

    // Exact max length should pass
    fc.assert(
      fc.property(
        exactMaxLengthArb,
        (content) => {
          const result = validator.validateComment(content);
          return result.valid;
        }
      ),
      { numRuns: 50 }
    );

    // One over max length should fail
    fc.assert(
      fc.property(
        oneOverMaxArb,
        (content) => {
          const result = validator.validateComment(content);
          return !result.valid && 'content' in result.errors;
        }
      ),
      { numRuns: 50 }
    );
  });
});
