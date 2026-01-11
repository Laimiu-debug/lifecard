/**
 * Property-Based Tests for Card Creation Validation
 * Feature: life-card-miniprogram, Property 3: Card Creation Validation
 * Validates: Requirements 3.2, 3.3, 3.4, 3.6, 3.8
 */
import * as fc from 'fast-check';
import { Validator, ValidationLimits, CardCreateData, CardType, MediaItem } from '../../utils/validator';

describe('Card Creation Validation Properties', () => {
  const validator = new Validator();
  const validCardTypes: CardType[] = ['day_card', 'week_card', 'fragment_card', 'moment_card'];

  // Arbitrary for valid card type
  const cardTypeArb = fc.constantFrom(...validCardTypes);

  // Arbitrary for valid title (1-200 chars, non-whitespace)
  const validTitleArb = fc.string({ minLength: 1, maxLength: ValidationLimits.TITLE_MAX_LENGTH })
    .filter(s => s.trim().length > 0);

  // Arbitrary for valid description (non-empty, non-whitespace)
  const validDescriptionArb = fc.string({ minLength: 1, maxLength: ValidationLimits.DESCRIPTION_MAX_LENGTH })
    .filter(s => s.trim().length > 0);

  // Arbitrary for media item
  const imageMediaArb: fc.Arbitrary<MediaItem> = fc.record({
    id: fc.uuid(),
    media_type: fc.constant('image' as const),
    url: fc.webUrl(),
  });

  const videoMediaArb: fc.Arbitrary<MediaItem> = fc.record({
    id: fc.uuid(),
    media_type: fc.constant('video' as const),
    url: fc.webUrl(),
  });

  // Arbitrary for valid images (0-9)
  const validImagesArb = fc.array(imageMediaArb, { minLength: 0, maxLength: ValidationLimits.MAX_MEDIA_COUNT });

  // Arbitrary for tags
  const tagArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
  const validEmotionTagsArb = fc.array(tagArb, { minLength: 0, maxLength: ValidationLimits.MAX_EMOTION_TAGS });
  const validInterestTagsArb = fc.array(tagArb, { minLength: 0, maxLength: ValidationLimits.MAX_INTEREST_TAGS });

  /**
   * Property 3.1: Missing card_type SHALL cause validation failure
   * Validates: Requirement 3.2
   */
  it('should fail validation when card_type is missing', () => {
    fc.assert(
      fc.property(
        validTitleArb,
        validDescriptionArb,
        (title, description) => {
          const data: CardCreateData = { title, description };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'card_type' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.2: Empty or whitespace-only title SHALL cause validation failure
   * Validates: Requirement 3.3
   */
  it('should fail validation when title is empty or whitespace-only', () => {
    const emptyOrWhitespaceArb = fc.oneof(
      fc.constant(''),
      fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')).filter(s => s.length > 0)
    );

    fc.assert(
      fc.property(
        cardTypeArb,
        emptyOrWhitespaceArb,
        validDescriptionArb,
        (card_type, title, description) => {
          const data: CardCreateData = { card_type, title, description };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'title' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: Title exceeding 200 characters SHALL cause validation failure
   * Validates: Requirement 3.3
   */
  it('should fail validation when title exceeds max length', () => {
    const longTitleArb = fc.string({ 
      minLength: ValidationLimits.TITLE_MAX_LENGTH + 1, 
      maxLength: ValidationLimits.TITLE_MAX_LENGTH + 100 
    });

    fc.assert(
      fc.property(
        cardTypeArb,
        longTitleArb,
        validDescriptionArb,
        (card_type, title, description) => {
          const data: CardCreateData = { card_type, title, description };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'title' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.4: Empty or whitespace-only description SHALL cause validation failure
   * Validates: Requirement 3.3
   */
  it('should fail validation when description is empty or whitespace-only', () => {
    const emptyOrWhitespaceArb = fc.oneof(
      fc.constant(''),
      fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')).filter(s => s.length > 0)
    );

    fc.assert(
      fc.property(
        cardTypeArb,
        validTitleArb,
        emptyOrWhitespaceArb,
        (card_type, title, description) => {
          const data: CardCreateData = { card_type, title, description };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'description' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.5: More than 9 images SHALL cause validation failure
   * Validates: Requirement 3.4
   */
  it('should fail validation when media exceeds 9 images', () => {
    const tooManyImagesArb = fc.array(imageMediaArb, { 
      minLength: ValidationLimits.MAX_MEDIA_COUNT + 1, 
      maxLength: ValidationLimits.MAX_MEDIA_COUNT + 5 
    });

    fc.assert(
      fc.property(
        cardTypeArb,
        validTitleArb,
        validDescriptionArb,
        tooManyImagesArb,
        (card_type, title, description, media) => {
          const data: CardCreateData = { card_type, title, description, media };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'media' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.6: More than 1 video SHALL cause validation failure
   * Validates: Requirement 3.4
   */
  it('should fail validation when media contains more than 1 video', () => {
    const multipleVideosArb = fc.array(videoMediaArb, { minLength: 2, maxLength: 5 });

    fc.assert(
      fc.property(
        cardTypeArb,
        validTitleArb,
        validDescriptionArb,
        multipleVideosArb,
        (card_type, title, description, media) => {
          const data: CardCreateData = { card_type, title, description, media };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'media' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.7: More than 10 emotion_tags SHALL cause validation failure
   * Validates: Requirement 3.6
   */
  it('should fail validation when emotion_tags exceeds 10', () => {
    const tooManyTagsArb = fc.array(tagArb, { 
      minLength: ValidationLimits.MAX_EMOTION_TAGS + 1, 
      maxLength: ValidationLimits.MAX_EMOTION_TAGS + 5 
    });

    fc.assert(
      fc.property(
        cardTypeArb,
        validTitleArb,
        validDescriptionArb,
        tooManyTagsArb,
        (card_type, title, description, emotion_tags) => {
          const data: CardCreateData = { card_type, title, description, emotion_tags };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'emotion_tags' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.8: More than 10 interest_tags SHALL cause validation failure
   * Validates: Requirement 3.6
   */
  it('should fail validation when interest_tags exceeds 10', () => {
    const tooManyTagsArb = fc.array(tagArb, { 
      minLength: ValidationLimits.MAX_INTEREST_TAGS + 1, 
      maxLength: ValidationLimits.MAX_INTEREST_TAGS + 5 
    });

    fc.assert(
      fc.property(
        cardTypeArb,
        validTitleArb,
        validDescriptionArb,
        tooManyTagsArb,
        (card_type, title, description, interest_tags) => {
          const data: CardCreateData = { card_type, title, description, interest_tags };
          const result = validator.validateCardCreate(data);
          return !result.valid && 'interest_tags' in result.errors;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.9: Valid card data SHALL pass validation
   * Validates: Requirement 3.8
   */
  it('should pass validation when all constraints are satisfied', () => {
    fc.assert(
      fc.property(
        cardTypeArb,
        validTitleArb,
        validDescriptionArb,
        fc.option(validImagesArb, { nil: undefined }),
        fc.option(validEmotionTagsArb, { nil: undefined }),
        fc.option(validInterestTagsArb, { nil: undefined }),
        (card_type, title, description, media, emotion_tags, interest_tags) => {
          const data: CardCreateData = { 
            card_type, 
            title, 
            description,
            media,
            emotion_tags,
            interest_tags,
          };
          const result = validator.validateCardCreate(data);
          return result.valid && Object.keys(result.errors).length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
