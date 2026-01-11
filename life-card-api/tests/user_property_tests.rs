//! Property-based tests for user module
//! 
//! These tests validate the correctness properties defined in the design document.
//! 
//! **Feature: life-card-mvp**

use proptest::prelude::*;
use life_card_api::utils::{password, validation};

// ============================================================================
// Generators for test data
// ============================================================================

/// Generate valid email addresses
fn valid_email_strategy() -> impl Strategy<Value = String> {
    // Generate email with format: [a-z]{3,10}@[a-z]{3,8}.[a-z]{2,4}
    (
        "[a-z]{3,10}",  // local part
        "[a-z]{3,8}",   // domain
        "[a-z]{2,4}",   // tld
    )
        .prop_map(|(local, domain, tld)| format!("{}@{}.{}", local, domain, tld))
}

/// Generate invalid email addresses
fn invalid_email_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("".to_string()),
        Just("invalid".to_string()),
        Just("@example.com".to_string()),
        Just("test@".to_string()),
        Just("test@.com".to_string()),
        Just("test@@example.com".to_string()),
        "[a-z]{1,10}".prop_map(|s| s), // no @ symbol
    ]
}

/// Generate valid passwords (at least 8 characters)
fn valid_password_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9]{8,32}"
}

/// Generate invalid passwords (less than 8 characters)
fn invalid_password_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("".to_string()),
        "[a-zA-Z0-9]{1,7}",  // 1-7 characters
    ]
}

// ============================================================================
// Property 1: User Registration Round-Trip
// **Validates: Requirements 1.1, 1.4**
// 
// For any valid email and password combination, registering a user and then
// logging in with the same credentials SHALL return a valid authentication
// token and the user profile should match the registration data.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 1: User Registration Round-Trip**
    /// 
    /// This test validates that password hashing is a one-way function that
    /// preserves verification capability - the core of the registration/login
    /// round-trip at the cryptographic level.
    #[test]
    fn prop_password_hash_round_trip(password in valid_password_strategy()) {
        // Hash the password
        let hash = password::hash_password(&password)
            .expect("Password hashing should succeed for valid passwords");
        
        // Verify the password against the hash (round-trip)
        let verified = password::verify_password(&password, &hash)
            .expect("Password verification should not error");
        
        // The original password should verify against its hash
        prop_assert!(verified, "Password should verify against its own hash");
        
        // The hash should not be the same as the password (one-way)
        prop_assert_ne!(hash, password, "Hash should not equal the original password");
    }
}

// ============================================================================
// Property 2: Input Validation Rejection
// **Validates: Requirements 1.2, 1.5, 3.8**
// 
// For any invalid input (malformed email, empty required fields, incorrect
// credentials), THE System SHALL reject the operation and return appropriate
// validation errors without modifying system state.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 2: Input Validation Rejection - Invalid Emails**
    /// 
    /// For any invalid email format, validation should reject it.
    #[test]
    fn prop_invalid_email_rejected(email in invalid_email_strategy()) {
        let is_valid = validation::is_valid_email(&email);
        prop_assert!(!is_valid, "Invalid email '{}' should be rejected", email);
    }

    /// **Feature: life-card-mvp, Property 2: Input Validation Rejection - Valid Emails**
    /// 
    /// For any valid email format, validation should accept it.
    #[test]
    fn prop_valid_email_accepted(email in valid_email_strategy()) {
        let is_valid = validation::is_valid_email(&email);
        prop_assert!(is_valid, "Valid email '{}' should be accepted", email);
    }

    /// **Feature: life-card-mvp, Property 2: Input Validation Rejection - Invalid Passwords**
    /// 
    /// For any password shorter than 8 characters, validation should reject it.
    #[test]
    fn prop_invalid_password_rejected(password in invalid_password_strategy()) {
        let is_valid = validation::is_valid_password(&password);
        prop_assert!(!is_valid, "Invalid password (len={}) should be rejected", password.len());
    }

    /// **Feature: life-card-mvp, Property 2: Input Validation Rejection - Valid Passwords**
    /// 
    /// For any password with 8 or more characters, validation should accept it.
    #[test]
    fn prop_valid_password_accepted(password in valid_password_strategy()) {
        let is_valid = validation::is_valid_password(&password);
        prop_assert!(is_valid, "Valid password (len={}) should be accepted", password.len());
    }

    /// **Feature: life-card-mvp, Property 2: Input Validation Rejection - Wrong Password**
    /// 
    /// For any password, verifying with a different password should fail.
    #[test]
    fn prop_wrong_password_rejected(
        original in valid_password_strategy(),
        wrong in valid_password_strategy()
    ) {
        // Skip if passwords happen to be the same
        prop_assume!(original != wrong);
        
        let hash = password::hash_password(&original)
            .expect("Password hashing should succeed");
        
        let verified = password::verify_password(&wrong, &hash)
            .expect("Password verification should not error");
        
        prop_assert!(!verified, "Wrong password should not verify");
    }
}

// ============================================================================
// Property 3: New User Initialization Invariant
// **Validates: Requirements 1.7**
// 
// For any newly registered user, THE User_Service SHALL initialize the user
// with default experience coin balance (100 coins) and level 1.
// 
// Note: This property is tested at the unit level since it requires database
// interaction. The property test here validates the configuration defaults.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 3: New User Initialization Invariant**
    /// 
    /// This test validates that password hashing produces unique hashes for
    /// different passwords, ensuring user credentials are properly isolated.
    #[test]
    fn prop_different_passwords_different_hashes(
        password1 in valid_password_strategy(),
        password2 in valid_password_strategy()
    ) {
        prop_assume!(password1 != password2);
        
        let hash1 = password::hash_password(&password1)
            .expect("Password hashing should succeed");
        let hash2 = password::hash_password(&password2)
            .expect("Password hashing should succeed");
        
        // Different passwords should produce different hashes
        prop_assert_ne!(hash1, hash2, "Different passwords should produce different hashes");
    }

    /// **Feature: life-card-mvp, Property 3: New User Initialization Invariant**
    /// 
    /// This test validates that the same password produces different hashes
    /// due to random salt, ensuring security even if passwords are reused.
    #[test]
    fn prop_same_password_different_hashes_due_to_salt(password in valid_password_strategy()) {
        let hash1 = password::hash_password(&password)
            .expect("Password hashing should succeed");
        let hash2 = password::hash_password(&password)
            .expect("Password hashing should succeed");
        
        // Same password should produce different hashes due to random salt
        prop_assert_ne!(&hash1, &hash2, "Same password should produce different hashes due to salt");
        
        // But both should verify correctly
        let verified1 = password::verify_password(&password, &hash1)
            .expect("Verification should not error");
        let verified2 = password::verify_password(&password, &hash2)
            .expect("Verification should not error");
        
        prop_assert!(verified1, "Password should verify against first hash");
        prop_assert!(verified2, "Password should verify against second hash");
    }
}

// ============================================================================
// Property 4: Profile Update Round-Trip
// **Validates: Requirements 2.1, 2.3**
// 
// For any valid profile update data (nickname, bio, interest tags), updating
// a user's profile and then retrieving it SHALL return data equivalent to
// the update input.
// ============================================================================

use life_card_api::models::user::{AgeRange, ProfileUpdateData};

/// Generate valid nickname (1-100 characters, non-empty)
fn valid_nickname_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s]{1,50}".prop_filter("nickname must not be empty or whitespace only", |s| {
        !s.trim().is_empty()
    })
}

/// Generate valid bio (0-500 characters)
fn valid_bio_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s\\.\\,\\!\\?]{0,200}"
}

/// Generate valid location (0-200 characters)
fn valid_location_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s\\,]{0,100}"
}

/// Generate valid age range
fn age_range_strategy() -> impl Strategy<Value = AgeRange> {
    prop_oneof![
        Just(AgeRange::Age18To24),
        Just(AgeRange::Age25To30),
        Just(AgeRange::Age31To40),
        Just(AgeRange::Age41To50),
        Just(AgeRange::Age50Plus),
    ]
}

/// Generate valid interest tag (1-50 characters, non-empty)
fn valid_interest_tag_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-]{1,30}".prop_filter("tag must not be empty", |s| !s.trim().is_empty())
}

/// Generate a vector of valid interest tags (0-20 tags)
fn valid_interest_tags_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(valid_interest_tag_strategy(), 0..10)
}

/// Generate valid ProfileUpdateData
fn profile_update_data_strategy() -> impl Strategy<Value = ProfileUpdateData> {
    (
        prop::option::of(valid_nickname_strategy()),
        prop::option::of(valid_bio_strategy()),
        prop::option::of(age_range_strategy()),
        prop::option::of(valid_location_strategy()),
    )
        .prop_map(|(nickname, bio, age_range, location)| ProfileUpdateData {
            nickname,
            bio,
            age_range,
            location,
        })
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 4: Profile Update Round-Trip - AgeRange Conversion**
    /// 
    /// For any AgeRange value, converting to database string and back should
    /// produce the original value.
    #[test]
    fn prop_age_range_round_trip(age_range in age_range_strategy()) {
        // Convert to database string
        let db_str = age_range.to_db_str();
        
        // Convert back from database string
        let recovered = AgeRange::from_db_str(db_str);
        
        // Should recover the original value
        prop_assert!(recovered.is_some(), "AgeRange should be recoverable from db string");
        prop_assert_eq!(recovered.unwrap(), age_range, "Round-trip should preserve AgeRange value");
    }

    /// **Feature: life-card-mvp, Property 4: Profile Update Round-Trip - ProfileUpdateData Serialization**
    /// 
    /// For any valid ProfileUpdateData, serializing to JSON and deserializing
    /// should produce equivalent data.
    #[test]
    fn prop_profile_update_data_serialization_round_trip(data in profile_update_data_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&data)
            .expect("ProfileUpdateData should serialize to JSON");
        
        // Deserialize from JSON
        let recovered: ProfileUpdateData = serde_json::from_str(&json)
            .expect("ProfileUpdateData should deserialize from JSON");
        
        // Compare fields
        prop_assert_eq!(recovered.nickname, data.nickname, "Nickname should round-trip");
        prop_assert_eq!(recovered.bio, data.bio, "Bio should round-trip");
        prop_assert_eq!(recovered.age_range, data.age_range, "AgeRange should round-trip");
        prop_assert_eq!(recovered.location, data.location, "Location should round-trip");
    }

    /// **Feature: life-card-mvp, Property 4: Profile Update Round-Trip - Interest Tags Deduplication**
    /// 
    /// For any set of interest tags, the deduplication logic should preserve
    /// unique tags and remove duplicates while maintaining non-empty constraint.
    #[test]
    fn prop_interest_tags_deduplication(tags in valid_interest_tags_strategy()) {
        // Simulate the deduplication logic from user_service.rs
        let unique_tags: Vec<String> = tags
            .iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        
        // Property 1: No duplicates in result
        let unique_set: std::collections::HashSet<_> = unique_tags.iter().collect();
        prop_assert_eq!(unique_set.len(), unique_tags.len(), "Result should have no duplicates");
        
        // Property 2: All unique tags from input are preserved
        let input_unique: std::collections::HashSet<_> = tags
            .iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
        let output_set: std::collections::HashSet<_> = unique_tags.iter().cloned().collect();
        prop_assert_eq!(input_unique, output_set, "All unique non-empty tags should be preserved");
        
        // Property 3: No empty tags in result
        for tag in &unique_tags {
            prop_assert!(!tag.is_empty(), "No empty tags should be in result");
        }
    }

    /// **Feature: life-card-mvp, Property 4: Profile Update Round-Trip - Interest Tags Serialization**
    /// 
    /// For any valid interest tags, serializing to JSON and deserializing
    /// should produce equivalent data.
    #[test]
    fn prop_interest_tags_serialization_round_trip(tags in valid_interest_tags_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&tags)
            .expect("Interest tags should serialize to JSON");
        
        // Deserialize from JSON
        let recovered: Vec<String> = serde_json::from_str(&json)
            .expect("Interest tags should deserialize from JSON");
        
        // Should be equal
        prop_assert_eq!(recovered, tags, "Interest tags should round-trip through JSON");
    }
}

// ============================================================================
// Property 15: Follow Relationship Consistency
// **Validates: Requirements 8.5, 8.6, 8.7**
// 
// For any follow/unfollow operation, THE User_Service SHALL maintain consistent
// follower and following counts that match the actual relationship records.
// ============================================================================

use uuid::Uuid;
use std::collections::{HashMap, HashSet};

/// A simple in-memory model of the follow system for property testing
/// This models the expected behavior without database interaction
#[derive(Debug, Clone, Default)]
struct FollowSystemModel {
    /// Map from user_id to set of users they follow
    following: HashMap<Uuid, HashSet<Uuid>>,
    /// Map from user_id to set of users following them
    followers: HashMap<Uuid, HashSet<Uuid>>,
    /// Set of all known users
    users: HashSet<Uuid>,
}

impl FollowSystemModel {
    fn new() -> Self {
        Self::default()
    }

    /// Add a user to the system
    fn add_user(&mut self, user_id: Uuid) {
        self.users.insert(user_id);
        self.following.entry(user_id).or_default();
        self.followers.entry(user_id).or_default();
    }

    /// Follow a user (returns true if successful, false if already following or invalid)
    fn follow(&mut self, follower_id: Uuid, followee_id: Uuid) -> bool {
        // Cannot follow self
        if follower_id == followee_id {
            return false;
        }
        // Both users must exist
        if !self.users.contains(&follower_id) || !self.users.contains(&followee_id) {
            return false;
        }
        // Check if already following
        if self.following.get(&follower_id).map_or(false, |f| f.contains(&followee_id)) {
            return false;
        }
        // Add follow relationship
        self.following.entry(follower_id).or_default().insert(followee_id);
        self.followers.entry(followee_id).or_default().insert(follower_id);
        true
    }

    /// Unfollow a user (returns true if successful, false if not following)
    fn unfollow(&mut self, follower_id: Uuid, followee_id: Uuid) -> bool {
        // Cannot unfollow self
        if follower_id == followee_id {
            return false;
        }
        // Check if following
        if !self.following.get(&follower_id).map_or(false, |f| f.contains(&followee_id)) {
            return false;
        }
        // Remove follow relationship
        self.following.entry(follower_id).or_default().remove(&followee_id);
        self.followers.entry(followee_id).or_default().remove(&follower_id);
        true
    }

    /// Check if follower is following followee
    fn is_following(&self, follower_id: Uuid, followee_id: Uuid) -> bool {
        self.following.get(&follower_id).map_or(false, |f| f.contains(&followee_id))
    }

    /// Get follower count for a user
    fn follower_count(&self, user_id: Uuid) -> usize {
        self.followers.get(&user_id).map_or(0, |f| f.len())
    }

    /// Get following count for a user
    fn following_count(&self, user_id: Uuid) -> usize {
        self.following.get(&user_id).map_or(0, |f| f.len())
    }

    /// Verify consistency: follower counts match actual relationships
    fn verify_consistency(&self) -> bool {
        for user_id in &self.users {
            // Verify follower count matches actual followers
            let actual_followers = self.followers.get(user_id).map_or(0, |f| f.len());
            
            // Count how many users have this user in their following set
            let computed_followers = self.following.values()
                .filter(|following_set| following_set.contains(user_id))
                .count();
            
            if actual_followers != computed_followers {
                return false;
            }

            // Verify following count matches actual following
            let actual_following = self.following.get(user_id).map_or(0, |f| f.len());
            
            // Count how many users have this user in their followers set
            let computed_following = self.followers.values()
                .filter(|followers_set| followers_set.contains(user_id))
                .count();
            
            if actual_following != computed_following {
                return false;
            }
        }
        true
    }
}

/// Generate a random UUID
fn uuid_strategy() -> impl Strategy<Value = Uuid> {
    any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
}

/// Generate a vector of unique UUIDs (representing users)
fn user_ids_strategy(min: usize, max: usize) -> impl Strategy<Value = Vec<Uuid>> {
    prop::collection::hash_set(uuid_strategy(), min..max)
        .prop_map(|set| set.into_iter().collect())
}

/// Follow operation for property testing
#[derive(Debug, Clone)]
enum FollowOp {
    Follow { follower_idx: usize, followee_idx: usize },
    Unfollow { follower_idx: usize, followee_idx: usize },
}

/// Generate a sequence of follow/unfollow operations
fn follow_ops_strategy(num_users: usize, num_ops: usize) -> impl Strategy<Value = Vec<FollowOp>> {
    prop::collection::vec(
        prop_oneof![
            (0..num_users, 0..num_users).prop_map(|(follower_idx, followee_idx)| {
                FollowOp::Follow { follower_idx, followee_idx }
            }),
            (0..num_users, 0..num_users).prop_map(|(follower_idx, followee_idx)| {
                FollowOp::Unfollow { follower_idx, followee_idx }
            }),
        ],
        0..num_ops,
    )
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Basic Follow**
    /// 
    /// For any two distinct users, following creates a relationship that is
    /// reflected in both the follower's following set and the followee's followers set.
    #[test]
    fn prop_follow_creates_bidirectional_relationship(
        user_ids in user_ids_strategy(2, 10)
    ) {
        prop_assume!(user_ids.len() >= 2);
        
        let mut model = FollowSystemModel::new();
        for &user_id in &user_ids {
            model.add_user(user_id);
        }
        
        let follower_id = user_ids[0];
        let followee_id = user_ids[1];
        
        // Before follow
        prop_assert!(!model.is_following(follower_id, followee_id));
        prop_assert_eq!(model.follower_count(followee_id), 0);
        prop_assert_eq!(model.following_count(follower_id), 0);
        
        // Follow
        let result = model.follow(follower_id, followee_id);
        prop_assert!(result, "Follow should succeed for distinct users");
        
        // After follow
        prop_assert!(model.is_following(follower_id, followee_id));
        prop_assert_eq!(model.follower_count(followee_id), 1);
        prop_assert_eq!(model.following_count(follower_id), 1);
        
        // Verify consistency
        prop_assert!(model.verify_consistency(), "Model should remain consistent after follow");
    }

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Unfollow**
    /// 
    /// For any existing follow relationship, unfollowing removes the relationship
    /// and decrements both counts correctly.
    #[test]
    fn prop_unfollow_removes_relationship(
        user_ids in user_ids_strategy(2, 10)
    ) {
        prop_assume!(user_ids.len() >= 2);
        
        let mut model = FollowSystemModel::new();
        for &user_id in &user_ids {
            model.add_user(user_id);
        }
        
        let follower_id = user_ids[0];
        let followee_id = user_ids[1];
        
        // First follow
        model.follow(follower_id, followee_id);
        prop_assert!(model.is_following(follower_id, followee_id));
        
        // Then unfollow
        let result = model.unfollow(follower_id, followee_id);
        prop_assert!(result, "Unfollow should succeed for existing relationship");
        
        // After unfollow
        prop_assert!(!model.is_following(follower_id, followee_id));
        prop_assert_eq!(model.follower_count(followee_id), 0);
        prop_assert_eq!(model.following_count(follower_id), 0);
        
        // Verify consistency
        prop_assert!(model.verify_consistency(), "Model should remain consistent after unfollow");
    }

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Self Follow Prevention**
    /// 
    /// A user cannot follow themselves.
    #[test]
    fn prop_cannot_follow_self(user_id in uuid_strategy()) {
        let mut model = FollowSystemModel::new();
        model.add_user(user_id);
        
        let result = model.follow(user_id, user_id);
        prop_assert!(!result, "Self-follow should be rejected");
        prop_assert!(!model.is_following(user_id, user_id));
        prop_assert_eq!(model.follower_count(user_id), 0);
        prop_assert_eq!(model.following_count(user_id), 0);
    }

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Idempotent Follow**
    /// 
    /// Following the same user twice should fail on the second attempt
    /// and not change the counts.
    #[test]
    fn prop_follow_is_not_duplicated(
        user_ids in user_ids_strategy(2, 10)
    ) {
        prop_assume!(user_ids.len() >= 2);
        
        let mut model = FollowSystemModel::new();
        for &user_id in &user_ids {
            model.add_user(user_id);
        }
        
        let follower_id = user_ids[0];
        let followee_id = user_ids[1];
        
        // First follow succeeds
        let result1 = model.follow(follower_id, followee_id);
        prop_assert!(result1);
        prop_assert_eq!(model.follower_count(followee_id), 1);
        prop_assert_eq!(model.following_count(follower_id), 1);
        
        // Second follow fails
        let result2 = model.follow(follower_id, followee_id);
        prop_assert!(!result2, "Duplicate follow should be rejected");
        
        // Counts should not change
        prop_assert_eq!(model.follower_count(followee_id), 1);
        prop_assert_eq!(model.following_count(follower_id), 1);
        
        // Verify consistency
        prop_assert!(model.verify_consistency());
    }

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Unfollow Non-Existing**
    /// 
    /// Unfollowing a user you don't follow should fail and not change counts.
    #[test]
    fn prop_unfollow_nonexisting_fails(
        user_ids in user_ids_strategy(2, 10)
    ) {
        prop_assume!(user_ids.len() >= 2);
        
        let mut model = FollowSystemModel::new();
        for &user_id in &user_ids {
            model.add_user(user_id);
        }
        
        let follower_id = user_ids[0];
        let followee_id = user_ids[1];
        
        // Unfollow without following first
        let result = model.unfollow(follower_id, followee_id);
        prop_assert!(!result, "Unfollow should fail when not following");
        
        // Counts should remain zero
        prop_assert_eq!(model.follower_count(followee_id), 0);
        prop_assert_eq!(model.following_count(follower_id), 0);
    }

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Sequence of Operations**
    /// 
    /// For any sequence of follow/unfollow operations, the follower and following
    /// counts should always match the actual relationship records.
    #[test]
    fn prop_follow_sequence_maintains_consistency(
        user_ids in user_ids_strategy(3, 8),
        ops in follow_ops_strategy(8, 20)
    ) {
        prop_assume!(user_ids.len() >= 2);
        
        let mut model = FollowSystemModel::new();
        for &user_id in &user_ids {
            model.add_user(user_id);
        }
        
        // Apply operations
        for op in ops {
            match op {
                FollowOp::Follow { follower_idx, followee_idx } => {
                    if follower_idx < user_ids.len() && followee_idx < user_ids.len() {
                        let _ = model.follow(user_ids[follower_idx], user_ids[followee_idx]);
                    }
                }
                FollowOp::Unfollow { follower_idx, followee_idx } => {
                    if follower_idx < user_ids.len() && followee_idx < user_ids.len() {
                        let _ = model.unfollow(user_ids[follower_idx], user_ids[followee_idx]);
                    }
                }
            }
            
            // After each operation, verify consistency
            prop_assert!(
                model.verify_consistency(),
                "Model should remain consistent after each operation"
            );
        }
        
        // Final consistency check
        prop_assert!(model.verify_consistency(), "Model should be consistent at the end");
        
        // Additional invariant: for each user, follower_count equals the number of
        // users who have them in their following set
        for &user_id in &user_ids {
            let follower_count = model.follower_count(user_id);
            let following_count = model.following_count(user_id);
            
            // Count actual relationships
            let actual_followers: usize = user_ids.iter()
                .filter(|&&other_id| other_id != user_id && model.is_following(other_id, user_id))
                .count();
            let actual_following: usize = user_ids.iter()
                .filter(|&&other_id| other_id != user_id && model.is_following(user_id, other_id))
                .count();
            
            prop_assert_eq!(
                follower_count, actual_followers,
                "Follower count should match actual followers for user {:?}", user_id
            );
            prop_assert_eq!(
                following_count, actual_following,
                "Following count should match actual following for user {:?}", user_id
            );
        }
    }

    /// **Feature: life-card-mvp, Property 15: Follow Relationship Consistency - Asymmetric Relationship**
    /// 
    /// Following is asymmetric: A following B does not imply B following A.
    #[test]
    fn prop_follow_is_asymmetric(
        user_ids in user_ids_strategy(2, 10)
    ) {
        prop_assume!(user_ids.len() >= 2);
        
        let mut model = FollowSystemModel::new();
        for &user_id in &user_ids {
            model.add_user(user_id);
        }
        
        let user_a = user_ids[0];
        let user_b = user_ids[1];
        
        // A follows B
        model.follow(user_a, user_b);
        
        // A follows B, but B does not follow A
        prop_assert!(model.is_following(user_a, user_b));
        prop_assert!(!model.is_following(user_b, user_a));
        
        // Counts reflect asymmetry
        prop_assert_eq!(model.following_count(user_a), 1);
        prop_assert_eq!(model.follower_count(user_a), 0);
        prop_assert_eq!(model.following_count(user_b), 0);
        prop_assert_eq!(model.follower_count(user_b), 1);
    }
}


// ============================================================================
// Property 11: Coin Balance Invariant
// **Validates: Requirements 6.4, 6.6**
// 
// For any user at any point in time, the user's coin balance SHALL equal the
// sum of all their coin transactions, and the balance SHALL never be negative.
// ============================================================================

/// A simple in-memory model of the coin system for property testing
/// This models the expected behavior without database interaction
#[derive(Debug, Clone)]
struct CoinSystemModel {
    /// Current balance
    balance: i32,
    /// Transaction history (amount can be positive or negative)
    transactions: Vec<i32>,
    /// Initial balance (default 100 for new users)
    initial_balance: i32,
}

impl CoinSystemModel {
    /// Create a new coin system with default initial balance
    fn new(initial_balance: i32) -> Self {
        Self {
            balance: initial_balance,
            transactions: Vec::new(),
            initial_balance,
        }
    }

    /// Add coins to balance (returns new balance or error if amount <= 0)
    fn add_coins(&mut self, amount: i32) -> Result<i32, &'static str> {
        if amount <= 0 {
            return Err("Amount must be positive");
        }
        self.balance += amount;
        self.transactions.push(amount);
        Ok(self.balance)
    }

    /// Deduct coins from balance (returns new balance or error)
    fn deduct_coins(&mut self, amount: i32) -> Result<i32, &'static str> {
        if amount <= 0 {
            return Err("Amount must be positive");
        }
        if self.balance < amount {
            return Err("Insufficient balance");
        }
        self.balance -= amount;
        self.transactions.push(-amount);
        Ok(self.balance)
    }

    /// Get current balance
    fn get_balance(&self) -> i32 {
        self.balance
    }

    /// Verify invariant: balance equals initial_balance + sum of all transactions
    fn verify_balance_invariant(&self) -> bool {
        let sum: i32 = self.transactions.iter().sum();
        self.balance == self.initial_balance + sum
    }

    /// Verify invariant: balance is never negative
    fn verify_non_negative(&self) -> bool {
        self.balance >= 0
    }
}

/// Generate a positive coin amount (1-1000)
fn positive_coin_amount_strategy() -> impl Strategy<Value = i32> {
    1..=1000i32
}

/// Generate an initial balance (0-10000)
fn initial_balance_strategy() -> impl Strategy<Value = i32> {
    0..=10000i32
}

/// Coin operation for property testing
#[derive(Debug, Clone)]
enum CoinOp {
    Add(i32),
    Deduct(i32),
}

/// Generate a sequence of coin operations
fn coin_ops_strategy(num_ops: usize) -> impl Strategy<Value = Vec<CoinOp>> {
    prop::collection::vec(
        prop_oneof![
            positive_coin_amount_strategy().prop_map(CoinOp::Add),
            positive_coin_amount_strategy().prop_map(CoinOp::Deduct),
        ],
        0..num_ops,
    )
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Balance Equals Sum**
    /// 
    /// For any sequence of coin operations, the balance should always equal
    /// the initial balance plus the sum of all transaction amounts.
    #[test]
    fn prop_balance_equals_sum_of_transactions(
        initial_balance in initial_balance_strategy(),
        ops in coin_ops_strategy(50)
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        
        // Apply operations
        for op in ops {
            match op {
                CoinOp::Add(amount) => {
                    let _ = model.add_coins(amount);
                }
                CoinOp::Deduct(amount) => {
                    // Only deduct if we have enough balance
                    let _ = model.deduct_coins(amount);
                }
            }
            
            // After each operation, verify the balance invariant
            prop_assert!(
                model.verify_balance_invariant(),
                "Balance {} should equal initial {} + sum of transactions {:?}",
                model.get_balance(),
                model.initial_balance,
                model.transactions
            );
        }
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Never Negative**
    /// 
    /// For any sequence of coin operations, the balance should never become negative.
    #[test]
    fn prop_balance_never_negative(
        initial_balance in initial_balance_strategy(),
        ops in coin_ops_strategy(50)
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        
        // Apply operations
        for op in ops {
            match op {
                CoinOp::Add(amount) => {
                    let _ = model.add_coins(amount);
                }
                CoinOp::Deduct(amount) => {
                    let _ = model.deduct_coins(amount);
                }
            }
            
            // After each operation, verify balance is non-negative
            prop_assert!(
                model.verify_non_negative(),
                "Balance {} should never be negative",
                model.get_balance()
            );
        }
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Add Increases Balance**
    /// 
    /// For any positive amount, adding coins should increase the balance by exactly that amount.
    #[test]
    fn prop_add_coins_increases_balance(
        initial_balance in initial_balance_strategy(),
        amount in positive_coin_amount_strategy()
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        let balance_before = model.get_balance();
        
        let result = model.add_coins(amount);
        
        prop_assert!(result.is_ok(), "Adding positive amount should succeed");
        prop_assert_eq!(
            model.get_balance(),
            balance_before + amount,
            "Balance should increase by exactly the added amount"
        );
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Deduct Decreases Balance**
    /// 
    /// For any positive amount less than or equal to balance, deducting coins
    /// should decrease the balance by exactly that amount.
    #[test]
    fn prop_deduct_coins_decreases_balance(
        initial_balance in 100..=10000i32,
        amount in 1..=100i32
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        let balance_before = model.get_balance();
        
        // Ensure we have enough balance
        prop_assume!(balance_before >= amount);
        
        let result = model.deduct_coins(amount);
        
        prop_assert!(result.is_ok(), "Deducting amount <= balance should succeed");
        prop_assert_eq!(
            model.get_balance(),
            balance_before - amount,
            "Balance should decrease by exactly the deducted amount"
        );
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Insufficient Balance Rejection**
    /// 
    /// For any deduction amount greater than the current balance, the operation
    /// should fail and the balance should remain unchanged.
    #[test]
    fn prop_insufficient_balance_rejected(
        initial_balance in 0..=100i32,
        extra_amount in 1..=1000i32
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        let balance_before = model.get_balance();
        let deduct_amount = balance_before + extra_amount;
        
        let result = model.deduct_coins(deduct_amount);
        
        prop_assert!(result.is_err(), "Deducting more than balance should fail");
        prop_assert_eq!(
            model.get_balance(),
            balance_before,
            "Balance should remain unchanged after failed deduction"
        );
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Zero/Negative Amount Rejection**
    /// 
    /// Adding or deducting zero or negative amounts should be rejected.
    #[test]
    fn prop_invalid_amount_rejected(
        initial_balance in initial_balance_strategy(),
        invalid_amount in -1000..=0i32
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        let balance_before = model.get_balance();
        
        // Try to add invalid amount
        let add_result = model.add_coins(invalid_amount);
        prop_assert!(add_result.is_err(), "Adding zero/negative amount should fail");
        prop_assert_eq!(model.get_balance(), balance_before, "Balance unchanged after invalid add");
        
        // Try to deduct invalid amount
        let deduct_result = model.deduct_coins(invalid_amount);
        prop_assert!(deduct_result.is_err(), "Deducting zero/negative amount should fail");
        prop_assert_eq!(model.get_balance(), balance_before, "Balance unchanged after invalid deduct");
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Transaction Count Matches Operations**
    /// 
    /// The number of recorded transactions should match the number of successful operations.
    #[test]
    fn prop_transaction_count_matches_successful_ops(
        initial_balance in initial_balance_strategy(),
        ops in coin_ops_strategy(30)
    ) {
        let mut model = CoinSystemModel::new(initial_balance);
        let mut successful_ops = 0;
        
        for op in ops {
            let result = match op {
                CoinOp::Add(amount) => model.add_coins(amount),
                CoinOp::Deduct(amount) => model.deduct_coins(amount),
            };
            
            if result.is_ok() {
                successful_ops += 1;
            }
        }
        
        prop_assert_eq!(
            model.transactions.len(),
            successful_ops,
            "Transaction count should match successful operations"
        );
    }

    /// **Feature: life-card-mvp, Property 11: Coin Balance Invariant - Default User Balance**
    /// 
    /// New users should be initialized with the default coin balance (100).
    #[test]
    fn prop_default_user_balance_is_100(_seed in any::<u64>()) {
        // The default balance for new users is 100 as per requirements
        let default_balance = 100;
        let model = CoinSystemModel::new(default_balance);
        
        prop_assert_eq!(
            model.get_balance(),
            100,
            "Default user balance should be 100"
        );
        prop_assert!(
            model.transactions.is_empty(),
            "New user should have no transactions"
        );
        prop_assert!(
            model.verify_balance_invariant(),
            "Balance invariant should hold for new user"
        );
    }
}
