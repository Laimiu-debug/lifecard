/**
 * Property-Based Tests for Search Filter Application
 * Feature: life-card-miniprogram, Property 6: Search Filter Application
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6
 */
import * as fc from 'fast-check';
import { 
  SearchFilterValidator, 
  SearchLimits, 
  SearchQuery, 
  CardType 
} from '../../utils/validator';

describe('Search Filter Application Properties', () => {
  const searchValidator = new SearchFilterValidator();
  const validCardTypes: CardType[] = ['day_card', 'week_card', 'fragment_card', 'moment_card'];

  // Arbitrary for valid card type
  const cardTypeArb = fc.constantFrom(...validCardTypes);

  // Arbitrary for valid keyword (1-100 chars, non-whitespace)
  const validKeywordArb = fc.string({ minLength: 1, maxLength: SearchLimits.KEYWORD_MAX_LENGTH })
    .filter(s => s.trim().length > 0);

  // Arbitrary for tag
  const tagArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

  // Arbitrary for valid interest tags (1-5)
  const validInterestTagsArb = fc.array(tagArb, { minLength: 1, maxLength: SearchLimits.MAX_INTEREST_TAGS });

  // Arbitrary for valid latitude (-90 to 90)
  const validLatitudeArb = fc.double({ 
    min: SearchLimits.MIN_LATITUDE, 
    max: SearchLimits.MAX_LATITUDE,
    noNaN: true,
  });

  // Arbitrary for valid longitude (-180 to 180)
  const validLongitudeArb = fc.double({ 
    min: SearchLimits.MIN_LONGITUDE, 
    max: SearchLimits.MAX_LONGITUDE,
    noNaN: true,
  });

  // Arbitrary for valid radius (0.1 to 100 km)
  const validRadiusArb = fc.double({ 
    min: SearchLimits.MIN_RADIUS_KM, 
    max: SearchLimits.MAX_RADIUS_KM,
    noNaN: true,
  });



  /**
   * Property 6.1: Keyword search validation
   * If keyword is provided, it SHALL be validated for length
   * Validates: Requirement 5.2
   */
  describe('Keyword Search Validation (Requirement 5.2)', () => {
    it('should accept valid keywords within length limit', () => {
      fc.assert(
        fc.property(
          validKeywordArb,
          (keyword) => {
            const query: SearchQuery = { keyword };
            const result = searchValidator.validateSearchQuery(query);
            return result.valid && result.hasFilters && result.filterCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject keywords exceeding max length', () => {
      const longKeywordArb = fc.string({ 
        minLength: SearchLimits.KEYWORD_MAX_LENGTH + 1, 
        maxLength: SearchLimits.KEYWORD_MAX_LENGTH + 50 
      }).filter(s => s.trim().length > SearchLimits.KEYWORD_MAX_LENGTH);

      fc.assert(
        fc.property(
          longKeywordArb,
          (keyword) => {
            const query: SearchQuery = { keyword };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'keyword' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match results containing keyword in title or description', () => {
      fc.assert(
        fc.property(
          validKeywordArb,
          (keyword) => {
            // Create a card that contains the keyword in title
            const card = {
              id: 'test-id',
              title: `This is a title with ${keyword} in it`,
              description: 'Some description',
              card_type: 'day_card' as CardType,
              interest_tags: [],
            };
            const query: SearchQuery = { keyword };
            const matchResult = searchValidator.validateSearchResult(card, query);
            return matchResult.matches;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.2: Card type filter validation
   * If card_type is provided, results SHALL only include cards of that type
   * Validates: Requirement 5.3
   */
  describe('Card Type Filter Validation (Requirement 5.3)', () => {
    it('should accept valid card types', () => {
      fc.assert(
        fc.property(
          cardTypeArb,
          (card_type) => {
            const query: SearchQuery = { card_type };
            const result = searchValidator.validateSearchQuery(query);
            return result.valid && result.hasFilters && result.filterCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid card types', () => {
      const invalidTypeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !validCardTypes.includes(s as CardType) && s.trim().length > 0);

      fc.assert(
        fc.property(
          invalidTypeArb,
          (card_type) => {
            const query: SearchQuery = { card_type: card_type as CardType };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'card_type' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only match cards of the specified type', () => {
      fc.assert(
        fc.property(
          cardTypeArb,
          cardTypeArb,
          (queryType, cardType) => {
            const card = {
              id: 'test-id',
              title: 'Test Card',
              description: 'Test Description',
              card_type: cardType,
              interest_tags: [],
            };
            const query: SearchQuery = { card_type: queryType };
            const matchResult = searchValidator.validateSearchResult(card, query);
            
            // Should match only if types are equal
            return matchResult.matches === (queryType === cardType);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.3: Interest tags filter validation
   * If interest_tags are provided, results SHALL only include cards with matching tags
   * Validates: Requirement 5.4
   */
  describe('Interest Tags Filter Validation (Requirement 5.4)', () => {
    it('should accept valid interest tags within limit', () => {
      fc.assert(
        fc.property(
          validInterestTagsArb,
          (interest_tags) => {
            const query: SearchQuery = { interest_tags };
            const result = searchValidator.validateSearchQuery(query);
            return result.valid && result.hasFilters && result.filterCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject interest tags exceeding max count', () => {
      const tooManyTagsArb = fc.array(tagArb, { 
        minLength: SearchLimits.MAX_INTEREST_TAGS + 1, 
        maxLength: SearchLimits.MAX_INTEREST_TAGS + 5 
      });

      fc.assert(
        fc.property(
          tooManyTagsArb,
          (interest_tags) => {
            const query: SearchQuery = { interest_tags };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'interest_tags' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match cards that have at least one matching tag', () => {
      fc.assert(
        fc.property(
          validInterestTagsArb,
          fc.array(tagArb, { minLength: 0, maxLength: 10 }),
          (queryTags, cardTags) => {
            const card = {
              id: 'test-id',
              title: 'Test Card',
              description: 'Test Description',
              card_type: 'day_card' as CardType,
              interest_tags: cardTags,
            };
            const query: SearchQuery = { interest_tags: queryTags };
            const matchResult = searchValidator.validateSearchResult(card, query);
            
            // Should match if there's any overlap
            const hasOverlap = queryTags.some(tag => cardTags.includes(tag));
            return matchResult.matches === hasOverlap;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.4: Location filter validation
   * If location filter is provided, results SHALL only include cards within the radius
   * Validates: Requirement 5.5
   */
  describe('Location Filter Validation (Requirement 5.5)', () => {
    it('should accept valid location coordinates', () => {
      fc.assert(
        fc.property(
          validLatitudeArb,
          validLongitudeArb,
          validRadiusArb,
          (latitude, longitude, radius_km) => {
            const query: SearchQuery = { latitude, longitude, radius_km };
            const result = searchValidator.validateSearchQuery(query);
            return result.valid && result.hasFilters && result.filterCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject when only latitude is provided', () => {
      fc.assert(
        fc.property(
          validLatitudeArb,
          (latitude) => {
            const query: SearchQuery = { latitude };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'location' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject when only longitude is provided', () => {
      fc.assert(
        fc.property(
          validLongitudeArb,
          (longitude) => {
            const query: SearchQuery = { longitude };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'location' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject latitude outside valid range', () => {
      const invalidLatitudeArb = fc.oneof(
        fc.double({ min: -180, max: SearchLimits.MIN_LATITUDE - 0.1, noNaN: true }),
        fc.double({ min: SearchLimits.MAX_LATITUDE + 0.1, max: 180, noNaN: true })
      );

      fc.assert(
        fc.property(
          invalidLatitudeArb,
          validLongitudeArb,
          (latitude, longitude) => {
            const query: SearchQuery = { latitude, longitude };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'latitude' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject longitude outside valid range', () => {
      const invalidLongitudeArb = fc.oneof(
        fc.double({ min: -360, max: SearchLimits.MIN_LONGITUDE - 0.1, noNaN: true }),
        fc.double({ min: SearchLimits.MAX_LONGITUDE + 0.1, max: 360, noNaN: true })
      );

      fc.assert(
        fc.property(
          validLatitudeArb,
          invalidLongitudeArb,
          (latitude, longitude) => {
            const query: SearchQuery = { latitude, longitude };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'longitude' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject radius outside valid range', () => {
      const invalidRadiusArb = fc.oneof(
        fc.double({ min: 0, max: SearchLimits.MIN_RADIUS_KM - 0.01, noNaN: true }),
        fc.double({ min: SearchLimits.MAX_RADIUS_KM + 0.1, max: 200, noNaN: true })
      );

      fc.assert(
        fc.property(
          validLatitudeArb,
          validLongitudeArb,
          invalidRadiusArb,
          (latitude, longitude, radius_km) => {
            const query: SearchQuery = { latitude, longitude, radius_km };
            const result = searchValidator.validateSearchQuery(query);
            return !result.valid && 'radius_km' in result.errors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate distance and filter by radius', () => {
      fc.assert(
        fc.property(
          validLatitudeArb,
          validLongitudeArb,
          validRadiusArb,
          (lat, lon, radius) => {
            // Create a card at the same location (should always match)
            const card = {
              id: 'test-id',
              title: 'Test Card',
              description: 'Test Description',
              card_type: 'day_card' as CardType,
              interest_tags: [],
              location: { latitude: lat, longitude: lon },
            };
            const query: SearchQuery = { latitude: lat, longitude: lon, radius_km: radius };
            const matchResult = searchValidator.validateSearchResult(card, query);
            
            // Same location should always match (distance = 0)
            return matchResult.matches;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.5: Combined filters validation
   * Multiple filters SHALL be applied together (AND logic)
   * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6
   */
  describe('Combined Filters Validation (Requirements 5.2-5.6)', () => {
    it('should count multiple filters correctly', () => {
      fc.assert(
        fc.property(
          fc.option(validKeywordArb, { nil: undefined }),
          fc.option(cardTypeArb, { nil: undefined }),
          fc.option(validInterestTagsArb, { nil: undefined }),
          fc.boolean(),
          (keyword, card_type, interest_tags, includeLocation) => {
            const query: SearchQuery = {};
            let expectedCount = 0;

            if (keyword) {
              query.keyword = keyword;
              expectedCount++;
            }
            if (card_type) {
              query.card_type = card_type;
              expectedCount++;
            }
            if (interest_tags && interest_tags.length > 0) {
              query.interest_tags = interest_tags;
              expectedCount++;
            }
            if (includeLocation) {
              query.latitude = 39.9042;
              query.longitude = 116.4074;
              query.radius_km = 10;
              expectedCount++;
            }

            const result = searchValidator.validateSearchQuery(query);
            return result.valid && result.filterCount === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require all filters to match for a result to be valid', () => {
      fc.assert(
        fc.property(
          validKeywordArb,
          cardTypeArb,
          (keyword, card_type) => {
            // Create a card that matches keyword but not card_type
            const card = {
              id: 'test-id',
              title: `Title with ${keyword}`,
              description: 'Description',
              card_type: card_type === 'day_card' ? 'week_card' as CardType : 'day_card' as CardType,
              interest_tags: [],
            };
            const query: SearchQuery = { keyword, card_type };
            const matchResult = searchValidator.validateSearchResult(card, query);
            
            // Should not match because card_type doesn't match
            return !matchResult.matches;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.6: Empty query validation
   * Empty query (no filters) SHALL be valid but have no filters
   */
  describe('Empty Query Validation', () => {
    it('should accept empty query with no filters', () => {
      const result = searchValidator.validateSearchQuery({});
      expect(result.valid).toBe(true);
      expect(result.hasFilters).toBe(false);
      expect(result.filterCount).toBe(0);
    });

    it('should accept query with only empty/null values', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          () => {
            const query: SearchQuery = {
              keyword: '',
              card_type: '' as CardType,
              interest_tags: [],
            };
            const result = searchValidator.validateSearchQuery(query);
            return result.valid && !result.hasFilters && result.filterCount === 0;
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
