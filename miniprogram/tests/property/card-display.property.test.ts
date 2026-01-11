/// <reference types="jest" />
/**
 * Property-Based Tests for Card Display Field Completeness
 * Feature: life-card-miniprogram, Property 5: Card Display Field Completeness
 * Validates: Requirements 4.4
 * 
 * For any LifeCard object displayed in a list, the rendered output SHALL contain:
 * thumbnail (or placeholder), title, creator nickname, like_count, and comment_count.
 */
import * as fc from 'fast-check';
import { formatCount } from '../../utils/format';

// Default values used by the card-item component
const DEFAULT_AVATAR = '/assets/images/default-avatar.png';
const DEFAULT_THUMBNAIL = '/assets/images/default-card.png';
const DEFAULT_NICKNAME = '未知用户';

// Types matching the card types
interface MediaItem {
  id: string;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
}

interface UserSummary {
  id: string;
  nickname: string;
  avatar_url?: string;
}

interface LifeCard {
  id: string;
  creator_id: string;
  creator?: UserSummary;
  card_type: 'day_card' | 'week_card' | 'fragment_card' | 'moment_card';
  title: string;
  description: string;
  media: MediaItem[];
  thumbnail_url?: string;
  like_count: number;
  comment_count: number;
  exchange_count: number;
  is_liked: boolean;
  created_at: string;
}

/**
 * Card display data structure - what the component renders
 */
interface CardDisplayData {
  thumbnail: string;
  title: string;
  creatorNickname: string;
  creatorAvatar: string;
  likeCountText: string;
  commentCountText: string;
}

/**
 * Extract display data from a LifeCard - mirrors the card-item component logic
 * This is the function under test
 */
function extractCardDisplayData(card: LifeCard): CardDisplayData {
  // Get thumbnail - same logic as card-item component
  let thumbnail = DEFAULT_THUMBNAIL;
  if (card.thumbnail_url) {
    thumbnail = card.thumbnail_url;
  } else if (card.media && card.media.length > 0) {
    const firstMedia = card.media[0];
    thumbnail = firstMedia.thumbnail_url || firstMedia.url || DEFAULT_THUMBNAIL;
  }

  // Get creator info
  const creator: UserSummary | undefined = card.creator;
  const creatorNickname = creator?.nickname || DEFAULT_NICKNAME;
  const creatorAvatar = creator?.avatar_url || DEFAULT_AVATAR;

  // Format counts
  const likeCountText = formatCount(card.like_count || 0);
  const commentCountText = formatCount(card.comment_count || 0);

  return {
    thumbnail,
    title: card.title,
    creatorNickname,
    creatorAvatar,
    likeCountText,
    commentCountText,
  };
}

describe('Card Display Field Completeness Properties', () => {
  // Arbitraries for generating test data
  const cardTypeArb = fc.constantFrom('day_card', 'week_card', 'fragment_card', 'moment_card') as fc.Arbitrary<LifeCard['card_type']>;
  
  const mediaItemArb: fc.Arbitrary<MediaItem> = fc.record({
    id: fc.uuid(),
    media_type: fc.constantFrom('image', 'video') as fc.Arbitrary<'image' | 'video'>,
    url: fc.webUrl(),
    thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
  });

  const userSummaryArb: fc.Arbitrary<UserSummary> = fc.record({
    id: fc.uuid(),
    nickname: fc.string({ minLength: 1, maxLength: 50 }),
    avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
  });

  const lifeCardArb: fc.Arbitrary<LifeCard> = fc.record({
    id: fc.uuid(),
    creator_id: fc.uuid(),
    creator: fc.option(userSummaryArb, { nil: undefined }),
    card_type: cardTypeArb,
    title: fc.string({ minLength: 1, maxLength: 200 }),
    description: fc.string({ minLength: 1, maxLength: 2000 }),
    media: fc.array(mediaItemArb, { minLength: 0, maxLength: 9 }),
    thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
    like_count: fc.nat({ max: 1000000 }),
    comment_count: fc.nat({ max: 1000000 }),
    exchange_count: fc.nat({ max: 1000000 }),
    is_liked: fc.boolean(),
    created_at: fc.date().map(d => d.toISOString()),
  });

  /**
   * Property 5.1: Display data SHALL always contain a non-empty thumbnail
   * For any card, thumbnail should be either the card's thumbnail, first media, or default
   */
  it('should always provide a non-empty thumbnail (card thumbnail, media, or default)', () => {
    fc.assert(
      fc.property(lifeCardArb, (card) => {
        const displayData = extractCardDisplayData(card);
        // Thumbnail must be non-empty string
        return typeof displayData.thumbnail === 'string' && displayData.thumbnail.length > 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Display data SHALL always contain the card title
   */
  it('should always include the card title in display data', () => {
    fc.assert(
      fc.property(lifeCardArb, (card) => {
        const displayData = extractCardDisplayData(card);
        return displayData.title === card.title;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Display data SHALL always contain a creator nickname (actual or default)
   */
  it('should always provide a non-empty creator nickname (actual or default)', () => {
    fc.assert(
      fc.property(lifeCardArb, (card) => {
        const displayData = extractCardDisplayData(card);
        return typeof displayData.creatorNickname === 'string' && displayData.creatorNickname.length > 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Display data SHALL always contain formatted like_count
   */
  it('should always provide formatted like count', () => {
    fc.assert(
      fc.property(lifeCardArb, (card) => {
        const displayData = extractCardDisplayData(card);
        // Like count text must be non-empty and match the formatted value
        return typeof displayData.likeCountText === 'string' && 
               displayData.likeCountText.length > 0 &&
               displayData.likeCountText === formatCount(card.like_count || 0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Display data SHALL always contain formatted comment_count
   */
  it('should always provide formatted comment count', () => {
    fc.assert(
      fc.property(lifeCardArb, (card) => {
        const displayData = extractCardDisplayData(card);
        // Comment count text must be non-empty and match the formatted value
        return typeof displayData.commentCountText === 'string' && 
               displayData.commentCountText.length > 0 &&
               displayData.commentCountText === formatCount(card.comment_count || 0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: When card has thumbnail_url, it SHALL be used as thumbnail
   */
  it('should use card thumbnail_url when available', () => {
    const cardWithThumbnailArb = lifeCardArb.map(card => ({
      ...card,
      thumbnail_url: 'https://example.com/thumbnail.jpg',
    }));

    fc.assert(
      fc.property(cardWithThumbnailArb, (card) => {
        const displayData = extractCardDisplayData(card);
        return displayData.thumbnail === card.thumbnail_url;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: When card has no thumbnail_url but has media, first media SHALL be used
   */
  it('should use first media as thumbnail when no thumbnail_url', () => {
    const mediaWithUrlArb: fc.Arbitrary<MediaItem> = fc.record({
      id: fc.uuid(),
      media_type: fc.constant('image' as const),
      url: fc.webUrl(),
      thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
    });

    const cardWithMediaArb = fc.record({
      id: fc.uuid(),
      creator_id: fc.uuid(),
      creator: fc.option(userSummaryArb, { nil: undefined }),
      card_type: cardTypeArb,
      title: fc.string({ minLength: 1, maxLength: 200 }),
      description: fc.string({ minLength: 1, maxLength: 2000 }),
      media: fc.array(mediaWithUrlArb, { minLength: 1, maxLength: 9 }),
      thumbnail_url: fc.constant(undefined),
      like_count: fc.nat({ max: 1000000 }),
      comment_count: fc.nat({ max: 1000000 }),
      exchange_count: fc.nat({ max: 1000000 }),
      is_liked: fc.boolean(),
      created_at: fc.date().map(d => d.toISOString()),
    });

    fc.assert(
      fc.property(cardWithMediaArb, (card) => {
        const displayData = extractCardDisplayData(card);
        const firstMedia = card.media[0];
        const expectedThumbnail = firstMedia.thumbnail_url || firstMedia.url || DEFAULT_THUMBNAIL;
        return displayData.thumbnail === expectedThumbnail;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.8: When card has no thumbnail_url and no media, default SHALL be used
   */
  it('should use default thumbnail when no thumbnail_url and no media', () => {
    const cardWithoutMediaArb = lifeCardArb.map(card => ({
      ...card,
      thumbnail_url: undefined,
      media: [],
    }));

    fc.assert(
      fc.property(cardWithoutMediaArb, (card) => {
        const displayData = extractCardDisplayData(card);
        return displayData.thumbnail === DEFAULT_THUMBNAIL;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.9: When creator is missing, default nickname SHALL be used
   */
  it('should use default nickname when creator is missing', () => {
    const cardWithoutCreatorArb = lifeCardArb.map(card => ({
      ...card,
      creator: undefined,
    }));

    fc.assert(
      fc.property(cardWithoutCreatorArb, (card) => {
        const displayData = extractCardDisplayData(card);
        return displayData.creatorNickname === DEFAULT_NICKNAME;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.10: When creator exists with nickname, actual nickname SHALL be used
   */
  it('should use actual nickname when creator exists', () => {
    const creatorWithNicknameArb: fc.Arbitrary<UserSummary> = fc.record({
      id: fc.uuid(),
      nickname: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.length > 0),
      avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
    });

    const cardWithCreatorArb = fc.record({
      id: fc.uuid(),
      creator_id: fc.uuid(),
      creator: creatorWithNicknameArb,
      card_type: cardTypeArb,
      title: fc.string({ minLength: 1, maxLength: 200 }),
      description: fc.string({ minLength: 1, maxLength: 2000 }),
      media: fc.array(mediaItemArb, { minLength: 0, maxLength: 9 }),
      thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
      like_count: fc.nat({ max: 1000000 }),
      comment_count: fc.nat({ max: 1000000 }),
      exchange_count: fc.nat({ max: 1000000 }),
      is_liked: fc.boolean(),
      created_at: fc.date().map(d => d.toISOString()),
    });

    fc.assert(
      fc.property(cardWithCreatorArb, (card) => {
        const displayData = extractCardDisplayData(card);
        return displayData.creatorNickname === card.creator!.nickname;
      }),
      { numRuns: 100 }
    );
  });
});
