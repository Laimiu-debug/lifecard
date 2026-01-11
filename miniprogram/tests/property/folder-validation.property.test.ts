/**
 * Property-Based Tests for Folder Name Validation
 * Feature: life-card-miniprogram, Property 12: Folder Name Validation
 * Validates: Requirements 8.3
 */
import * as fc from 'fast-check';
import { Validator, ValidationLimits } from '../../utils/validator';

describe('Folder Name Validation Properties', () => {
  const validator = new Validator();

  // Arbitrary for empty or whitespace-only strings
  const emptyOrWhitespaceArb = fc.oneof(
    fc.constant(''),
    fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')).filter(s => s.length > 0)
  );

  // Arbitrary for valid folder names (1-50 chars, non-whitespace content)
  const validFolderNameArb = fc.string({ minLength: 1, maxLength: ValidationLimits.FOLDER_NAME_MAX_LENGTH })
    .filter(s => s.trim().length > 0);

  // Arbitrary for folder names exceeding max length
  const longFolderNameArb = fc.string({
    minLength: ValidationLimits.FOLDER_NAME_MAX_LENGTH + 1,
    maxLength: ValidationLimits.FOLDER_NAME_MAX_LENGTH + 50
  });

  /**
   * Property 12.1: Empty or whitespace-only folder name SHALL cause validation failure
   * Validates: Requirements 8.3
   */
  it('should fail validation when folder name is empty or whitespace-only', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        (name) => {
          const result = validator.validateFolderName(name);
          return !result.valid && 'name' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.2: Folder name exceeding max length SHALL cause validation failure
   * Validates: Requirements 8.3
   */
  it('should fail validation when folder name exceeds max length', () => {
    fc.assert(
      fc.property(
        longFolderNameArb,
        (name) => {
          const result = validator.validateFolderName(name);
          return !result.valid && 'name' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.3: Valid folder name SHALL pass validation
   * Validates: Requirements 8.3
   */
  it('should pass validation when folder name is valid', () => {
    fc.assert(
      fc.property(
        validFolderNameArb,
        (name) => {
          const result = validator.validateFolderName(name);
          return result.valid && Object.keys(result.errors).length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
