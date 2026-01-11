/**
 * Property-Based Tests for Deep Link Navigation
 * Feature: life-card-miniprogram, Property 20: Deep Link Navigation
 * Validates: Requirements 12.5
 */
import * as fc from 'fast-check';
import {
  parseDeepLink,
  extractCardIdFromSharePath,
} from '../../utils/share';

// Arbitrary for card ID (UUID-like)
const cardIdArb = fc.uuid();

// Arbitrary for non-empty card ID string
const nonEmptyCardIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.trim().length > 0 && !s.includes('&') && !s.includes('?'));

// Arbitrary for scene number (WeChat mini program scenes)
const sceneArb = fc.integer({ min: 1000, max: 1100 });

describe('Deep Link Navigation Properties', () => {
  /**
   * Property 20: Deep Link Navigation
   * Validates: Requirements 12.5
   * 
   * For any shared link containing a card ID:
   * - If card exists, Mini_Program SHALL navigate to card detail page
   * - If card does not exist, Mini_Program SHALL show error and navigate to home
   */
  describe('Deep Link Parsing (Requirements 12.5)', () => {
    it('should successfully parse deep link when query contains id', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const options = {
              query: { id: cardId },
            };
            const result = parseDeepLink(options);
            
            return (
              result.success === true &&
              result.cardId === cardId &&
              result.targetPath === `/pages/card-detail/card-detail?id=${cardId}`
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should successfully parse deep link when query contains cardId', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const options = {
              query: { cardId: cardId },
            };
            const result = parseDeepLink(options);
            
            return (
              result.success === true &&
              result.cardId === cardId &&
              result.targetPath === `/pages/card-detail/card-detail?id=${cardId}`
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract card ID from path when query is empty', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const options = {
              path: `/pages/card-detail/card-detail?id=${cardId}`,
              query: {},
            };
            const result = parseDeepLink(options);
            
            return (
              result.success === true &&
              result.cardId === cardId
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return failure when no card ID is present', () => {
      fc.assert(
        fc.property(
          sceneArb,
          (scene) => {
            const options = {
              path: '/pages/index/index',
              query: {},
              scene,
            };
            const result = parseDeepLink(options);
            
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return failure when options is empty object', () => {
      const result = parseDeepLink({});
      expect(result.success).toBe(false);
    });

    it('should prefer query.id over path extraction', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          cardIdArb,
          (queryId, pathId) => {
            // Skip if IDs are the same
            if (queryId === pathId) return true;
            
            const options = {
              path: `/pages/card-detail/card-detail?id=${pathId}`,
              query: { id: queryId },
            };
            const result = parseDeepLink(options);
            
            // Should use query.id, not path id
            return result.cardId === queryId;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Card ID Extraction from Path (Requirements 12.5)', () => {
    it('should extract card ID from path with id query parameter', () => {
      fc.assert(
        fc.property(
          nonEmptyCardIdArb,
          (cardId) => {
            const path = `/pages/card-detail/card-detail?id=${cardId}`;
            const extractedId = extractCardIdFromSharePath(path);
            
            return extractedId === cardId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract card ID from query string format', () => {
      fc.assert(
        fc.property(
          nonEmptyCardIdArb,
          (cardId) => {
            const queryString = `id=${cardId}`;
            const extractedId = extractCardIdFromSharePath(queryString);
            
            return extractedId === cardId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract card ID when id is not the first parameter', () => {
      fc.assert(
        fc.property(
          nonEmptyCardIdArb,
          (cardId) => {
            const path = `/pages/card-detail/card-detail?source=share&id=${cardId}`;
            const extractedId = extractCardIdFromSharePath(path);
            
            return extractedId === cardId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for empty path', () => {
      const result = extractCardIdFromSharePath('');
      expect(result).toBeNull();
    });

    it('should return null for path without id parameter', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (randomPath) => {
            // Ensure path doesn't contain id parameter
            if (randomPath.includes('id=')) return true;
            
            const result = extractCardIdFromSharePath(randomPath);
            return result === null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Deep Link Result Structure (Requirements 12.5)', () => {
    it('should return correct structure for successful parse', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const options = { query: { id: cardId } };
            const result = parseDeepLink(options);
            
            return (
              'success' in result &&
              'targetPath' in result &&
              'cardId' in result &&
              typeof result.success === 'boolean' &&
              typeof result.targetPath === 'string' &&
              typeof result.cardId === 'string'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error message for failed parse', () => {
      fc.assert(
        fc.property(
          sceneArb,
          (scene) => {
            const options = { scene, query: {} };
            const result = parseDeepLink(options);
            
            return (
              result.success === false &&
              'errorMessage' in result &&
              typeof result.errorMessage === 'string'
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Target Path Generation (Requirements 12.5)', () => {
    it('should generate correct card detail path', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const options = { query: { id: cardId } };
            const result = parseDeepLink(options);
            
            if (!result.success) return false;
            
            return (
              result.targetPath!.startsWith('/pages/card-detail/card-detail') &&
              result.targetPath!.includes(`id=${cardId}`)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include card ID in target path for navigation', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const options = { query: { id: cardId } };
            const result = parseDeepLink(options);
            
            if (!result.success || !result.targetPath) return false;
            
            // The target path should contain the card ID for proper navigation
            return result.targetPath.includes(cardId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotence (Requirements 12.5)', () => {
    it('should produce same result for same input', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          sceneArb,
          (cardId, scene) => {
            const options = {
              query: { id: cardId },
              scene,
            };
            
            const result1 = parseDeepLink(options);
            const result2 = parseDeepLink(options);
            
            return (
              result1.success === result2.success &&
              result1.cardId === result2.cardId &&
              result1.targetPath === result2.targetPath
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases (Requirements 12.5)', () => {
    it('should handle undefined options gracefully', () => {
      // @ts-ignore - Testing edge case with undefined
      const result = parseDeepLink(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle null options gracefully', () => {
      // @ts-ignore - Testing edge case with null
      const result = parseDeepLink(null);
      expect(result.success).toBe(false);
    });

    it('should handle options with only referrerInfo', () => {
      const options = {
        referrerInfo: { appId: 'wx123456' },
      };
      const result = parseDeepLink(options);
      expect(result.success).toBe(false);
    });

    it('should handle empty query object', () => {
      const options = {
        query: {},
        path: '/pages/index/index',
      };
      const result = parseDeepLink(options);
      expect(result.success).toBe(false);
    });
  });
});
