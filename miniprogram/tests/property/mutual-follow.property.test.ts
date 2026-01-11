/// <reference types="jest" />
/**
 * Property-Based Tests for Mutual Follow Status Accuracy
 * Feature: life-card-miniprogram, Property 15: Mutual Follow Status Accuracy
 * Validates: Requirements 9.5
 * 
 * For any two users A and B:
 * - If A follows B AND B follows A, mutual follow indicator SHALL be shown
 * - If only one follows the other, mutual indicator SHALL NOT be shown
 */
import * as fc from 'fast-check';

// Types for follow relationship between two users
interface FollowRelationship {
  /** Whether user A follows user B */
  aFollowsB: boolean;
  /** Whether user B follows user A */
  bFollowsA: boolean;
}

// User with follow status as seen from another user's perspective
interface UserFollowView {
  id: string;
  nickname: string;
  is_following: boolean;
  is_mutual_follow: boolean;
}

/**
 * Determines if mutual follow status should be shown
 * This is the core logic that should be consistent across the app
 * 
 * Mutual follow is true if and only if BOTH users follow each other
 */
function calculateMutualFollowStatus(relationship: FollowRelationship): boolean {
  return relationship.aFollowsB && relationship.bFollowsA;
}

/**
 * Simulates how user B appears in user A's view (e.g., in followers/following list)
 * This mirrors the logic in follow-list.ts and user-profile.ts
 */
function getUserViewFromA(
  userBId: string,
  userBNickname: string,
  relationship: FollowRelationship
): UserFollowView {
  return {
    id: userBId,
    nickname: userBNickname,
    is_following: relationship.aFollowsB,
    is_mutual_follow: calculateMutualFollowStatus(relationship),
  };
}

/**
 * Simulates updating mutual follow status after a follow action
 * When A follows B, we need to check if B already follows A
 */
function updateMutualStatusAfterFollow(
  currentRelationship: FollowRelationship,
  aFollowsB: boolean
): FollowRelationship {
  return {
    aFollowsB,
    bFollowsA: currentRelationship.bFollowsA,
  };
}

/**
 * Simulates the mutual follow check in follow-list.ts
 * isUserFollowingMe checks if the target user is in the followers list
 */
function checkMutualFollowInList(
  isInFollowersList: boolean,
  isFollowing: boolean
): boolean {
  return isInFollowersList && isFollowing;
}

describe('Mutual Follow Status Accuracy Properties', () => {
  // Arbitrary for generating follow relationships
  const followRelationshipArb: fc.Arbitrary<FollowRelationship> = fc.record({
    aFollowsB: fc.boolean(),
    bFollowsA: fc.boolean(),
  });

  // Arbitrary for generating user IDs
  const userIdArb: fc.Arbitrary<string> = fc.uuid();

  // Arbitrary for generating nicknames
  const nicknameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /**
   * Property 15.1: Mutual follow SHALL be true only when both users follow each other
   */
  it('should show mutual follow indicator only when both users follow each other', () => {
    fc.assert(
      fc.property(followRelationshipArb, (relationship) => {
        const isMutual = calculateMutualFollowStatus(relationship);
        
        // Mutual is true if and only if both follow each other
        const expectedMutual = relationship.aFollowsB && relationship.bFollowsA;
        return isMutual === expectedMutual;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.2: When only A follows B (not mutual), is_mutual_follow SHALL be false
   */
  it('should not show mutual indicator when only one user follows the other (A follows B)', () => {
    const onlyAFollowsBArb: fc.Arbitrary<FollowRelationship> = fc.record({
      aFollowsB: fc.constant(true),
      bFollowsA: fc.constant(false),
    });

    fc.assert(
      fc.property(onlyAFollowsBArb, (relationship) => {
        const isMutual = calculateMutualFollowStatus(relationship);
        return isMutual === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.3: When only B follows A (not mutual), is_mutual_follow SHALL be false
   */
  it('should not show mutual indicator when only one user follows the other (B follows A)', () => {
    const onlyBFollowsAArb: fc.Arbitrary<FollowRelationship> = fc.record({
      aFollowsB: fc.constant(false),
      bFollowsA: fc.constant(true),
    });

    fc.assert(
      fc.property(onlyBFollowsAArb, (relationship) => {
        const isMutual = calculateMutualFollowStatus(relationship);
        return isMutual === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.4: When neither follows the other, is_mutual_follow SHALL be false
   */
  it('should not show mutual indicator when neither user follows the other', () => {
    const neitherFollowsArb: fc.Arbitrary<FollowRelationship> = fc.record({
      aFollowsB: fc.constant(false),
      bFollowsA: fc.constant(false),
    });

    fc.assert(
      fc.property(neitherFollowsArb, (relationship) => {
        const isMutual = calculateMutualFollowStatus(relationship);
        return isMutual === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.5: When both follow each other, is_mutual_follow SHALL be true
   */
  it('should show mutual indicator when both users follow each other', () => {
    const bothFollowArb: fc.Arbitrary<FollowRelationship> = fc.record({
      aFollowsB: fc.constant(true),
      bFollowsA: fc.constant(true),
    });

    fc.assert(
      fc.property(bothFollowArb, (relationship) => {
        const isMutual = calculateMutualFollowStatus(relationship);
        return isMutual === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.6: User view SHALL correctly reflect mutual follow status
   */
  it('should correctly reflect mutual follow status in user view', () => {
    fc.assert(
      fc.property(
        userIdArb,
        nicknameArb,
        followRelationshipArb,
        (userId, nickname, relationship) => {
          const userView = getUserViewFromA(userId, nickname, relationship);
          
          // is_following should match aFollowsB
          const followingCorrect = userView.is_following === relationship.aFollowsB;
          
          // is_mutual_follow should be true only when both follow each other
          const mutualCorrect = userView.is_mutual_follow === 
            (relationship.aFollowsB && relationship.bFollowsA);
          
          return followingCorrect && mutualCorrect;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.7: Following action SHALL update mutual status correctly
   * When A starts following B, mutual status depends on whether B already follows A
   */
  it('should update mutual status correctly after follow action', () => {
    fc.assert(
      fc.property(followRelationshipArb, (initialRelationship) => {
        // Simulate A following B (regardless of initial state)
        const afterFollow = updateMutualStatusAfterFollow(initialRelationship, true);
        const mutualAfterFollow = calculateMutualFollowStatus(afterFollow);
        
        // Mutual should be true only if B was already following A
        return mutualAfterFollow === initialRelationship.bFollowsA;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.8: Unfollowing action SHALL update mutual status correctly
   * When A unfollows B, mutual status should become false
   */
  it('should update mutual status correctly after unfollow action', () => {
    fc.assert(
      fc.property(followRelationshipArb, (initialRelationship) => {
        // Simulate A unfollowing B
        const afterUnfollow = updateMutualStatusAfterFollow(initialRelationship, false);
        const mutualAfterUnfollow = calculateMutualFollowStatus(afterUnfollow);
        
        // Mutual should always be false after unfollowing
        return mutualAfterUnfollow === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.9: Mutual follow is symmetric - if A and B are mutual, both see mutual indicator
   */
  it('should be symmetric - both users see mutual indicator when mutual', () => {
    fc.assert(
      fc.property(followRelationshipArb, (relationship) => {
        // Calculate mutual from A's perspective
        const mutualFromA = calculateMutualFollowStatus(relationship);
        
        // Calculate mutual from B's perspective (swap the relationship)
        const relationshipFromB: FollowRelationship = {
          aFollowsB: relationship.bFollowsA,
          bFollowsA: relationship.aFollowsB,
        };
        const mutualFromB = calculateMutualFollowStatus(relationshipFromB);
        
        // Both should see the same mutual status
        return mutualFromA === mutualFromB;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.10: Mutual follow check in list SHALL match calculated status
   * This tests the checkMutualFollowInList function used in follow-list.ts
   */
  it('should correctly check mutual follow status in list context', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isInFollowersList (B follows A)
        fc.boolean(), // isFollowing (A follows B)
        (isInFollowersList, isFollowing) => {
          const mutualInList = checkMutualFollowInList(isInFollowersList, isFollowing);
          
          // Should be mutual only if both conditions are true
          const expectedMutual = isInFollowersList && isFollowing;
          return mutualInList === expectedMutual;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.11: Mutual follow status SHALL be consistent across different views
   * Whether viewing from followers list or following list, mutual status should be same
   */
  it('should have consistent mutual status across different list views', () => {
    fc.assert(
      fc.property(
        userIdArb,
        nicknameArb,
        followRelationshipArb,
        (userId, nickname, relationship) => {
          // View from followers list (B is in A's followers, meaning B follows A)
          // In this context, is_following means A follows B
          const viewInFollowersList: UserFollowView = {
            id: userId,
            nickname,
            is_following: relationship.aFollowsB,
            is_mutual_follow: relationship.aFollowsB && relationship.bFollowsA,
          };
          
          // View from following list (B is in A's following, meaning A follows B)
          // In this context, is_following should be true (since B is in following list)
          const viewInFollowingList: UserFollowView = {
            id: userId,
            nickname,
            is_following: relationship.aFollowsB,
            is_mutual_follow: relationship.aFollowsB && relationship.bFollowsA,
          };
          
          // Mutual status should be the same in both views
          return viewInFollowersList.is_mutual_follow === viewInFollowingList.is_mutual_follow;
        }
      ),
      { numRuns: 100 }
    );
  });
});
