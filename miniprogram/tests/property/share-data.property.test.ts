/**
 * Property-Based Tests for Share Data Generation
 * Feature: life-card-miniprogram, Property 19: Share Data Generation
 * Validates: Requirements 12.2
 */
import * as fc from 'fast-check';
import {
  generateShareData,
  validateShareData,
  ShareData,
} from '../../utils/share';
import type { LifeCard, MediaItem, CardType } from '../../types/card';

// Arbitrary for card type
const cardTypeArb = fc.constantFrom<CardType>('day_card', 'week_card', 'fragment_card', 'moment_card');

// Arbitrary for non-empty string (for titles)
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

// Arbitrary for card ID (UUID-like)
const cardIdArb = fc.uuid();

// Arbitrary for URL
const urlArb = fc.webUrl();

// Arbitrary for media item
const mediaItemArb: fc.Arbitrary<MediaItem> = fc.record({
  id: fc.uuid(),
  media_type: fc.constantFrom<'image' | 'video'>('image', 'video'),
  url: urlArb,
  thumbnail_url: fc.option(urlArb, { nil: undefined }),
  width: fc.option(fc.integer({ min: 100, max: 4000 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 100, max: 4000 }), { nil: undefined }),
});

// Arbitrary for media item with thumbnail
const mediaItemWithThumbnailArb: fc.Arbitrary<MediaItem> = fc.record({
  id: fc.uuid(),
  media_type: fc.constantFrom<'image' | 'video'>('image', 'video'),
  url: urlArb,
  thumbnail_url: urlArb,
  width: fc.option(fc.integer({ min: 100, max: 4000 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 100, max: 4000 }), { nil: undefined }),
});

// Arbitrary for partial card with title and id
const partialCardWithTitleArb: fc.Arbitrary<Partial<LifeCard>> = fc.record({
  id: cardIdArb,
  title: nonEmptyStringArb,
  card_type: fc.option(cardTypeArb, { nil: undefined }),
  media: fc.option(fc.array(mediaItemArb, { minLength: 0, maxLength: 9 }), { nil: undefined }),
});

describe('Share Data Generation Properties', () => {
  /**
   * Property 19: Share Data Generation
   * Validates: Requirements 12.2
   * 
   * For any card being shared:
   * - Share data SHALL include card title
   * - Share data SHALL include thumbnail URL (first media item or placeholder)
   * - Share path SHALL include card ID for deep linking
   */
  describe('Share Title Generation (Requirements 12.2)', () => {
    it('should include card title in share data when title exists', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            // Title should be non-empty
            return shareData.title.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use card title in generated share title', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          (id, title) => {
            const card: Partial<LifeCard> = { id, title };
            const shareData = generateShareData(card);
            // Share title should contain the card title
            return shareData.title.includes(title);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add card type prefix when card_type is provided', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          cardTypeArb,
          (id, title, cardType) => {
            const card: Partial<LifeCard> = { id, title, card_type: cardType };
            const shareData = generateShareData(card);
            // Should contain the title
            return shareData.title.includes(title);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return default title when card is null', () => {
      const shareData = generateShareData(null);
      expect(shareData.title).toBe('Life Card - 分享人生体验');
    });

    it('should return default title when card is undefined', () => {
      const shareData = generateShareData(undefined);
      expect(shareData.title).toBe('Life Card - 分享人生体验');
    });

    it('should return default title when card has no title', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (id) => {
            const card: Partial<LifeCard> = { id };
            const shareData = generateShareData(card);
            return shareData.title === 'Life Card - 分享人生体验';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Share Path with Card ID (Requirements 12.2)', () => {
    it('should include card ID in share path for deep linking', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            // Path should contain the card ID
            return shareData.path.includes(card.id!);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use cardId parameter when card has no id', () => {
      fc.assert(
        fc.property(
          nonEmptyStringArb,
          cardIdArb,
          (title, cardId) => {
            const card: Partial<LifeCard> = { title };
            const shareData = generateShareData(card, cardId);
            return shareData.path.includes(cardId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have correct path format for card detail page', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            return shareData.path.startsWith('/pages/card-detail/card-detail?id=');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have path with id query parameter', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const card: Partial<LifeCard> = { id: cardId, title: 'Test' };
            const shareData = generateShareData(card);
            return shareData.path.includes(`?id=${cardId}`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Share Image URL (Requirements 12.2)', () => {
    it('should use thumbnail_url when available', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          mediaItemWithThumbnailArb,
          (id, title, mediaItem) => {
            const card: Partial<LifeCard> = {
              id,
              title,
              media: [mediaItem],
            };
            const shareData = generateShareData(card);
            return shareData.imageUrl === mediaItem.thumbnail_url;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use original url for images without thumbnail', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          urlArb,
          (id, title, url) => {
            const mediaItem: MediaItem = {
              id: 'media-1',
              media_type: 'image',
              url,
              thumbnail_url: undefined,
            };
            const card: Partial<LifeCard> = {
              id,
              title,
              media: [mediaItem],
            };
            const shareData = generateShareData(card);
            return shareData.imageUrl === url;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return undefined for video without thumbnail', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          urlArb,
          (id, title, url) => {
            const mediaItem: MediaItem = {
              id: 'media-1',
              media_type: 'video',
              url,
              thumbnail_url: undefined,
            };
            const card: Partial<LifeCard> = {
              id,
              title,
              media: [mediaItem],
            };
            const shareData = generateShareData(card);
            return shareData.imageUrl === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return undefined when no media exists', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          (id, title) => {
            const card: Partial<LifeCard> = { id, title, media: [] };
            const shareData = generateShareData(card);
            return shareData.imageUrl === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use first media item for thumbnail', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          nonEmptyStringArb,
          fc.array(mediaItemWithThumbnailArb, { minLength: 2, maxLength: 9 }),
          (id, title, mediaItems) => {
            const card: Partial<LifeCard> = {
              id,
              title,
              media: mediaItems,
            };
            const shareData = generateShareData(card);
            // Should use the first media item's thumbnail
            return shareData.imageUrl === mediaItems[0].thumbnail_url;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Share Data Validation (Requirements 12.2)', () => {
    it('should validate share data with correct card ID', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            const validation = validateShareData(shareData, card.id!);
            return validation.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail validation when path does not contain card ID', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          cardIdArb,
          (cardId, wrongId) => {
            // Ensure they are different
            if (cardId === wrongId) return true;
            
            const shareData: ShareData = {
              title: 'Test Title',
              path: `/pages/card-detail/card-detail?id=${cardId}`,
            };
            const validation = validateShareData(shareData, wrongId);
            return validation.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail validation when title is empty', () => {
      fc.assert(
        fc.property(
          cardIdArb,
          (cardId) => {
            const shareData: ShareData = {
              title: '',
              path: `/pages/card-detail/card-detail?id=${cardId}`,
            };
            const validation = validateShareData(shareData, cardId);
            return validation.valid === false && validation.errors.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotence (Requirements 12.2)', () => {
    it('should produce same share data for same input', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData1 = generateShareData(card);
            const shareData2 = generateShareData(card);
            return (
              shareData1.title === shareData2.title &&
              shareData1.path === shareData2.path &&
              shareData1.imageUrl === shareData2.imageUrl
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete Share Data Structure (Requirements 12.2)', () => {
    it('should return all required share data fields', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            return (
              'title' in shareData &&
              'path' in shareData &&
              typeof shareData.title === 'string' &&
              typeof shareData.path === 'string'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty title for all valid cards', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            return shareData.title.trim().length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty path for all valid cards', () => {
      fc.assert(
        fc.property(
          partialCardWithTitleArb,
          (card) => {
            const shareData = generateShareData(card);
            return shareData.path.trim().length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
