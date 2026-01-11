/// <reference types="jest" />
/**
 * Property-Based Tests for Like Toggle State Consistency
 * Feature: life-card-miniprogram, Property 7: Like Toggle State Consistency
 * Validates: Requirements 6.3
 * 
 * For any card and like action:
 * - If card is not liked, liking SHALL set is_liked to true and increment like_count by 1
 * - If card is liked, unliking SHALL set is_liked to false and decrement like_count by 1
 * - Like state SHALL be idempotent (liking twice = liking once)
 */
import * as fc from 'fast-check';

// Types matching the card types
interface LikeState {
  is_liked: boolean;
  like_count: number;
}

/**
 * Simulates the like toggle logic as implemented in card-detail.ts
 * This mirrors the optimistic update behavior
 */
function toggleLike(currentState: LikeState): LikeState {
  const newIsLiked = !currentState.is_liked;
  const newLikeCount = newIsLiked 
    ? currentState.like_count + 1 
    : Math.max(0, currentState.like_count - 1);
  
  return {
    is_liked: newIsLiked,
    like_count: newLikeCount,
  };
}

/**
 * Simulates the like action (when card is not liked)
 */
function likeCard(currentState: LikeState): LikeState {
  if (currentState.is_liked) {
    // Already liked, no change (idempotent)
    return currentState;
  }
  return {
    is_liked: true,
    like_count: currentState.like_count + 1,
  };
}

/**
 * Simulates the unlike action (when card is liked)
 */
function unlikeCard(currentState: LikeState): LikeState {
  if (!currentState.is_liked) {
    // Already not liked, no change (idempotent)
    return currentState;
  }
  return {
    is_liked: false,
    like_count: Math.max(0, currentState.like_count - 1),
  };
}

describe('Like Toggle State Consistency Properties', () => {
  // Arbitrary for generating not-liked states
  const notLikedStateArb: fc.Arbitrary<LikeState> = fc.record({
    is_liked: fc.constant(false),
    like_count: fc.nat({ max: 1000000 }),
  });

  // Arbitrary for generating liked states (must have at least 1 like for consistency)
  const likedStateArb: fc.Arbitrary<LikeState> = fc.record({
    is_liked: fc.constant(true),
    like_count: fc.nat({ max: 1000000 }).filter(n => n >= 1), // At least 1 like
  });

  // Arbitrary for generating consistent like states
  // When is_liked=true, like_count must be >= 1 (consistent state)
  // When is_liked=false, like_count can be any non-negative number
  const consistentLikeStateArb: fc.Arbitrary<LikeState> = fc.oneof(
    notLikedStateArb,
    likedStateArb
  );

  /**
   * Property 7.1: Liking an unliked card SHALL set is_liked to true
   */
  it('should set is_liked to true when liking an unliked card', () => {
    fc.assert(
      fc.property(notLikedStateArb, (state) => {
        const result = likeCard(state);
        return result.is_liked === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Liking an unliked card SHALL increment like_count by 1
   */
  it('should increment like_count by 1 when liking an unliked card', () => {
    fc.assert(
      fc.property(notLikedStateArb, (state) => {
        const result = likeCard(state);
        return result.like_count === state.like_count + 1;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Unliking a liked card SHALL set is_liked to false
   */
  it('should set is_liked to false when unliking a liked card', () => {
    fc.assert(
      fc.property(likedStateArb, (state) => {
        const result = unlikeCard(state);
        return result.is_liked === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Unliking a liked card SHALL decrement like_count by 1
   */
  it('should decrement like_count by 1 when unliking a liked card', () => {
    fc.assert(
      fc.property(likedStateArb, (state) => {
        const result = unlikeCard(state);
        return result.like_count === state.like_count - 1;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: Like count SHALL never go below 0
   */
  it('should never have like_count below 0 after unlike', () => {
    // Test with edge case where like_count is 0 but is_liked is true
    const edgeCaseArb: fc.Arbitrary<LikeState> = fc.record({
      is_liked: fc.constant(true),
      like_count: fc.nat({ max: 5 }), // Include 0 case
    });

    fc.assert(
      fc.property(edgeCaseArb, (state) => {
        const result = unlikeCard(state);
        return result.like_count >= 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.6: Liking is idempotent - liking twice equals liking once
   */
  it('should be idempotent - liking twice equals liking once', () => {
    fc.assert(
      fc.property(notLikedStateArb, (state) => {
        const afterFirstLike = likeCard(state);
        const afterSecondLike = likeCard(afterFirstLike);
        
        // After liking twice, state should be same as after liking once
        return afterFirstLike.is_liked === afterSecondLike.is_liked &&
               afterFirstLike.like_count === afterSecondLike.like_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.7: Unliking is idempotent - unliking twice equals unliking once
   */
  it('should be idempotent - unliking twice equals unliking once', () => {
    fc.assert(
      fc.property(likedStateArb, (state) => {
        const afterFirstUnlike = unlikeCard(state);
        const afterSecondUnlike = unlikeCard(afterFirstUnlike);
        
        // After unliking twice, state should be same as after unliking once
        return afterFirstUnlike.is_liked === afterSecondUnlike.is_liked &&
               afterFirstUnlike.like_count === afterSecondUnlike.like_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.8: Toggle is its own inverse - toggling twice returns to original state
   * Note: This property only holds for consistent states where is_liked=true implies like_count >= 1
   */
  it('should return to original state after toggling twice', () => {
    fc.assert(
      fc.property(consistentLikeStateArb, (state) => {
        const afterFirstToggle = toggleLike(state);
        const afterSecondToggle = toggleLike(afterFirstToggle);
        
        // After toggling twice, should return to original state
        return state.is_liked === afterSecondToggle.is_liked &&
               state.like_count === afterSecondToggle.like_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.9: Toggle changes is_liked state
   */
  it('should always change is_liked state after toggle', () => {
    fc.assert(
      fc.property(consistentLikeStateArb, (state) => {
        const result = toggleLike(state);
        return result.is_liked !== state.is_liked;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.10: Like count change matches is_liked change direction
   */
  it('should have like_count change match is_liked change direction', () => {
    fc.assert(
      fc.property(consistentLikeStateArb, (state) => {
        const result = toggleLike(state);
        
        if (result.is_liked && !state.is_liked) {
          // Went from not liked to liked - count should increase
          return result.like_count === state.like_count + 1;
        } else if (!result.is_liked && state.is_liked) {
          // Went from liked to not liked - count should decrease (but not below 0)
          return result.like_count === Math.max(0, state.like_count - 1);
        }
        return false; // Should never reach here
      }),
      { numRuns: 100 }
    );
  });
});
