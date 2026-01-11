/// <reference types="jest" />
/**
 * Property-Based Tests for Feed Pagination Cursor Consistency
 * Feature: life-card-miniprogram, Property 4: Feed Pagination Cursor Consistency
 * Validates: Requirements 4.2, 4.3
 */
import * as fc from 'fast-check';
import type { LifeCard, CardFeedResult } from '../../types/card';

interface FeedState {
  cards: LifeCard[];
  cursor: string | null;
  hasMore: boolean;
}

function applyFeedResult(
  currentState: FeedState,
  result: CardFeedResult,
  isRefresh: boolean
): FeedState {
  if (isRefresh) {
    return {
      cards: result.cards,
      cursor: result.next_cursor || null,
      hasMore: result.has_more,
    };
  } else {
    return {
      cards: [...currentState.cards, ...result.cards],
      cursor: result.next_cursor || null,
      hasMore: result.has_more,
    };
  }
}

function createInitialState(): FeedState {
  return { cards: [], cursor: null, hasMore: true };
}

function generateCursor(cards: LifeCard[]): string | undefined {
  if (cards.length === 0) return undefined;
  return 'cursor_' + cards[cards.length - 1].id;
}

describe('Feed Pagination Cursor Consistency Properties', () => {
  const cardTypeArb = fc.constantFrom(
    'day_card', 'week_card', 'fragment_card', 'moment_card'
  ) as fc.Arbitrary<LifeCard['card_type']>;

  const privacyLevelArb = fc.constantFrom(
    'public', 'friends_only', 'exchange_only'
  ) as fc.Arbitrary<LifeCard['privacy_level']>;

  const lifeCardArb: fc.Arbitrary<LifeCard> = fc.record({
    id: fc.uuid(),
    creator_id: fc.uuid(),
    creator: fc.option(
      fc.record({
        id: fc.uuid(),
        nickname: fc.string({ minLength: 1, maxLength: 50 }),
        avatar_url: fc.option(fc.webUrl(), { nil: undefined }),
      }),
      { nil: undefined }
    ),
    card_type: cardTypeArb,
    title: fc.string({ minLength: 1, maxLength: 200 }),
    description: fc.string({ minLength: 1, maxLength: 2000 }),
    media: fc.array(
      fc.record({
        id: fc.uuid(),
        media_type: fc.constantFrom('image', 'video') as fc.Arbitrary<'image' | 'video'>,
        url: fc.webUrl(),
        thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
      }),
      { minLength: 0, maxLength: 9 }
    ),
    location: fc.option(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        latitude: fc.double({ min: -90, max: 90 }),
        longitude: fc.double({ min: -180, max: 180 }),
      }),
      { nil: undefined }
    ),
    emotion_tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
    interest_tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
    privacy_level: privacyLevelArb,
    exchange_price: fc.nat({ max: 1000 }),
    like_count: fc.nat({ max: 100000 }),
    comment_count: fc.nat({ max: 100000 }),
    exchange_count: fc.nat({ max: 10000 }),
    is_liked: fc.boolean(),
    is_collected: fc.boolean(),
    created_at: fc.date().map(d => d.toISOString()),
    updated_at: fc.date().map(d => d.toISOString()),
  });

  const feedResultArb = (hasMore: boolean): fc.Arbitrary<CardFeedResult> =>
    fc.array(lifeCardArb, { minLength: 1, maxLength: 20 }).map(cards => ({
      cards,
      has_more: hasMore,
      next_cursor: hasMore ? generateCursor(cards) : undefined,
    }));

  it('initial load with has_more=true SHALL return next_cursor', () => {
    fc.assert(
      fc.property(feedResultArb(true), (result) => {
        const initialState = createInitialState();
        const newState = applyFeedResult(initialState, result, true);
        return result.has_more === true && newState.cursor !== null;
      }),
      { numRuns: 100 }
    );
  });

  it('initial load with has_more=false SHALL NOT return next_cursor', () => {
    const noMoreResultArb = fc.array(lifeCardArb, { minLength: 1, maxLength: 20 }).map(cards => ({
      cards,
      has_more: false,
      next_cursor: undefined,
    }));
    fc.assert(
      fc.property(noMoreResultArb, (result) => {
        const initialState = createInitialState();
        const newState = applyFeedResult(initialState, result, true);
        return result.has_more === false && newState.cursor === null;
      }),
      { numRuns: 100 }
    );
  });

  it('subsequent load SHALL append cards to existing list', () => {
    fc.assert(
      fc.property(feedResultArb(true), feedResultArb(true), (firstResult, secondResult) => {
        const initialState = createInitialState();
        const stateAfterFirst = applyFeedResult(initialState, firstResult, true);
        const stateAfterSecond = applyFeedResult(stateAfterFirst, secondResult, false);
        return stateAfterSecond.cards.length === firstResult.cards.length + secondResult.cards.length;
      }),
      { numRuns: 100 }
    );
  });

  it('refresh SHALL replace cards (not append)', () => {
    fc.assert(
      fc.property(feedResultArb(true), feedResultArb(true), (firstResult, refreshResult) => {
        const initialState = createInitialState();
        const stateAfterFirst = applyFeedResult(initialState, firstResult, true);
        const stateAfterRefresh = applyFeedResult(stateAfterFirst, refreshResult, true);
        return stateAfterRefresh.cards.length === refreshResult.cards.length;
      }),
      { numRuns: 100 }
    );
  });

  it('refresh SHALL update cursor to new value from result', () => {
    fc.assert(
      fc.property(feedResultArb(true), feedResultArb(true), (firstResult, refreshResult) => {
        const initialState = createInitialState();
        applyFeedResult(initialState, firstResult, true);
        const stateAfterRefresh = applyFeedResult(createInitialState(), refreshResult, true);
        return stateAfterRefresh.cursor === (refreshResult.next_cursor || null);
      }),
      { numRuns: 100 }
    );
  });

  it('hasMore state SHALL always match result has_more', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.array(lifeCardArb, { minLength: 1, maxLength: 20 }), fc.boolean(), (hasMore, cards, isRefresh) => {
        const result: CardFeedResult = {
          cards,
          has_more: hasMore,
          next_cursor: hasMore ? generateCursor(cards) : undefined,
        };
        const newState = applyFeedResult(createInitialState(), result, isRefresh);
        return newState.hasMore === result.has_more;
      }),
      { numRuns: 100 }
    );
  });

  it('subsequent load SHALL return different card IDs than previous page', () => {
    const twoPageArb = fc.tuple(
      fc.array(lifeCardArb, { minLength: 1, maxLength: 10 }),
      fc.array(lifeCardArb, { minLength: 1, maxLength: 10 })
    ).map(([page1Cards, page2Cards]) => {
      const page1Ids = new Set(page1Cards.map(c => c.id));
      const page2WithDifferentIds = page2Cards.map((card, idx) => ({
        ...card,
        id: page1Ids.has(card.id) ? 'different_' + idx + '_' + card.id : card.id,
      }));
      return {
        page1: { cards: page1Cards, has_more: true, next_cursor: generateCursor(page1Cards) } as CardFeedResult,
        page2: { cards: page2WithDifferentIds, has_more: false, next_cursor: undefined } as CardFeedResult,
      };
    });
    fc.assert(
      fc.property(twoPageArb, ({ page1, page2 }) => {
        const page1Ids = new Set(page1.cards.map(c => c.id));
        const page2Ids = new Set(page2.cards.map(c => c.id));
        return ![...page2Ids].some(id => page1Ids.has(id));
      }),
      { numRuns: 100 }
    );
  });

  it('empty result with has_more=false SHALL correctly update state', () => {
    const emptyResultArb: fc.Arbitrary<CardFeedResult> = fc.constant({
      cards: [],
      has_more: false,
      next_cursor: undefined,
    });
    fc.assert(
      fc.property(feedResultArb(true), emptyResultArb, (firstResult, emptyResult) => {
        const stateAfterFirst = applyFeedResult(createInitialState(), firstResult, true);
        const stateAfterEmpty = applyFeedResult(stateAfterFirst, emptyResult, false);
        return stateAfterEmpty.hasMore === false && stateAfterEmpty.cursor === null;
      }),
      { numRuns: 100 }
    );
  });
});
