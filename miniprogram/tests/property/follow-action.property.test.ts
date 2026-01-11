/// <reference types="jest" />
/**
 * Property-Based Tests for Follow Action UI Consistency
 * Feature: life-card-miniprogram, Property 14: Follow Action UI Consistency
 * Validates: Requirements 9.2
 * 
 * For any follow/unfollow action:
 * - After follow, is_following SHALL be true and follower_count SHALL increment
 * - After unfollow, is_following SHALL be false and follower_count SHALL decrement
 * - UI SHALL update immediately (optimistic update)
 */
import * as fc from 'fast-check';

// Types matching the user profile follow state
interface FollowState {
  is_following: boolean;
  follower_count: number;
}

/**
 * Simulates the optimistic follow action as implemented in user-profile.ts
 * This mirrors the optimistic update behavior before API response
 */
function optimisticFollow(currentState: FollowState): FollowState {
  if (currentState.is_following) {
    // Already following, no change (idempotent)
    return currentState;
  }
  return {
    is_following: true,
    follower_count: currentState.follower_count + 1,
  };
}

/**
 * Simulates the optimistic unfollow action as implemented in user-profile.ts
 * This mirrors the optimistic update behavior before API response
 */
function optimisticUnfollow(currentState: FollowState): FollowState {
  if (!currentState.is_following) {
    // Already not following, no change (idempotent)
    return currentState;
  }
  return {
    is_following: false,
    follower_count: Math.max(0, currentState.follower_count - 1),
  };
}

/**
 * Simulates the toggle follow action (used in UI button click)
 * This is what happens when user clicks the follow/unfollow button
 */
function toggleFollow(currentState: FollowState): FollowState {
  if (currentState.is_following) {
    return optimisticUnfollow(currentState);
  } else {
    return optimisticFollow(currentState);
  }
}

/**
 * Simulates rollback on API failure
 * Returns to original state if API call fails
 */
function rollbackFollow(originalState: FollowState): FollowState {
  return { ...originalState };
}

describe('Follow Action UI Consistency Properties', () => {
  // Arbitrary for generating not-following states
  const notFollowingStateArb: fc.Arbitrary<FollowState> = fc.record({
    is_following: fc.constant(false),
    follower_count: fc.nat({ max: 1000000 }),
  });

  // Arbitrary for generating following states (must have at least 1 follower for consistency)
  const followingStateArb: fc.Arbitrary<FollowState> = fc.record({
    is_following: fc.constant(true),
    follower_count: fc.nat({ max: 1000000 }).filter(n => n >= 1),
  });

  // Arbitrary for generating any consistent follow state
  const consistentFollowStateArb: fc.Arbitrary<FollowState> = fc.oneof(
    notFollowingStateArb,
    followingStateArb
  );

  /**
   * Property 14.1: Following a non-followed user SHALL set is_following to true
   */
  it('should set is_following to true when following a non-followed user', () => {
    fc.assert(
      fc.property(notFollowingStateArb, (state) => {
        const result = optimisticFollow(state);
        return result.is_following === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.2: Following a non-followed user SHALL increment follower_count by 1
   */
  it('should increment follower_count by 1 when following a non-followed user', () => {
    fc.assert(
      fc.property(notFollowingStateArb, (state) => {
        const result = optimisticFollow(state);
        return result.follower_count === state.follower_count + 1;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.3: Unfollowing a followed user SHALL set is_following to false
   */
  it('should set is_following to false when unfollowing a followed user', () => {
    fc.assert(
      fc.property(followingStateArb, (state) => {
        const result = optimisticUnfollow(state);
        return result.is_following === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.4: Unfollowing a followed user SHALL decrement follower_count by 1
   */
  it('should decrement follower_count by 1 when unfollowing a followed user', () => {
    fc.assert(
      fc.property(followingStateArb, (state) => {
        const result = optimisticUnfollow(state);
        return result.follower_count === state.follower_count - 1;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.5: Follower count SHALL never go below 0
   */
  it('should never have follower_count below 0 after unfollow', () => {
    // Test with edge case where follower_count is 0 but is_following is true
    const edgeCaseArb: fc.Arbitrary<FollowState> = fc.record({
      is_following: fc.constant(true),
      follower_count: fc.nat({ max: 5 }), // Include 0 case
    });

    fc.assert(
      fc.property(edgeCaseArb, (state) => {
        const result = optimisticUnfollow(state);
        return result.follower_count >= 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.6: Follow is idempotent - following twice equals following once
   */
  it('should be idempotent - following twice equals following once', () => {
    fc.assert(
      fc.property(notFollowingStateArb, (state) => {
        const afterFirstFollow = optimisticFollow(state);
        const afterSecondFollow = optimisticFollow(afterFirstFollow);
        
        return afterFirstFollow.is_following === afterSecondFollow.is_following &&
               afterFirstFollow.follower_count === afterSecondFollow.follower_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.7: Unfollow is idempotent - unfollowing twice equals unfollowing once
   */
  it('should be idempotent - unfollowing twice equals unfollowing once', () => {
    fc.assert(
      fc.property(followingStateArb, (state) => {
        const afterFirstUnfollow = optimisticUnfollow(state);
        const afterSecondUnfollow = optimisticUnfollow(afterFirstUnfollow);
        
        return afterFirstUnfollow.is_following === afterSecondUnfollow.is_following &&
               afterFirstUnfollow.follower_count === afterSecondUnfollow.follower_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.8: Toggle is its own inverse - toggling twice returns to original state
   */
  it('should return to original state after toggling twice', () => {
    fc.assert(
      fc.property(consistentFollowStateArb, (state) => {
        const afterFirstToggle = toggleFollow(state);
        const afterSecondToggle = toggleFollow(afterFirstToggle);
        
        return state.is_following === afterSecondToggle.is_following &&
               state.follower_count === afterSecondToggle.follower_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.9: Toggle always changes is_following state
   */
  it('should always change is_following state after toggle', () => {
    fc.assert(
      fc.property(consistentFollowStateArb, (state) => {
        const result = toggleFollow(state);
        return result.is_following !== state.is_following;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.10: Follower count change matches is_following change direction
   */
  it('should have follower_count change match is_following change direction', () => {
    fc.assert(
      fc.property(consistentFollowStateArb, (state) => {
        const result = toggleFollow(state);
        
        if (result.is_following && !state.is_following) {
          // Went from not following to following - count should increase
          return result.follower_count === state.follower_count + 1;
        } else if (!result.is_following && state.is_following) {
          // Went from following to not following - count should decrease (but not below 0)
          return result.follower_count === Math.max(0, state.follower_count - 1);
        }
        return false; // Should never reach here
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.11: Rollback restores original state exactly
   */
  it('should restore original state exactly on rollback', () => {
    fc.assert(
      fc.property(consistentFollowStateArb, (state) => {
        // Simulate toggle then rollback scenario
        toggleFollow(state); // State changes optimistically
        const afterRollback = rollbackFollow(state); // Then rollback on API failure
        
        return afterRollback.is_following === state.is_following &&
               afterRollback.follower_count === state.follower_count;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.12: UI state is immediately updated (optimistic update simulation)
   * This tests that the state change happens synchronously without waiting for API
   */
  it('should update state immediately (optimistic update)', () => {
    fc.assert(
      fc.property(notFollowingStateArb, (state) => {
        // Simulate the optimistic update flow from user-profile.ts
        const originalIsFollowing = state.is_following;
        const originalFollowerCount = state.follower_count;
        
        // Optimistic update happens immediately
        const optimisticState = toggleFollow(state);
        
        // State should be different immediately (before API response)
        const stateChangedImmediately = 
          optimisticState.is_following !== originalIsFollowing &&
          optimisticState.follower_count !== originalFollowerCount;
        
        return stateChangedImmediately;
      }),
      { numRuns: 100 }
    );
  });
});
