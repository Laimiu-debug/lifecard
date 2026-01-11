/**
 * Property-Based Tests for Profile Validation
 * Feature: life-card-miniprogram, Property 2: Profile Validation Completeness
 * Validates: Requirements 2.3, 2.5
 */
import * as fc from 'fast-check';
import { Validator, ValidationLimits, ProfileUpdateData } from '../../utils/validator';

describe('Profile Validation Properties', () => {
  const validator = new Validator();

  // Arbitrary for valid nickname (1-50 chars, non-whitespace)
  const validNicknameArb = fc.string({ minLength: 1, maxLength: ValidationLimits.NICKNAME_MAX_LENGTH })
    .filter(s => s.trim().length > 0);

  // Arbitrary for valid bio (0-500 chars)
  const validBioArb = fc.string({ minLength: 0, maxLength: ValidationLimits.BIO_MAX_LENGTH });

  // Arbitrary for empty or whitespace-only strings
  const emptyOrWhitespaceArb = fc.oneof(
    fc.constant(''),
    fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')).filter(s => s.length > 0)
  );

  /**
   * Property 2.1: Empty or whitespace-only nickname SHALL cause validation failure
   * Validates: Requirements 2.3, 2.5
   */
  it('should fail validation when nickname is empty or whitespace-only', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        (nickname) => {
          const data: ProfileUpdateData = { nickname };
          const result = validator.validateProfileUpdate(data);
          return !result.valid && 'nickname' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.2: Nickname exceeding max length SHALL cause validation failure
   * Validates: Requirements 2.3, 2.5
   */
  it('should fail validation when nickname exceeds max length', () => {
    const longNicknameArb = fc.string({
      minLength: ValidationLimits.NICKNAME_MAX_LENGTH + 1,
      maxLength: ValidationLimits.NICKNAME_MAX_LENGTH + 50
    });

    fc.assert(
      fc.property(
        longNicknameArb,
        (nickname) => {
          const data: ProfileUpdateData = { nickname };
          const result = validator.validateProfileUpdate(data);
          return !result.valid && 'nickname' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.3: Bio exceeding max length SHALL cause validation failure
   * Validates: Requirements 2.3, 2.5
   */
  it('should fail validation when bio exceeds max length', () => {
    const longBioArb = fc.string({
      minLength: ValidationLimits.BIO_MAX_LENGTH + 1,
      maxLength: ValidationLimits.BIO_MAX_LENGTH + 100
    });

    fc.assert(
      fc.property(
        longBioArb,
        (bio) => {
          const data: ProfileUpdateData = { bio };
          const result = validator.validateProfileUpdate(data);
          return !result.valid && 'bio' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.4: Valid profile data SHALL pass validation
   * Validates: Requirements 2.3, 2.5
   */
  it('should pass validation when all constraints are satisfied', () => {
    fc.assert(
      fc.property(
        fc.option(validNicknameArb, { nil: undefined }),
        fc.option(validBioArb, { nil: undefined }),
        fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
        (nickname, bio, age_range, location) => {
          const data: ProfileUpdateData = { nickname, bio, age_range, location };
          const result = validator.validateProfileUpdate(data);
          return result.valid && Object.keys(result.errors).length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.5: Validation SHALL return errors for ALL invalid fields simultaneously
   * Validates: Requirements 2.3, 2.5
   */
  it('should return errors for all invalid fields when multiple fields are invalid', () => {
    const longNicknameArb = fc.string({
      minLength: ValidationLimits.NICKNAME_MAX_LENGTH + 1,
      maxLength: ValidationLimits.NICKNAME_MAX_LENGTH + 50
    });
    const longBioArb = fc.string({
      minLength: ValidationLimits.BIO_MAX_LENGTH + 1,
      maxLength: ValidationLimits.BIO_MAX_LENGTH + 100
    });

    fc.assert(
      fc.property(
        longNicknameArb,
        longBioArb,
        (nickname, bio) => {
          const data: ProfileUpdateData = { nickname, bio };
          const result = validator.validateProfileUpdate(data);
          return !result.valid && 
                 'nickname' in result.errors && 
                 'bio' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });
});
